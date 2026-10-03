import { supabaseAdmin } from './supabase-admin';
import { type CreditAccount, type CreditEntry, type CreditSettings, type CreditSummary, CREDIT_DEFAULTS, fdj, todayStr, daysBetween, dateFr, dueDateFor, summarize } from './credit-math';
export type { CreditAccount, CreditEntry, CreditSettings, CreditSummary, CreditTerm, OpenCharge } from './credit-math';
export { CREDIT_DEFAULTS, fdj, todayStr, dateFr, dueDateFor, summarize } from './credit-math';
const KEYS = ['credit.enabled', 'credit.remind_before_days', 'credit.overdue_remind_days', 'credit.suspend_after_days', 'credit.default_limit', 'credit.default_term', 'credit.default_term_days'];


// ── Crédit client (« carnet ») ──────────────────────────────────────────────────────────────
// Une ligne de crédit par client ou société, activée par l'admin : plafond, échéance (fin de mois
// ou N jours), statut. Chaque commande « à crédit » inscrit une charge avec sa date limite ; les
// paiements reçus sont affectés aux charges les plus anciennes (credit_pay) ; une annulation ou
// une remise réduit la charge (credit_refund). Rappels et suspension automatiques : creditDaily().
// Tous les délais sont des réglages (credit.*), rien n'est en dur.

export async function creditSettings(): Promise<CreditSettings> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num, value_text').in('key', KEYS);
  const v: Record<string, any> = Object.fromEntries((data || []).map((r: any) => [r.key, r.value_num ?? r.value_text ?? null]));
  const num = (k: string, def: number) => v[k] != null && Number(v[k]) >= 0 ? Math.round(Number(v[k])) : def;
  return {
    enabled: (v['credit.enabled'] ?? 1) == 1,
    remind_before_days: num('credit.remind_before_days', CREDIT_DEFAULTS.remind_before_days),
    overdue_remind_days: num('credit.overdue_remind_days', CREDIT_DEFAULTS.overdue_remind_days),
    suspend_after_days: num('credit.suspend_after_days', CREDIT_DEFAULTS.suspend_after_days),
    default_limit: v['credit.default_limit'] != null && Number(v['credit.default_limit']) > 0 ? Math.round(Number(v['credit.default_limit'])) : null,
    default_term: v['credit.default_term'] === 'days' ? 'days' : 'month_end',
    default_term_days: num('credit.default_term_days', CREDIT_DEFAULTS.default_term_days) || CREDIT_DEFAULTS.default_term_days,
  };
}
export async function saveCreditSettings(s: Partial<CreditSettings>) {
  const now = new Date().toISOString();
  const rows: any[] = [];
  const put = (key: string, value_num: number | null, value_text: string | null = null) => rows.push({ key, value_num, value_text, updated_at: now });
  if (s.enabled != null) put('credit.enabled', s.enabled ? 1 : 0);
  if (s.remind_before_days != null) put('credit.remind_before_days', s.remind_before_days);
  if (s.overdue_remind_days != null) put('credit.overdue_remind_days', s.overdue_remind_days);
  if (s.suspend_after_days != null) put('credit.suspend_after_days', s.suspend_after_days);
  if ('default_limit' in s) put('credit.default_limit', s.default_limit ?? null);
  if (s.default_term != null) put('credit.default_term', null, s.default_term);
  if (s.default_term_days != null) put('credit.default_term_days', s.default_term_days);
  if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
}

export async function accountOfUser(userId: string | null | undefined): Promise<CreditAccount | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from('credit_accounts').select('*').eq('user_id', userId).maybeSingle();
  return (data as CreditAccount) || null;
}
export async function accountOfCompany(companyId: number | null | undefined): Promise<CreditAccount | null> {
  if (!companyId) return null;
  const { data } = await supabaseAdmin.from('credit_accounts').select('*').eq('company_id', companyId).maybeSingle();
  return (data as CreditAccount) || null;
}
export async function accountById(id: number): Promise<CreditAccount | null> {
  const { data } = await supabaseAdmin.from('credit_accounts').select('*').eq('id', id).maybeSingle();
  return (data as CreditAccount) || null;
}

