// Test non destructif des achats groupés (phase 28). Serveur local requis (port 3000).
// Producteur, campagnes et comptes temporaires, supprimés à la fin. Aucun e-mail n'est envoyé.
// Vérifie : calculs (coût, prix conseillé, prorata), droits, fiche de coût jamais publique, réservation
// (cagnotte, Waafi déclaré), capacité et limites, seuil non atteint (remboursement), seuil atteint,
// réception avec manque (prorata et remboursement), distribution, paiement du producteur, annulation.
//   node scripts/phase28_test_campaigns.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { unitCost, suggestedPrice, marginOf, progress, allocate, supplierDue } from '../lib/campaign-math.ts';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = process.argv[2] || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label} ${extra}`); } };
const stamp = Date.now();
const TAG = `TEST-AG-${stamp}`;
const state = { users: [], supplier: null, campaigns: [], startedAt: new Date().toISOString() };

const tokenFor = async (email) => {
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: v } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  return v.session.access_token;
};
const api = async (path, token, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* ignore */ }
  return { status: r.status, j };
};
const mkUser = async (tag, balance) => {
  const email = `test-ag-${tag}-${stamp}@example.com`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: `Tmp-${stamp}!${tag}`, email_confirm: true, user_metadata: { full_name: `Test AG ${tag.toUpperCase()}`, phone: '77000000' } });
  if (error) throw error;
  state.users.push(u.user.id);
  if (balance) await admin.rpc('wallet_adjust', { p_user: u.user.id, p_amount: balance, p_type: 'deposit', p_order: null, p_note: TAG });
  return { id: u.user.id, email, token: await tokenFor(email) };
};
const balanceOf = async (u) => Number((await admin.from('wallets').select('balance').eq('user_id', u.id).maybeSingle()).data?.balance) || 0;
const ordersOf = async (cid) => (await admin.from('campaign_orders').select('*').eq('campaign_id', cid).order('id')).data || [];
const campaignRow = async (cid) => (await admin.from('campaigns').select('*').eq('id', cid).single()).data;
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

