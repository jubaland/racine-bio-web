// Jeu de démonstration TEMPORAIRE pour vérifier visuellement les comptes entreprise (compte de test Zak).
//   node scripts/demo_company.mjs up    → société active, 2 sites, cagnotte 25 000, 1 commande, 1 demande à valider
//   node scripts/demo_company.mjs down  → supprime tout
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ZAK = '62f9913f-7356-49fd-ae88-048b6dc41883';
const NAME = 'DEMO Restaurant Le Palmier';

const { data: existing } = await admin.from('companies').select('id').eq('name', NAME);
for (const c of existing || []) {
  const { data: orders } = await admin.from('orders').select('id').eq('company_id', c.id);
  for (const o of orders || []) { await admin.from('order_items').delete().eq('order_id', o.id); await admin.from('orders').delete().eq('id', o.id); }
  await admin.from('companies').delete().eq('id', c.id);
}
if (process.argv[2] !== 'up') { console.log('fixture supprimée'); process.exit(0); }

const { data: co } = await admin.from('companies').insert({ name: NAME, activity: 'Restaurant / café / traiteur', phone: '25377000001', address: 'Quartier 4, rue de la Paix, Djibouti-Ville', status: 'active', approval_threshold: 20000, created_by: ZAK }).select().single();
await admin.from('company_members').insert({ company_id: co.id, user_id: ZAK, role: 'manager', email: 'zak@yahoo.fr', full_name: 'Zak' });
const { data: sites } = await admin.from('company_sites').insert([
  { company_id: co.id, label: 'Cuisine centrale', recipient_name: 'Chef Omar', phone: '77000001', address: 'Quartier 4, rue de la Paix, Djibouti-Ville', is_default: true },
  { company_id: co.id, label: 'Annexe Héron', recipient_name: 'Fatouma', phone: '77000002', address: 'Héron, avenue Cheikh Houmed', is_default: false },
]).select();
await admin.rpc('company_wallet_adjust', { p_company: co.id, p_amount: 25000, p_type: 'deposit', p_order: null, p_user: ZAK, p_note: 'Recharge validée (waafi, réf. DEMO)' });
const { data: prod } = await admin.from('products').select('id, name, price, unit').is('owner_id', null).eq('status', 'published').eq('is_bundle', false).gt('stock_qty', 3).limit(1).single();
await admin.from('company_order_requests').insert({ company_id: co.id, user_id: ZAK, site_id: sites[1].id, total: Number(prod.price) * 3, items: [{ product_id: prod.id, quantity: 3, price: prod.price, product_name: prod.name, product_unit: prod.unit }], delivery: { fee: 0 } });
await admin.from('company_deposit_requests').insert({ company_id: co.id, user_id: ZAK, amount: 15000, method: 'transfer', reference: 'DEMO-VIR-01' });
await admin.from('company_invites').insert({ company_id: co.id, email: 'comptable-demo@example.com', role: 'accountant', invited_by: ZAK });
console.log(JSON.stringify({ company: co.id, sites: sites.map(s => s.id) }));
