// ── Achats groupés : calculs purs (utilisables côté client, serveur et tests) ─
// Aucun chiffre ici : tout vient de la fiche de la campagne.

export type CostInput = {
  supplier_unit_price: number | string | null;   // prix du producteur, dans sa devise, par unité de vente
  exchange_rate: number | string | null;         // Fdj pour 1 unité de devise
  transport_per_unit?: number | string | null;   // Fdj
  customs_per_unit?: number | string | null;     // Fdj
  other_per_unit?: number | string | null;       // Fdj
  loss_pct?: number | string | null;             // provision pour pertes, en % du coût rendu
};
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const round = (v: number) => Math.round(v);

/** Coût rendu à Djibouti d'une unité de vente, en Fdj entiers, et son détail. */
export function unitCost(c: CostInput) {
  const purchase = n(c.supplier_unit_price) * n(c.exchange_rate);
  const landed = purchase + n(c.transport_per_unit) + n(c.customs_per_unit) + n(c.other_per_unit);
  // Provision pour pertes : si une part p de la marchandise est perdue, chaque unité vendue porte landed / (1 − p)
  const p = Math.min(Math.max(n(c.loss_pct), 0), 99.99) / 100;
  const withLoss = landed / (1 - p);
  return { purchase: round(purchase), landed: round(landed), loss: round(withLoss - landed), cost: round(withLoss) };
}

/** Prix de vente conseillé pour une marge voulue (en % du prix de vente). null si la marge n'est pas définie. */
export function suggestedPrice(c: CostInput, marginPct: number | string | null | undefined): number | null {
  if (marginPct === '' || marginPct == null) return null;
  const m = n(marginPct);
  if (m < 0 || m >= 100) return null;
  return round(unitCost(c).cost / (1 - m / 100));
}

/** Marge d'un prix de vente : montant par unité et part du prix. */
export function marginOf(c: CostInput, price: number | string | null) {
  const cost = unitCost(c).cost, p = n(price);
  return { amount: round(p - cost), pct: p > 0 ? Math.round(((p - cost) / p) * 1000) / 10 : null };
}

/** Avancement d'une campagne vers son seuil. */
export function progress(units: number, min: number, max?: number | null) {
  const u = Math.max(0, n(units)), m = Math.max(1, n(min));
  return {
    units: u, min: m, max: max ?? null,
    reached: u >= m,
    missing: Math.max(0, m - u),
    pct: Math.min(100, Math.round((u / m) * 100)),
    available: max != null ? Math.max(0, n(max) - u) : null,
  };
}

/**
 * Répartition d'une quantité reçue inférieure à la quantité réservée : au prorata, en unités entières
 * (plus fort reste), sans jamais dépasser la réservation de chacun. À égalité de reste, la réservation
 * la plus ancienne est servie d'abord. Renvoie { id → unités attribuées }.
 */
export function allocate(orders: { id: number; units: number; created_at?: string }[], received: number): Record<number, number> {
  const total = orders.reduce((s, o) => s + o.units, 0);
  const out: Record<number, number> = {};
  const got = Math.max(0, Math.floor(n(received)));
  if (got >= total) { for (const o of orders) out[o.id] = o.units; return out; }
  let given = 0;
  const parts = orders.map(o => {
    const exact = total > 0 ? (o.units * got) / total : 0;
    const base = Math.floor(exact);
    given += base; out[o.id] = base;
    return { o, rest: exact - base };
  });
  parts.sort((a, b) => b.rest - a.rest || String(a.o.created_at || '').localeCompare(String(b.o.created_at || '')) || a.o.id - b.o.id);
  for (const p of parts) { if (given >= got) break; if (out[p.o.id] < p.o.units) { out[p.o.id]++; given++; } }
  return out;
}

/** Montant dû au producteur pour une quantité, dans sa devise. */
export const supplierDue = (supplierUnitPrice: number | string | null, units: number | null | undefined) => Math.round(n(supplierUnitPrice) * n(units) * 100) / 100;

export const CAMPAIGN_STATUSES = ['draft', 'open', 'closed', 'failed', 'ordered', 'in_transit', 'arrived', 'distributing', 'done', 'cancelled'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];
/** Étapes suivantes permises (le remboursement intégral passe par l'annulation). */
export const NEXT_STATUS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['open', 'cancelled'], open: ['closed', 'failed', 'cancelled'], closed: ['ordered', 'cancelled'], failed: [],
  ordered: ['in_transit', 'cancelled'], in_transit: ['arrived', 'cancelled'], arrived: ['distributing', 'cancelled'],
  distributing: ['done'], done: [], cancelled: [],
};