try {
  console.log('\n1) Calculs');
  const sheet = { supplier_unit_price: 20, exchange_rate: 178, transport_per_unit: 400, customs_per_unit: 140, other_per_unit: 0, loss_pct: 10 };
  const cost = unitCost(sheet);
  ok(cost.purchase === 3560 && cost.landed === 4100 && cost.cost === 4556 && cost.loss === 456, 'coût rendu : achat 3 560, rendu 4 100, avec 10 % de pertes 4 556', JSON.stringify(cost));
  ok(suggestedPrice(sheet, 20) === 5695 && suggestedPrice(sheet, '') === null && suggestedPrice(sheet, 100) === null, 'prix conseillé pour 20 % de marge : 5 695 ; sans marge définie : aucun');
  const mg = marginOf(sheet, 6000);
  ok(mg.amount === 1444 && mg.pct === 24.1, 'marge à 6 000 Fdj : 1 444 Fdj, 24,1 %', JSON.stringify(mg));
  ok(unitCost({ supplier_unit_price: '', exchange_rate: null }).cost === 0, 'fiche vide : coût nul, aucune erreur');
  const pg = progress(7, 10, 12);
  ok(pg.pct === 70 && pg.missing === 3 && !pg.reached && pg.available === 5 && progress(15, 10).pct === 100 && progress(10, 10).reached, 'avancement vers le seuil');
  const al = allocate([{ id: 1, units: 5, created_at: '1' }, { id: 2, units: 3, created_at: '2' }, { id: 3, units: 2, created_at: '3' }], 7);
  ok(al[1] + al[2] + al[3] === 7 && al[1] <= 5 && al[2] <= 3 && al[3] <= 2 && al[1] >= 3, 'prorata : 7 reçus pour 10 réservés, total exact, personne ne dépasse sa réservation', JSON.stringify(al));
  const al0 = allocate([{ id: 1, units: 2 }, { id: 2, units: 2 }], 0), alAll = allocate([{ id: 1, units: 2 }, { id: 2, units: 3 }], 9);
  ok(al0[1] === 0 && al0[2] === 0 && alAll[1] === 2 && alAll[2] === 3, 'prorata : rien reçu, ou plus que réservé');
  ok(JSON.stringify(allocate([{ id: 1, units: 1, created_at: 'a' }, { id: 2, units: 1, created_at: 'b' }], 1)) === '{"1":1,"2":0}', 'prorata : à égalité, la réservation la plus ancienne est servie');
  ok(supplierDue(20, 12) === 240 && supplierDue('', 5) === 0, 'montant dû au producteur en devise');

  const A = await mkUser('a', 50000), B = await mkUser('b', 3000), C = await mkUser('c', 40000);
  const adminToken = await tokenFor('wilsandj@hotmail.com');
  await api('/api/lang', A.token, { lang: 'en' });     // le client A reçoit ses messages en anglais
  const adm = (body) => api('/api/admin/campaigns', adminToken, body);
  const cli = (u, body) => api('/api/campaigns', u.token, body);

  console.log('\n2) Droits et producteur');
  let r = await api('/api/admin/campaigns', A.token);
  ok(r.status === 401 || r.status === 403, 'un client n\'accède pas à l\'admin des achats groupés', String(r.status));
  r = await api('/api/admin/campaigns', A.token, { action: 'save_supplier', name: 'Pirate', country: 'SO', currency: 'USD' });
  ok(r.status === 401 || r.status === 403, 'un client ne peut pas créer de producteur', String(r.status));
  r = await adm({ action: 'save_supplier', name: '', country: 'SO', currency: 'USD' });
  ok(r.status === 400 && r.j.field === 'name', 'producteur sans nom refusé', JSON.stringify(r.j));
  r = await adm({ action: 'save_supplier', name: `${TAG} Ferme`, country: 'SO', currency: 'EUR' });
  ok(r.status === 400 && r.j.field === 'currency', 'devise inconnue refusée', JSON.stringify(r.j));
  r = await adm({ action: 'save_supplier', name: `${TAG} Ferme`, country: 'SO', region: 'Gabiley', currency: 'USD', payment_channel: 'Zaad', whatsapp: '+252630000000' });
  ok(r.status === 200 && r.j.supplier?.id, 'producteur du Somaliland créé', JSON.stringify(r.j));
  state.supplier = r.j.supplier.id;

  console.log('\n3) Campagne : contrôles à la saisie');
  const base = { supplier_id: state.supplier, title: `${TAG} Oignons`, unit_label: 'sac de 50 kg', unit_weight_kg: 50, ...sheet, price_djf: 6000,
    min_units: 10, max_units: 12, max_units_per_client: 8, closes_at: inDays(5), eta_date: inDays(9).slice(0, 10), allow_delivery: true, allow_pickup: true, pickup_place: 'Dépôt de test', delivery_fee: 500, supplier_deposit_pct: 50,
    translations: { en: { title: `${TAG} Onions`, unit_label: '50 kg bag' }, so: { title: `${TAG} Basal`, unit_label: 'jawaan 50 kg' } } };
  for (const [patch, field, label] of [
    [{ price_djf: '' }, 'price_djf', 'sans prix de vente'], [{ exchange_rate: 0 }, 'exchange_rate', 'taux de change nul'], [{ min_units: '' }, 'min_units', 'sans seuil'],
    [{ max_units: 5 }, 'max_units', 'plafond inférieur au seuil'], [{ closes_at: new Date(Date.now() - 60000).toISOString() }, 'closes_at', 'date limite déjà passée'], [{ closes_at: '' }, 'closes_at', 'sans date limite'], [{ eta_date: '2020-01-01' }, 'eta_date', 'arrivée avant la clôture'],
    [{ pickup_place: '' }, 'pickup_place', 'retrait sans lieu'], [{ allow_delivery: false, allow_pickup: false }, 'allow_delivery', 'ni livraison ni retrait'], [{ unit_label: '' }, 'unit_label', 'sans unité de vente'],
  ]) {
    r = await adm({ action: 'save_campaign', ...base, ...patch });
    ok(r.status === 400 && r.j.field === field, `refusé : ${label}`, JSON.stringify(r.j));
  }
  r = await adm({ action: 'save_campaign', ...base });
  const K1 = r.j.campaign?.id; state.campaigns.push(K1);
  ok(r.status === 200 && K1 && r.j.campaign.status === 'draft' && r.j.campaign.cost.cost === 4556 && r.j.campaign.margin.amount === 1444 && r.j.campaign.translations?.aa?.title === `${TAG} Basal` && r.j.campaign.translations?.en?.unit_label === '50 kg bag', 'campagne créée en brouillon, coût et marge calculés, afar aligné sur le somali', JSON.stringify(r.j.campaign?.cost));

  console.log('\n4) Visibilité');
  r = await api('/api/campaigns', null);
  ok(r.status === 200 && !(r.j.campaigns || []).some(c => c.id === K1), 'brouillon invisible du public');
  r = await api(`/api/campaigns?id=${K1}`, null);
  ok(r.status === 404, 'brouillon introuvable par son adresse', String(r.status));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 404, 'réservation impossible sur un brouillon', String(r.status));
  r = await adm({ action: 'open', id: K1 });
  ok(r.status === 200, 'campagne ouverte');
  r = await api(`/api/campaigns?id=${K1}`, null);
  const pub = r.j.campaign;
  ok(r.status === 200 && pub?.price_djf === 6000 && pub.supplier?.region === 'Gabiley' && pub.can_reserve === true && pub.progress.pct === 0, 'campagne visible : prix, origine, avancement', JSON.stringify(pub?.progress));
  const leaked = ['supplier_unit_price', 'exchange_rate', 'transport_per_unit', 'customs_per_unit', 'loss_pct', 'supplier_deposit_pct', 'cost', 'margin', 'supplier_id'].filter(k => JSON.stringify(r.j).includes(`"${k}"`));
  ok(leaked.length === 0, 'fiche de coût jamais envoyée au public (prix du producteur, frais, marge)', JSON.stringify(leaked));
  const direct = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${A.token}` } } });
  const { data: peek } = await direct.from('campaigns').select('id, supplier_unit_price').eq('id', K1);
  const { data: peekS } = await direct.from('suppliers').select('id').eq('id', state.supplier);
  ok((peek || []).length === 0 && (peekS || []).length === 0, 'lecture directe de la base refusée à un client (campagnes, producteurs)', JSON.stringify([peek, peekS]));

  console.log('\n5) Réservation');
  r = await api('/api/campaigns', null, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 401, 'sans connexion : refusé', String(r.status));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 0, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 400, 'quantité nulle refusée', String(r.status));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1.5, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 400, 'demi-unité refusée', String(r.status));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'cash' });
  ok(r.status === 400 && r.j.error === 'invalid_payment', 'paiement en espèces refusé (paiement ferme à la réservation)', JSON.stringify(r.j));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'delivery', payment_method: 'wallet' });
  ok(r.status === 400 && r.j.error === 'address_required', 'livraison sans adresse refusée', JSON.stringify(r.j));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'company_wallet' });
  ok(r.status === 403, 'cagnotte de société refusée à un particulier', String(r.status));
  r = await cli(B, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 402 && r.j.error === 'insufficient' && (await ordersOf(K1)).length === 0 && await balanceOf(B) === 3000, 'solde insuffisant : refusé, rien réservé, rien débité', JSON.stringify(r.j));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 5, delivery_mode: 'delivery', address: 'Quartier test', payment_method: 'wallet', lang: 'en' });
  ok(r.status === 200 && r.j.status === 'paid' && r.j.amount === 30500 && await balanceOf(A) === 19500, 'réservation payée : 5 sacs + livraison = 30 500 Fdj débités', JSON.stringify(r.j));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 4, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 409 && r.j.error === 'client_limit' && r.j.available === 3, 'limite par client : 3 encore possibles', JSON.stringify(r.j));
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 3, delivery_mode: 'pickup', payment_method: 'waafi', reference: '' });
  ok(r.status === 400 && r.j.error === 'reference_required', 'Waafi sans référence refusé', JSON.stringify(r.j));
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 3, delivery_mode: 'pickup', payment_method: 'waafi', reference: `${TAG}-REF` });
  const waafiOrder = r.j.order_id;
  ok(r.status === 200 && r.j.status === 'pending_payment' && await balanceOf(C) === 40000, 'Waafi déclaré : en attente de confirmation, cagnotte intacte', JSON.stringify(r.j));
  r = await api(`/api/campaigns?id=${K1}`, C.token);
  ok(r.j.campaign.progress.units === 5 && r.j.campaign.pending_units === 3 && r.j.campaign.available_units === 4 && r.j.mine.length === 1, 'seuil : 5 payés ; capacité : 8 pris sur 12 ; le client voit sa réservation', JSON.stringify({ p: r.j.campaign.progress.units, w: r.j.campaign.pending_units, a: r.j.campaign.available_units }));
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 5, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 409 && r.j.error === 'full' && r.j.available === 4 && await balanceOf(C) === 40000, 'capacité dépassée : refusé, 4 sacs encore disponibles', JSON.stringify(r.j));
  r = await api('/api/admin/campaigns', A.token, { action: 'confirm_payment', order_id: waafiOrder });
  ok(r.status === 401 || r.status === 403, 'un client ne confirme pas un paiement', String(r.status));
  r = await adm({ action: 'confirm_payment', order_id: waafiOrder });
  ok(r.status === 200 && (await ordersOf(K1)).find(o => o.id === waafiOrder).status === 'paid', 'paiement Waafi confirmé par l\'admin');
  r = await adm({ action: 'confirm_payment', order_id: waafiOrder });
  ok(r.status === 409, 'double confirmation refusée', String(r.status));

  console.log('\n6) Groupe');
  r = await cli(A, { action: 'new_group', campaign_id: K1 });
  const code = r.j.code;
  ok(r.status === 200 && /^[0-9a-f]{10}$/.test(code), 'code d\'invitation créé', JSON.stringify(r.j));
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'group', group: code, payment_method: 'wallet' });
  ok(r.status === 404 && r.j.error === 'group_not_found', 'rejoindre un groupe sans hôte : refusé', JSON.stringify(r.j));
  r = await cli(A, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', group: code, payment_method: 'wallet' });
  ok(r.status === 200, 'l\'hôte réserve dans son groupe');
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'group', group: code, payment_method: 'wallet' });
  ok(r.status === 200 && r.j.amount === 6000, 'un invité rejoint le groupe, sans frais de livraison', JSON.stringify(r.j));
  r = await api(`/api/campaigns?id=${K1}&g=${code}`, B.token);
  ok(r.j.group?.units === 2 && r.j.group.members.length === 2 && r.j.group.members.every(m => m.name === 'Test') && !JSON.stringify(r.j.group).includes('@'), 'groupe : prénoms et quantités seulement', JSON.stringify(r.j.group));

  console.log('\n7) Annulation par le client, prix verrouillé');
  const cOrders = (await ordersOf(K1)).filter(o => o.user_id === C.id && o.delivery_mode === 'group');
  r = await cli(A, { action: 'cancel', order_id: cOrders[0].id });
  ok(r.status === 404, 'on n\'annule pas la réservation d\'un autre', String(r.status));
  const before = await balanceOf(C);
  r = await cli(C, { action: 'cancel', order_id: cOrders[0].id });
  ok(r.status === 200 && r.j.refunded === 6000 && await balanceOf(C) === before + 6000, 'annulation : 6 000 Fdj recrédités sur la cagnotte', JSON.stringify(r.j));
  r = await cli(C, { action: 'cancel', order_id: cOrders[0].id });
  ok(r.status === 409 && await balanceOf(C) === before + 6000, 'seconde annulation refusée, pas de double remboursement', String(r.status));
  r = await adm({ action: 'save_campaign', id: K1, ...base, price_djf: 9000 });
  ok(r.status === 409 && r.j.error === 'locked_after_orders', 'prix non modifiable une fois des clients engagés', JSON.stringify(r.j));
  r = await adm({ action: 'save_campaign', id: K1, ...base, max_units: 10 });
  ok(r.status === 200, 'plafond ajustable tant qu\'il couvre les réservations', JSON.stringify(r.j));

  console.log('\n8) Seuil non atteint : tout le monde est remboursé');
  r = await adm({ action: 'save_campaign', ...base, title: `${TAG} Pommes de terre`, min_units: 20, max_units: '', max_units_per_client: '' });
  const K2 = r.j.campaign.id; state.campaigns.push(K2);
  await adm({ action: 'open', id: K2 });
  const a0 = await balanceOf(A);
  await cli(A, { action: 'reserve', campaign_id: K2, units: 2, delivery_mode: 'pickup', payment_method: 'wallet' });
  await cli(C, { action: 'reserve', campaign_id: K2, units: 1, delivery_mode: 'pickup', payment_method: 'waafi', reference: `${TAG}-R2` });
  ok(await balanceOf(A) === a0 - 12000, 'deux sacs réservés et payés');
  r = await api(`/api/campaigns`, null);   // la lecture publique ne clôture rien avant la date limite
  ok((await campaignRow(K2)).status === 'open', 'avant la date limite : la campagne reste ouverte');
  await admin.from('campaigns').update({ closes_at: new Date(Date.now() - 60000).toISOString() }).eq('id', K2);
  r = await cli(B, { action: 'reserve', campaign_id: K2, units: 1, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 409 && r.j.error === 'closed', 'date limite passée : réservation refusée', JSON.stringify(r.j));
  await api('/api/campaigns', null);        // la première lecture après la date limite clôture la campagne
  const k2 = await campaignRow(K2), o2 = await ordersOf(K2);
  ok(k2.status === 'failed' && await balanceOf(A) === a0 && o2.every(o => ['refunded', 'cancelled'].includes(o.status)), 'seuil non atteint : campagne close, client remboursé, paiement en attente retiré', JSON.stringify({ s: k2.status, o: o2.map(o => o.status) }));
  await api('/api/campaigns', null);
  ok(await balanceOf(A) === a0, 'clôture rejouée : pas de second remboursement');
  r = await api('/api/campaigns', null);
  ok(!(r.j.campaigns || []).some(c => c.id === K2), 'campagne non déclenchée retirée de la liste');

  console.log('\n9) Seuil atteint : commande, transport, réception');
  await adm({ action: 'save_campaign', id: K1, ...base, min_units: 9, max_units: 12 });
  r = await adm({ action: 'set_status', id: K1, status: 'ordered' });
  ok(r.status === 409, 'on ne saute pas d\'étape (commander avant la clôture)', String(r.status));
  r = await adm({ action: 'pay_supplier', id: K1, kind: 'deposit', amount_currency: 50, exchange_rate: 178 });
  ok(r.status === 409, 'pas de paiement au producteur avant la clôture', String(r.status));
  r = await cli(C, { action: 'reserve', campaign_id: K1, units: 1, delivery_mode: 'pickup', payment_method: 'waafi', reference: `${TAG}-LATE` });
  r = await adm({ action: 'close_now', id: K1 });
  let k1 = await campaignRow(K1), o1 = await ordersOf(K1);
  ok(r.status === 200 && r.j.status === 'closed' && k1.ordered_units === 9 && o1.filter(o => o.status === 'paid').length === 3 && o1.some(o => o.payment_reference === `${TAG}-LATE` && o.status === 'cancelled'), 'clôture : seuil atteint, 9 sacs à commander, paiement non confirmé retiré', JSON.stringify({ r: r.j, u: k1.ordered_units }));
  r = await cli(C, { action: 'cancel', order_id: waafiOrder });
  ok(r.status === 409 && r.j.error === 'too_late', 'après la clôture, le client ne peut plus annuler', JSON.stringify(r.j));
  r = await adm({ action: 'pay_supplier', id: K1, kind: 'deposit', amount_currency: 90, exchange_rate: 178, method: 'Zaad', reference: `${TAG}-PAY1` });
  ok(r.status === 200 && r.j.payment.amount_djf === 16020 && r.j.payment.currency === 'USD', 'acompte au producteur : 90 USD au taux 178 = 16 020 Fdj', JSON.stringify(r.j.payment));
  r = await adm({ action: 'receive', id: K1, received_units: 7 });
  ok(r.status === 409, 'réception impossible avant la commande', String(r.status));
  r = await adm({ action: 'set_status', id: K1, status: 'ordered' });
  r = await adm({ action: 'set_status', id: K1, status: 'in_transit' });
  ok(r.status === 200 && (await campaignRow(K1)).status === 'in_transit', 'commandé, puis en transit');
  const balA = await balanceOf(A), balC = await balanceOf(C);
  r = await adm({ action: 'receive', id: K1, received_units: 7 });
  o1 = (await ordersOf(K1)).filter(o => ['paid', 'refunded'].includes(o.status) && o.final_units != null && o.payment_reference !== `${TAG}-LATE` && o.delivery_mode !== 'group');
  const got = o1.reduce((s, o) => s + o.final_units, 0);
  ok(r.status === 200 && r.j.reserved === 9 && got === 7 && o1.every(o => o.final_units <= o.units), 'réception : 7 sacs pour 9 réservés, répartis au prorata', JSON.stringify(o1.map(o => [o.units, o.final_units])));
  const backA = (await balanceOf(A)) - balA, backC = (await balanceOf(C)) - balC;
  ok(backA + backC === 2 * 6000 && r.j.refunded_amount === 12000, 'deux sacs manquants remboursés : 12 000 Fdj', JSON.stringify({ backA, backC }));
  r = await adm({ action: 'receive', id: K1, received_units: 9 });
  ok(r.status === 409, 'seconde réception refusée', String(r.status));

  console.log('\n10) Distribution, solde du producteur, fin');
  r = await adm({ action: 'set_status', id: K1, status: 'distributing' });
  ok(r.status === 200, 'distribution lancée');
  r = await adm({ action: 'set_status', id: K1, status: 'done' });
  ok(r.status === 409 && r.j.error === 'orders_not_delivered', 'fin refusée tant qu\'il reste des réservations à remettre', JSON.stringify(r.j));
  for (const o of (await ordersOf(K1)).filter(x => x.status === 'paid')) await adm({ action: 'deliver', order_id: o.id });
  r = await adm({ action: 'pay_supplier', id: K1, kind: 'balance', amount_currency: 50, exchange_rate: 180, reference: `${TAG}-PAY2` });
  r = await api(`/api/admin/campaigns?id=${K1}`, adminToken);
  const s = r.j.summary;
  ok(s.units === 7 && s.supplier.due_currency === 140 && s.supplier.paid_currency === 140 && s.supplier.balance_currency === 0 && s.supplier.paid_djf === 16020 + 9000, 'bilan : 7 sacs, 140 USD dus et payés au producteur, taux de chaque paiement conservé', JSON.stringify(s.supplier));
  ok(s.net_sales === s.collected - s.refunded && s.net_sales === 7 * 6000 + 500 && s.expected_margin === 7 * 1444, 'bilan : ventes nettes 42 500 Fdj, marge prévue 10 108 Fdj', JSON.stringify({ n: s.net_sales, m: s.expected_margin }));
  r = await adm({ action: 'set_status', id: K1, status: 'done' });
  ok(r.status === 200 && (await campaignRow(K1)).status === 'done', 'campagne terminée');
  r = await adm({ action: 'cancel', id: K1 });
  ok(r.status === 409, 'une campagne terminée ne s\'annule plus', String(r.status));

  console.log('\n11) Annulation par l\'admin');
  r = await adm({ action: 'save_campaign', ...base, title: `${TAG} Oranges`, min_units: 2, max_units: '', audience: 'pro' });
  const K3 = r.j.campaign.id; state.campaigns.push(K3);
  await adm({ action: 'open', id: K3 });
  r = await cli(A, { action: 'reserve', campaign_id: K3, units: 1, delivery_mode: 'pickup', payment_method: 'wallet' });
  ok(r.status === 403 && r.j.error === 'pro_only', 'campagne réservée aux professionnels : particulier refusé', JSON.stringify(r.j));
  await admin.from('campaigns').update({ audience: 'all' }).eq('id', K3);
  const a3 = await balanceOf(A);
  await cli(A, { action: 'reserve', campaign_id: K3, units: 2, delivery_mode: 'delivery', address: 'Quartier test', payment_method: 'wallet' });
  await adm({ action: 'close_now', id: K3 });
  r = await adm({ action: 'cancel', id: K3, note: 'route fermée' });
  ok(r.status === 200 && r.j.refunds.refunded === 1 && r.j.refunds.amount === 12500 && await balanceOf(A) === a3 && (await campaignRow(K3)).status === 'cancelled', 'annulation après clôture : client remboursé en totalité, livraison comprise', JSON.stringify(r.j.refunds));
  const { data: notes } = await admin.from('user_notifications').select('title, body').eq('user_id', A.id);
  ok((notes || []).some(n => /Reservation|reserved|booked/i.test(n.title + n.body)) && (notes || []).every(n => !/\{\w+\}/.test(n.title + n.body)), 'client anglophone : messages en anglais, paramètres remplis', JSON.stringify((notes || []).map(n => n.title)));
} catch (e) {
  fail++; console.error('\n💥 Erreur inattendue :', e);
} finally {
  console.log('\nNettoyage…');
  try {
    for (const id of state.campaigns.filter(Boolean)) await admin.from('campaigns').delete().eq('id', id);
    await admin.from('campaigns').delete().like('title', 'TEST-AG-%');
    if (state.supplier) await admin.from('suppliers').delete().eq('id', state.supplier);
    await admin.from('suppliers').delete().like('name', 'TEST-AG-%');
    await admin.from('admin_notifications').delete().like('title', '🌍 Achat groupé%').like('body', '%TEST-AG-%');
    await admin.from('admin_notifications').delete().like('title', '🌍 Achat groupé%').like('body', 'Test AG%');
    for (const id of state.users) {
      await admin.from('wallet_transactions').delete().eq('user_id', id);
      await admin.from('wallets').delete().eq('user_id', id);
      await admin.from('user_notifications').delete().eq('user_id', id);
      await admin.from('user_prefs').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      ok(!error, 'compte temporaire supprimé', error?.message);
    }
    const left = (await admin.from('campaigns').select('id', { count: 'exact', head: true }).like('title', 'TEST-AG-%')).count;
    ok(left === 0, 'campagnes de test supprimées', String(left));
  } catch (e) { fail++; console.error('Nettoyage incomplet :', e); }
  console.log(`\n${pass} réussis, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
}
