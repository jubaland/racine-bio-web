import { NextResponse } from 'next/server';
import { userFromRequest, membershipOf } from '../../../lib/company';
import { accountOfUser, accountOfCompany, summaryOf, entriesOf, creditSettings, dueDateFor, todayStr } from '../../../lib/credit';
import { monitored } from '../../../lib/monitor';

// GET — mon crédit : compte personnel et/ou compte de ma société (gérants, acheteurs, comptables)
async function GET_(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const settings = await creditSettings();
  const day = todayStr();
  const view = async (account: Awaited<ReturnType<typeof accountOfUser>>) => {
    if (!account) return null;
    const s = await summaryOf(account, day);
    const entries = (await entriesOf(account.id, 100)).map(e => ({ id: e.id, type: e.type, amount: e.amount, order_id: e.order_id, due_at: e.due_at, paid_amount: e.paid_amount, method: e.method, note: e.note, created_at: e.created_at }));
    return {
      id: account.id, holder_type: account.holder_type, credit_limit: account.credit_limit, term: account.term, term_days: account.term_days,
      status: account.status, auto_suspended: account.auto_suspended, suspended_reason: account.suspended_reason,
      outstanding: s.outstanding, overdue: s.overdue, overdue_since: s.overdue_since, available: s.available, next_due: s.next_due, next_due_amount: s.next_due_amount,
      usable: s.usable, due_if_ordered_today: dueDateFor(account.term, account.term_days, day), open: s.open, entries,
    };
  };
  const m = await membershipOf(user.id);
  const [mine, company] = await Promise.all([
    view(await accountOfUser(user.id)),
    m && m.company?.status === 'active' ? view(await accountOfCompany(m.company_id)) : Promise.resolve(null),
  ]);
  return NextResponse.json({ enabled: settings.enabled, user: mine, company, company_role: m?.role || null });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/credit', GET_);
