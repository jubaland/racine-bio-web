// Achat groupé de démonstration, pour essayer le parcours en local.
//   node scripts/demo_campaign.mjs up     crée un producteur et une campagne ouverte « DÉMO »
//   node scripts/demo_campaign.mjs down   supprime tout ce qui est « DÉMO » (campagnes, réservations, producteur)
// ATTENTION : la base est celle de la production. Une campagne de démonstration ouverte est visible
// des vrais clients dès que le site en ligne contient les achats groupés. Faire « down » après l'essai.
// Les valeurs ci-dessous sont des exemples de démonstration, pas des tarifs.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const NAME = 'DÉMO';

async function down() {
  const { data: cs } = await db.from('campaigns').select('id').like('title', `${NAME} %`);
  for (const c of cs || []) {
    const { data: paid } = await db.from('campaign_orders').select('id, amount, refunded').eq('campaign_id', c.id).in('status', ['paid', 'delivered']);
    const owed = (paid || []).filter(o => Number(o.amount) > Number(o.refunded || 0));
    if (owed.length) { console.log(`⚠️ campagne ${c.id} : ${owed.length} réservation(s) payée(s) non remboursée(s). Annulez la campagne depuis l'admin avant de la supprimer.`); continue; }
    await db.from('campaigns').delete().eq('id', c.id);
    console.log('campagne supprimée', c.id);
  }
  const { data: s } = await db.from('suppliers').delete().like('name', `${NAME} %`).select('id');
  console.log('producteur(s) supprimé(s) :', (s || []).length);
}

async function up() {
  await down();
  const { data: s, error: e1 } = await db.from('suppliers').insert({ name: `${NAME} Ferme de Gabiley`, country: 'SO', region: 'Gabiley', currency: 'USD', payment_channel: 'Zaad', contact_name: 'Contact de démonstration' }).select().single();
  if (e1) throw e1;
  const closes = new Date(Date.now() + 5 * 86400000);
  const { data: c, error: e2 } = await db.from('campaigns').insert({
    supplier_id: s.id, title: `${NAME} Oignons rouges`, description: 'Campagne de démonstration : oignons rouges, récolte de la semaine.',
    unit_label: 'sac de 50 kg', unit_weight_kg: 50, currency: 'USD', supplier_unit_price: 20, exchange_rate: 178, transport_per_unit: 400, customs_per_unit: 140, loss_pct: 5,
    price_djf: 5500, min_units: 10, max_units: 40, closes_at: closes.toISOString(), eta_date: new Date(closes.getTime() + 4 * 86400000).toISOString().slice(0, 10),
    allow_delivery: true, allow_pickup: true, pickup_place: 'Dépôt Hornafresh (démonstration)', delivery_fee: 500, status: 'open',
    translations: { en: { title: `${NAME} Red onions`, unit_label: '50 kg bag', description: 'Demo campaign: red onions, harvested this week.' } },
  }).select().single();
  if (e2) throw e2;
  console.log(`campagne ouverte : http://localhost:3000/achats-groupes/${c.id}`);
}

const cmd = process.argv[2];
if (cmd === 'up') await up(); else if (cmd === 'down') await down(); else console.log('usage : node scripts/demo_campaign.mjs up|down');