export async function entriesOf(accountId: number, limit = 200): Promise<CreditEntry[]> {
  const { data } = await supabaseAdmin.from('credit_entries').select('*').eq('account_id', accountId).order('created_at', { ascending: false }).limit(limit);
  return (data || []) as CreditEntry[];
}

export async function summaryOf(account: CreditAccount, day = todayStr()): Promise<CreditSummary> {
  const [entries, s] = await Promise.all([entriesOf(account.id, 1000), creditSettings()]);
  return summarize(account, entries, day, s.enabled);
}

export type ChargeCheck = { ok: true; due_at: string } | { ok: false; reason: 'disabled' | 'no_account' | 'suspended' | 'overdue' | 'limit'; available?: number };
/** Une commande de `amount` peut-elle être passée à crédit aujourd'hui ? */
export async function checkCharge(account: CreditAccount | null, amount: number, day = todayStr()): Promise<ChargeCheck> {
  const s = await creditSettings();
  if (!s.enabled) return { ok: false, reason: 'disabled' };
  if (!account) return { ok: false, reason: 'no_account' };
  if (account.status !== 'active') return { ok: false, reason: 'suspended' };
  const sum = await summaryOf(account, day);
  if (sum.overdue > 0) return { ok: false, reason: 'overdue' };
  if (amount > sum.available) return { ok: false, reason: 'limit', available: sum.available };
  return { ok: true, due_at: dueDateFor(account.term, account.term_days, day) };
}

/** Inscrit la commande sur le carnet. */
export async function chargeOrder(account: CreditAccount, orderId: number, amount: number, dueAt: string) {
  const { error } = await supabaseAdmin.from('credit_entries').insert({ account_id: account.id, type: 'charge', amount: Math.round(amount), order_id: orderId, due_at: dueAt, note: `Commande #${orderId}` });
  if (error) throw new Error(error.message);
}
/** Annulation ou remise sur une commande à crédit : la charge est réduite (réaffectation si déjà réglée). */
export async function refundOrder(orderId: number, amount: number, note: string) {
  const { data, error } = await supabaseAdmin.rpc('credit_refund', { p_order: orderId, p_amount: Math.round(amount), p_note: note });
  if (error) return { ok: false, reason: error.message };
  const r = Array.isArray(data) ? data[0] : data;
  return r?.ok ? { ok: true, account_id: Number(r.account_id) } : { ok: false, reason: r?.reason || 'unknown' };
}

/** Paiement reçu (espèces, Waafi…) : affecté aux charges les plus anciennes ; réactive un compte suspendu pour retard une fois à jour. */
export async function recordPayment(account: CreditAccount, amount: number, method: string, note: string | null, by: string | null) {
  const { data, error } = await supabaseAdmin.rpc('credit_pay', { p_account: account.id, p_amount: Math.round(amount), p_method: method, p_note: note, p_by: by });
  if (error) return { ok: false as const, reason: error.message };
  const r = Array.isArray(data) ? data[0] : data;
  if (!r?.ok) return { ok: false as const, reason: r?.reason || 'unknown' };
  let reactivated = false;
  const sum = await summaryOf(account);
  if (account.status === 'suspended' && account.auto_suspended && sum.overdue === 0) {
    await supabaseAdmin.from('credit_accounts').update({ status: 'active', auto_suspended: false, suspended_at: null, suspended_reason: null, updated_at: new Date().toISOString() }).eq('id', account.id);
    reactivated = true;
    await notifyHolder(account, { title: '✅ Crédit réactivé', body: 'Votre carnet est à jour : vous pouvez de nouveau commander à crédit.', url: '/profile', i18n: { key: 'credit.reactivated', params: {} } });
  }
  await notifyHolder(account, {
    title: `💳 Paiement reçu : ${fdj(amount)}`,
    body: `Merci ! Reste à régler sur votre carnet : ${fdj(Math.max(0, sum.outstanding))}.`,
    url: '/profile', i18n: { key: 'credit.payment', params: { amount: fdj(amount), rest: fdj(Math.max(0, sum.outstanding)) } },
  });
  return { ok: true as const, payment_id: Number(r.payment_id), unallocated: Number(r.unallocated) || 0, reactivated, summary: sum };
}

