# Relecture native des traductions somali (so) et afar (aa)

État au 25/09/2026 : les textes « afar » en base sont en grande partie des copies du somali (541 sur 1 315),
du somali abrégé ou de l'oromo — pas de l'afar. Le somali est plausible mais jamais validé par un natif.

## Produire le classeur de relecture
    node scripts/translations_review_export.mjs        # → translations-review/data.json (référence FR depuis la base ou le code)
    python scripts/translations_review_xlsx.py         # → translations-review/relecture-so-aa-<date>.xlsx

## Faire relire
Envoyer le .xlsx au relecteur natif (onglet « Lisez-moi » = consignes). Il remplit uniquement les colonnes jaunes
« corrigé ». Cellules rouge clair = afar copié du somali (à refaire), orange pâle = traduction absente.

## Importer les corrections
    node scripts/translations_review_import.mjs translations-review/relecture-so-aa-<date>.xlsx --dry   # aperçu
    node scripts/translations_review_import.mjs translations-review/relecture-so-aa-<date>.xlsx         # application (transaction unique)
Le site prend les nouveaux textes au prochain chargement (table ui_translations / product_translations).
