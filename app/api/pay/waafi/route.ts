import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import crypto from 'crypto';

const WAAFI_URL   = 'https://api.waafipay.com/asm';
const MERCHANT_UID = process.env.WAAFI_MERCHANT_UID;
const API_USER_ID  = process.env.WAAFI_API_USER_ID;
const API_KEY      = process.env.WAAFI_API_KEY;
const CURRENCY     = process.env.WAAFI_CURRENCY || 'USD';

// Normalise le numéro en format international 253XXXXXXX
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('253')) return digits;
  if (digits.startsWith('0'))   return '253' + digits.slice(1);
  return '253' + digits;
}

export async function POST(request: Request) {
  if (!MERCHANT_UID || !API_USER_ID || !API_KEY) {
    return NextResponse.json(
      { error: 'waafi_not_configured' },
      { status: 503 }
    );
  }

  const { orderId, phone, amount } = await request.json();

  if (!orderId || !phone || !amount) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const requestId = crypto.randomUUID();
  const invoiceId = `INV-${Date.now()}`;
  const accountNo = normalizePhone(phone);
  const shortId   = String(orderId).slice(0, 8).toUpperCase();

  const body = {
    schemaVersion: '1.0',
    requestId,
    timestamp:   new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid:   MERCHANT_UID,
      apiUserId:     API_USER_ID,
      apiKey:        API_KEY,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo:     { accountNo },
      transactionInfo: {
        referenceId: String(orderId),
        invoiceId,
        amount,
        currency:    CURRENCY,
        description: `Hornafresh - Commande #${shortId}`,
      },
    },
  };

  try {
    const res = await fetch(WAAFI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      // Le client a ~60s pour confirmer sur son téléphone
      signal:  AbortSignal.timeout(90_000),
    });

    const data = await res.json();

    const approved =
      data.responseCode === '2001' &&
      data.params?.state === 'APPROVED';

    if (approved) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'processing' })
        .eq('id', orderId);

      return NextResponse.json({
        success: true,
        txnId:   data.params?.txnId ?? null,
      });
    }

    // Paiement refusé ou annulé — on annule la commande
    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    return NextResponse.json({
      success: false,
      error:   data.responseMsg || 'Paiement refusé',
      code:    data.responseCode,
    }, { status: 402 });

  } catch (e: any) {
    // Timeout : le client n'a pas confirmé à temps
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      return NextResponse.json({ success: false, error: 'timeout' }, { status: 408 });
    }
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