/** Titulaire(s) à prévenir : le client, ou les gérants de la société. */
export async function holderUserIds(account: CreditAccount): Promise<string[]> {
  if (account.holder_type === 'user') return account.user_id ? [account.user_id] : [];
  const { memberIds } = await import('./company');
  return memberIds(account.company_id!, ['manager']);
}
async function notifyHolder(account: CreditAccount, payload: { title: string; body: string; url?: string; subject?: string | null; i18n?: { key: string; params?: Record<string, any> } }) {
  const { notifyWithEmail, notifyUser } = await import('./notify');
  for (const uid of await holderUserIds(account)) {
    try { if (payload.subject) await notifyWithEmail(uid, payload); else await notifyUser(uid, payload); } catch (e) { console.error('[credit] notify:', e); }
  }
}
export async function holderLabel(account: CreditAccount): Promise<{ name: string; email: string | null }> {
  if (account.holder_type === 'company') {
    const { data } = await supabaseAdmin.from('companies').select('name, email').eq('id', account.company_id!).maybeSingle();
    return { name: data?.name || `Société #${account.company_id}`, email: data?.email || null };
  }
  const { data } = await supabaseAdmin.auth.admin.getUserById(account.user_id!);
  return { name: data?.user?.user_metadata?.full_name || data?.user?.email || 'Client', email: data?.user?.email || null };
}

/** Vue admin : tous les comptes avec leur encours. */
export async function creditOverview(day = todayStr()) {
  const [{ data: accounts }, { data: entries }, settings] = await Promise.all([
    supabaseAdmin.from('credit_accounts').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('credit_entries').select('*').order('created_at', { ascending: false }),
    creditSettings(),
  ]);
  const byAcc: Record<number, CreditEntry[]> = {};
  for (const e of (entries || []) as CreditEntry[]) (byAcc[e.account_id] ||= []).push(e);
  const out = [];
  for (const a of (accounts || []) as CreditAccount[]) {
    const s = summarize(a, byAcc[a.id] || [], day, settings.enabled);
    const h = await holderLabel(a);
    out.push({ ...s, holder: h });
  }
  return { settings, accounts: out, totals: { outstanding: out.reduce((s, a) => s + Math.max(0, a.outstanding), 0), overdue: out.reduce((s, a) => s + a.overdue, 0) } };
}

// ── Traitement quotidien : rappels, relevés, suspension ───────────────────────────────────
type DailyEvent = { account_id: number; kind: 'before' | 'statement' | 'overdue' | 'suspended'; due_at: string; amount: number };
async function alreadySent(accountId: number, kind: string, dueAt: string) {
  const { data } = await supabaseAdmin.from('credit_reminders').select('id').eq('account_id', accountId).eq('kind', kind).eq('due_at', dueAt).maybeSingle();
  return !!data;
}
async function markSent(accountId: number, kind: string, dueAt: string) {
  await supabaseAdmin.from('credit_reminders').insert({ account_id: accountId, kind, due_at: dueAt });
}

