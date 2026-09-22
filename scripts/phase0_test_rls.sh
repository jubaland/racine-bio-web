#!/usr/bin/env bash
# Tests Phase 0 — NON DESTRUCTIFS. À lancer après scripts/phase0_catalog_security.sql.
# Principe : chaque écriture anonyme testée réécrit la valeur DÉJÀ présente (aucun changement
# même si la policy laissait passer), et tout artefact éventuel est nettoyé avec la clé service.
URL="https://sneuexxysxlwpokhkjho.supabase.co"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM3OTksImV4cCI6MjA5NDMyOTc5OX0.JizTtZmq83t5KGK2WkMtfIVtUo8VgFg6rI1ZEl4zjZY"
SVC="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Mzc5OSwiZXhwIjoyMDk0MzI5Nzk5fQ.w9Cq_gPz4OIIjFKOx2mlyLnqERSCe-3p6SYILmb1HJs"
A=(-H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -H "Prefer: return=representation")
S=(-H "apikey: $SVC"  -H "Authorization: Bearer $SVC"  -H "Content-Type: application/json")
ok=0; ko=0
pass(){ echo "✅ $1"; ok=$((ok+1)); }; fail(){ echo "❌ $1 → ${2:0:80}"; ko=$((ko+1)); }
# same_value_patch <label> <table> <pkcol> <col> : PATCH la 1re ligne avec sa propre valeur ; attendu [] (refusé)
same_value_patch(){
  row=$(curl -s "$URL/rest/v1/$2?select=$3,$4&limit=1" "${S[@]}" | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'))[0];if(!r){console.log('');process.exit()}console.log(r['$3']+'\t'+JSON.stringify(r['$4']))")
  [ -z "$row" ] && { echo "⚪ $1 (table vide, non testé)"; return; }
  id="${row%%$'\t'*}"; val="${row#*$'\t'}"
  r=$(curl -s -X PATCH "$URL/rest/v1/$2?$3=eq.$id" "${A[@]}" -d "{\"$4\":$val}")
  [ "$r" = "[]" ] && pass "$1" || fail "$1" "$r"
}

# Lectures publiques
r=$(curl -s "$URL/rest/v1/products?select=id&status=eq.published&limit=1" "${A[@]}");  [ "$r" != "[]" ] && [ -n "$r" ] && pass "anonyme LIT les produits publiés" || fail "anonyme LIT les produits publiés" "$r"
r=$(curl -s "$URL/rest/v1/categories?select=id&limit=1" "${A[@]}");                     [ "$r" != "[]" ] && [ -n "$r" ] && pass "anonyme LIT les catégories" || fail "anonyme LIT les catégories" "$r"

# Écritures anonymes (doivent être refusées)
# (colonnes ASCII uniquement : un emoji/accent passé par le shell Windows serait ré-encodé)
same_value_patch "anonyme NE MODIFIE PAS un produit"            products             id stock_qty
same_value_patch "anonyme NE MODIFIE PAS les catégories"        categories           id slug
same_value_patch "anonyme NE MODIFIE PAS les promos"            promos               id active
same_value_patch "anonyme NE MODIFIE PAS la livraison"          delivery_options     id price
same_value_patch "anonyme NE MODIFIE PAS les traductions"       product_translations id language_code

# Création anonyme d'un produit → refusée (nettoyage si passée)
r=$(curl -s -X POST "$URL/rest/v1/products" "${A[@]}" -d '{"name":"zz-test-rls","price":1,"unit":"/kg","status":"draft"}')
if echo "$r" | grep -q '"id"'; then fail "anonyme NE CRÉE PAS de produit" "créé !"; curl -s -o /dev/null -X DELETE "$URL/rest/v1/products?name=eq.zz-test-rls" "${S[@]}"; else pass "anonyme NE CRÉE PAS de produit"; fi

# producer_requests : ligne temporaire (clé service) → anonyme tente de l'approuver → nettoyage
tmp=$(curl -s -X POST "$URL/rest/v1/producer_requests" "${S[@]}" -H "Prefer: return=representation" -d '{"email":"zz-test-rls@example.invalid","farm_name":"zz-test","status":"pending"}' | node -e "try{console.log(JSON.parse(require('fs').readFileSync(0,'utf8'))[0].id)}catch{console.log('')}")
if [ -n "$tmp" ]; then
  r=$(curl -s -X PATCH "$URL/rest/v1/producer_requests?id=eq.$tmp" "${A[@]}" -d '{"status":"approved"}')
  [ "$r" = "[]" ] && pass "anonyme NE S'AUTO-APPROUVE PAS producteur" || fail "anonyme NE S'AUTO-APPROUVE PAS producteur" "$r"
  r=$(curl -s "$URL/rest/v1/producer_requests?id=eq.$tmp&select=id" "${A[@]}")
  [ "$r" = "[]" ] && pass "anonyme NE LIT PAS les demandes des autres" || fail "anonyme NE LIT PAS les demandes des autres" "$r"
  curl -s -o /dev/null -X DELETE "$URL/rest/v1/producer_requests?id=eq.$tmp" "${S[@]}"
else echo "⚪ producer_requests (ligne temporaire impossible, non testé)"; fi

# Stockage : upload anonyme refusé ; lecture publique OK ; nettoyage
r=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/storage/v1/object/product-images/zz-test-rls.txt" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: text/plain" -d "x")
[ "$r" != "200" ] && pass "anonyme N'UPLOADE PAS d'image (HTTP $r)" || fail "anonyme N'UPLOADE PAS d'image" "uploadé"
curl -s -o /dev/null -X DELETE "$URL/storage/v1/object/product-images/zz-test-rls.txt" "${S[@]}"
img=$(curl -s "$URL/rest/v1/products?select=image_url&image_url=like.*product-images*&limit=1" "${S[@]}" | grep -oE 'product-images/[^"]+' | head -1 | cut -d/ -f2-)
r=$(curl -s -o /dev/null -w "%{http_code}" "$URL/storage/v1/object/public/product-images/$img"); [ "$r" = "200" ] && pass "images publiques toujours lisibles" || fail "images publiques lisibles" "HTTP $r"

echo; echo "Résultat : $ok OK, $ko KO"