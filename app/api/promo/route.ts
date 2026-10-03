import { NextResponse } from 'next/server';
import { userFromRequest } from '../../../lib/company';
import { deliveryRules, findPromo, checkPromo, checkReferral, eligibleSubtotal, cleanCode, cleanPhone } from '../../../lib/promo-codes';
import { monitored } from '../../../lib/monitor';

// GET — règles publiques de livraison (seuil automatique de livraison offerte) pour l'affichage
async function GET_() {
  return NextResponse.json({ rules: await deliveryRules() });
}

// POST — vérifie un code saisi au paiement : code promo d'abord, sinon code parrainage.
// Le montant facturé est de toute façon recalculé à la commande (/api/orders).
async function POST_(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = cleanCode(body.code);
  if (code.length < 3) return NextResponse.json({ valid: false, reason: 'unknown' });
  const caller = await userFromRequest(request);
  const who = { userId: caller?.id || null, phone: cleanPhone(body.phone) };

  const promo = await findPromo(code);
  if (promo) {
    const c = await checkPromo(promo, who);
    if (!c.ok) return NextResponse.json({ valid: false, kind: 'promo', reason: c.reason });
    // Code sur les articles : montant concerné calculé ici (tous les articles, ou produits Hornafresh seulement)
    const items = Array.isArray(body.items) ? body.items.filter((i: any) => i && i.product_id != null).slice(0, 200) : [];
    if (c.benefit.kind !== 'free_delivery') c.benefit.eligible_subtotal = await eligibleSubtotal(items, c.benefit.products_scope);
    return NextResponse.json({ valid: true, kind: 'promo', promo: c.benefit });
  }
  const r = await checkReferral(code, who);
  return NextResponse.json(r.ok ? { valid: true, kind: 'referral' } : { valid: false, kind: 'referral', reason: r.reason });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/promo', GET_);
export const POST = monitored('/api/promo', POST_);