export async function creditDaily(day = todayStr(), opts: { onlyAccount?: number; dry?: boolean } = {}): Promise<{ date: string; events: DailyEvent[] }> {
  const settings = await creditSettings();
  const events: DailyEvent[] = [];
  let q = supabaseAdmin.from('credit_accounts').select('*');
  if (opts.onlyAccount) q = q.eq('id', opts.onlyAccount);
  const { data: accounts } = await q;
  for (const account of (accounts || []) as CreditAccount[]) {
    const sum = summarize(account, await entriesOf(account.id, 1000), day, settings.enabled);
    if (!sum.open.length) continue;
    const holder = await holderLabel(account);
    const send = async (ev: DailyEvent, payload: Parameters<typeof notifyHolder>[1], attach?: () => Promise<Buffer | null>) => {
      if (await alreadySent(ev.account_id, ev.kind, ev.due_at)) return;
      events.push(ev);
      if (opts.dry) return;
      await notifyHolder(account, payload);
      if (attach) {
        try {
          const pdf = await attach();
          const { sendCreditStatement } = await import('./emails');
          const { langOfUser } = await import('./i18n-server');
          for (const uid of await holderUserIds(account)) {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (u?.user?.email) await sendCreditStatement(u.user.email, { holder: holder.name, lines: sum.open.filter(c => c.due_at <= ev.due_at), total: ev.amount, due: ev.due_at, outstanding: sum.outstanding }, await langOfUser(uid), pdf);
          }
        } catch (e) { console.error('[credit] statement email:', e); }
      }
      await markSent(ev.account_id, ev.kind, ev.due_at);
    };

    // 1) Rappel avant l'échéance
    if (sum.next_due && daysBetween(day, sum.next_due) === settings.remind_before_days && sum.next_due_amount > 0) {
      await send({ account_id: account.id, kind: 'before', due_at: sum.next_due, amount: sum.next_due_amount }, {
        title: `🗓️ Crédit : ${fdj(sum.next_due_amount)} à régler le ${dateFr(sum.next_due)}`,
        body: `Dans ${settings.remind_before_days} jour(s). Vous pouvez payer en espèces, par Waafi ou D-Money auprès d'Hornafresh.`,
        url: '/profile', i18n: { key: 'credit.before', params: { amount: fdj(sum.next_due_amount), due: dateFr(sum.next_due), days: settings.remind_before_days } },
      });
    }
    // 2) Relevé le jour de l'échéance (PDF par e-mail)
    if (sum.next_due === day && sum.next_due_amount > 0) {
      await send({ account_id: account.id, kind: 'statement', due_at: day, amount: sum.next_due_amount }, {
        title: `🧾 Relevé de crédit : ${fdj(sum.next_due_amount)} à régler aujourd'hui`,
        body: `Le détail de vos commandes vous est envoyé par e-mail. Merci de régler auprès d'Hornafresh.`,
        url: '/profile', i18n: { key: 'credit.statement', params: { amount: fdj(sum.next_due_amount), due: dateFr(day) } },
      }, async () => { const { buildCreditStatementPdf } = await import('./credit-pdf'); return buildCreditStatementPdf({ holder: holder.name, day, due: day, lines: sum.open.filter(c => c.due_at <= day), total: sum.next_due_amount, limit: account.credit_limit, outstanding: sum.outstanding }); });
    }
    // 3) Retard : rappel après N jours, suspension après M jours
    if (sum.overdue > 0 && sum.overdue_since) {
      const late = daysBetween(sum.overdue_since, day);
      if (late >= settings.overdue_remind_days) {
        await send({ account_id: account.id, kind: 'overdue', due_at: sum.overdue_since, amount: sum.overdue }, {
          title: `⚠️ Crédit en retard : ${fdj(sum.overdue)}`,
          body: `L'échéance du ${dateFr(sum.overdue_since)} est dépassée. Merci de régulariser auprès d'Hornafresh pour continuer à commander à crédit.`,
          url: '/profile', subject: 'Crédit Hornafresh — règlement en retard',
          i18n: { key: 'credit.overdue', params: { amount: fdj(sum.overdue), due: dateFr(sum.overdue_since) } },
        });
      }
      if (late >= settings.suspend_after_days && account.status === 'active') {
        if (!opts.dry) {
          await supabaseAdmin.from('credit_accounts').update({ status: 'suspended', auto_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: `Retard de ${late} jours (échéance du ${dateFr(sum.overdue_since)})`, updated_at: new Date().toISOString() }).eq('id', account.id);
          account.status = 'suspended';
          try { const { sendPushToAdmin } = await import('./push'); await sendPushToAdmin({ title: '🛑 Crédit suspendu', body: `${holder.name} — ${fdj(sum.overdue)} en retard depuis le ${dateFr(sum.overdue_since)}`, url: '/admin' }); } catch { /* ignore */ }
        }
        await send({ account_id: account.id, kind: 'suspended', due_at: sum.overdue_since, amount: sum.overdue }, {
          title: '🛑 Crédit suspendu',
          body: `${fdj(sum.overdue)} restent dus depuis le ${dateFr(sum.overdue_since)}. Le crédit sera réactivé dès le règlement.`,
          url: '/profile', subject: 'Crédit Hornafresh suspendu',
          i18n: { key: 'credit.suspended', params: { amount: fdj(sum.overdue), due: dateFr(sum.overdue_since) } },
        });
      }
    }
  }
  return { date: day, events };
}
