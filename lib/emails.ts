import { Resend } from 'resend';
import { AsyncLocalStorage } from 'node:async_hooks';
import { buildPrepSlipPdf } from './pdf';
import { mailer, type Mailer, type Param } from './i18n-server';

// E-mails. Ceux adressés aux clients et aux marchands partent dans la langue du destinataire
// (paramètre `lang` ; modèles mail.* dans ui_translations, le français écrit ici sert de repli).
// Ceux adressés à l'équipe (admin, préparateurs) restent en français.

const resend = new Resend(process.env.RESEND_API_KEY);

// Aperçu : dans previewEmails(), les e-mails sont capturés au lieu d'être envoyés (admin › aperçu, tests).
type Mail = { from: string; to: string | string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] };
const capture = new AsyncLocalStorage<Mail[]>();
async function deliver(mail: Mail) {
  const box = capture.getStore();
  if (box) { box.push(mail); return; }
  await resend.emails.send(mail);
}
/** Exécute `fn` sans rien envoyer et renvoie les e-mails qu'elle aurait envoyés. */
export async function previewEmails(fn: () => Promise<unknown>): Promise<Mail[]> {
  const box: Mail[] = [];
  await capture.run(box, fn);
  return box;
}

const FROM = 'Hornafresh <noreply@hornafresh.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const SITE = 'https://www.hornafresh.com';

const PAYMENT_LABELS: Record<string, string> = {
  waafi:  '📱 Waafi',
  dmoney: '💳 D-Money',
  cash:   '💵 Espèces (à la livraison)',
  wallet: '💰 Cagnotte (prépayé)',
};

const fdjFr = (n: number) => `${Number(n).toLocaleString('fr-FR')} Fdj`;

function baseLayout(content: string, M?: Mailer) {
  const tagline = M ? M.m('tagline', 'Le marché bio de Djibouti') : 'Le marché bio de Djibouti';
  return `
    <!DOCTYPE html>
    <html lang="${M?.lang || 'fr'}">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8faf0;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde8b0;">
        <!-- Header -->
        <div style="background:#526500;padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:28px;">🌿</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">Hornafresh</h1>
          <p style="margin:4px 0 0;color:#c5d87a;font-size:12px;">${tagline}</p>
        </div>
        <!-- Content -->
        <div style="padding:32px;">
          ${content}
        </div>
        <!-- Footer -->
        <div style="background:#f0f7e0;padding:16px 32px;text-align:center;border-top:1px solid #dde8b0;">
          <p style="margin:0;color:#7d9800;font-size:12px;">© Hornafresh — Djibouti</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function itemsTable(items: any[], M?: Mailer) {
  const m = M ? M.m : ((_k: string, fr: string) => fr);
  const rows = items.map(item => {
    const name  = item.product_name  || `${m('product', 'Produit')} #${item.product_id}`;
    const unit  = item.product_unit  || '';
    const pu    = `${Number(item.price).toLocaleString('fr-FR')} Fdj${unit}`;
    const disc  = Number(item.discount) || 0;   // remise admin sur la ligne (prix réel conservé)
    const subtotal = disc > 0
      ? `<s style="color:#9ca3af;font-weight:normal;">${(item.price * item.quantity).toLocaleString('fr-FR')}</s> ${(item.price * item.quantity - disc).toLocaleString('fr-FR')}`
      : (item.price * item.quantity).toLocaleString('fr-FR');
    const contents = Array.isArray(item.bundle_contents) && item.bundle_contents.length
      ? `<br><span style="color:#9ca3af;font-size:12px;">🧺 ${item.bundle_contents.map((c: any) => `${c.quantity} ${c.unit || ''} ${c.name}`.replace(/\s+/g, ' ').trim()).join(' · ')}</span>` : '';
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f7e0;color:#374151;font-size:14px;">${name}${contents}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #f0f7e0;color:#6b7280;font-size:13px;text-align:right;white-space:nowrap;">${pu}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #f0f7e0;color:#374151;font-size:13px;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f7e0;color:#526500;font-size:14px;font-weight:bold;text-align:right;white-space:nowrap;">${subtotal} Fdj</td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">${m('col_product', 'Produit')}</th>
          <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">${m('col_unit_price', 'P.U.')}</th>
          <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">${m('col_qty', 'Qté')}</th>
          <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">${m('col_subtotal', 'Sous-total')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── 1. Confirmation commande → client ─────────────────────────────────────────
export async function sendOrderConfirmation(
  order: any,
  items: any[],
  customerEmail: string,
  lang?: string | null,
) {
  const M = await mailer(lang); const m = M.m;
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const isWaafi = order.payment_method === 'waafi';
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);
  const promoDisc = Number(order.promo_discount) || 0;
  const grantedDisc = (Number(order.admin_discount) || 0) + items.reduce((s, it) => s + (Number(it.discount) || 0), 0);
  const discountRows = `${promoDisc > 0 ? `
        <tr>
          <td style="padding:4px 16px;color:#526500;font-size:14px;">🎁 ${m('promo_items', 'Remise code {code}', { code: order.promo_code || '' })}</td>
          <td style="padding:4px 16px;text-align:right;color:#526500;font-size:14px;">−${fdjFr(promoDisc)}</td>
        </tr>` : ''}${grantedDisc > 0 ? `
        <tr>
          <td style="padding:4px 16px;color:#526500;font-size:14px;">💸 ${m('discount_granted', 'Remise accordée')}</td>
          <td style="padding:4px 16px;text-align:right;color:#526500;font-size:14px;">−${fdjFr(grantedDisc)}</td>
        </tr>` : ''}`;
  const fmtDate = M.date(order.created_at, { dateStyle: 'long', timeStyle: 'short' });
  const pay: Record<string, string> = {
    waafi: '📱 Waafi', dmoney: '💳 D-Money',
    cash: `💵 ${m('pay_cash', 'Espèces (à la livraison)')}`, wallet: `💰 ${m('pay_wallet', 'Cagnotte (prépayé)')}`,
    company_wallet: `🏢 ${m('pay_company_wallet', 'Cagnotte de la société')}`,
  };

  const waafiBlock = isWaafi ? `
    <div style="background:#e8f5e0;border:1px solid #a8c800;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:bold;color:#526500;">📱 ${m('waafi_todo', 'Paiement Waafi à effectuer')}</p>
      <p style="margin:0 0 8px;color:#374151;font-size:14px;">
        ${m('waafi_send', 'Envoyez {amount} au numéro :', { amount: `<strong>${fdjFr(order.total)}</strong>` })}
      </p>
      <p style="margin:0;font-size:28px;font-weight:bold;color:#526500;text-align:center;letter-spacing:4px;">77432615</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;text-align:center;">Hornafresh — Djibouti</p>
    </div>
  ` : '';

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">${m('order_confirmed', 'Commande confirmée')} 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${m('reference', 'Référence')} : <strong>#${shortId}</strong> · ${fmtDate}</p>

    ${itemsTable(items, M)}

    <div style="background:#f8faf0;border-radius:12px;padding:8px 0;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px 4px;color:#6b7280;font-size:14px;">${m('col_subtotal', 'Sous-total')}</td>
          <td style="padding:8px 16px 4px;text-align:right;color:#374151;font-size:14px;">${fdjFr(subtotal)}</td>
        </tr>${discountRows}
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">🚚 ${m('delivery', 'Livraison')}${order.delivery_option_name ? ` (${order.delivery_option_name})` : ''}${order.promo_code ? ` · ${m('promo_code', 'code {code}', { code: order.promo_code })}` : ''}</td>
          <td style="padding:4px 16px;text-align:right;font-size:14px;color:${deliveryFee === 0 ? '#16a34a' : '#374151'};">${deliveryFee === 0 ? m('free', 'Offerte') : `${Number(order.delivery_discount) > 0 && order.delivery_fee_base ? `<s style="color:#9ca3af;">${fdjFr(order.delivery_fee_base)}</s> ` : ''}${fdjFr(deliveryFee)}`}</td>
        </tr>
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">${m('payment_method', 'Mode de paiement')}</td>
          <td style="padding:4px 16px;text-align:right;color:#374151;font-size:14px;">${pay[order.payment_method] || order.payment_method}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px 8px;border-top:1px solid #dde8b0;color:#1f2937;font-weight:bold;font-size:16px;">${m('total', 'Total')}</td>
          <td style="padding:10px 16px 8px;border-top:1px solid #dde8b0;text-align:right;color:#526500;font-weight:bold;font-size:18px;">${fdjFr(order.total)}</td>
        </tr>
      </table>
    </div>

    ${waafiBlock}

    ${order.special_instructions ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:20px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#b45309;font-size:13px;">📝 ${m('special_request', 'Demande spéciale')}</p>
      <p style="margin:0;color:#92400e;font-size:14px;">${order.special_instructions}</p>
    </div>` : ''}

    <div style="background:#f0f7e0;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">${m('deliver_to', 'Livraison à')}</p>
      <p style="margin:0;color:#374151;font-size:14px;font-weight:bold;">${order.customer_name}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📍 ${order.address}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📞 ${order.phone}</p>
    </div>

    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
      ${m('order_thanks', 'Notre équipe vous contactera pour confirmer la livraison. Merci pour votre confiance !')}
    </p>
  `, M);

  await deliver({
    from: FROM,
    to: customerEmail,
    subject: `✅ ${m('subject_order_confirmed', 'Commande #{id} confirmée — Hornafresh', { id: shortId })}`,
    html,
  });
}

// ── 2. Alerte nouvelle commande → admin ───────────────────────────────────────
export async function sendNewOrderAlert(order: any, items: any[], customerEmail: string | null) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);
  const promoDisc = Number(order.promo_discount) || 0;

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">🛍️ Nouvelle commande #${shortId}</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
    </p>

    ${itemsTable(items)}

    <div style="background:#f8faf0;border-radius:12px;padding:8px 0;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px 4px;color:#6b7280;font-size:14px;">Sous-total</td>
          <td style="padding:8px 16px 4px;text-align:right;color:#374151;font-size:14px;">${Number(subtotal).toLocaleString('fr-FR')} Fdj</td>
        </tr>${promoDisc > 0 ? `
        <tr>
          <td style="padding:4px 16px;color:#526500;font-size:14px;">🎁 Remise code ${order.promo_code || ''}</td>
          <td style="padding:4px 16px;text-align:right;color:#526500;font-size:14px;">−${promoDisc.toLocaleString('fr-FR')} Fdj</td>
        </tr>` : ''}
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">🚚 Livraison${order.delivery_option_name ? ` (${order.delivery_option_name})` : ''}${Number(order.delivery_discount) > 0 ? ` · ${order.promo_code ? `code ${order.promo_code}` : order.delivery_discount_source === 'threshold' ? 'seuil atteint' : 'parrainage'} : ${Number(order.delivery_discount).toLocaleString('fr-FR')} Fdj offerts` : ''}</td>
          <td style="padding:4px 16px;text-align:right;font-size:14px;color:${deliveryFee === 0 ? '#16a34a' : '#374151'};">${deliveryFee === 0 ? 'Offerte' : `${Number(deliveryFee).toLocaleString('fr-FR')} Fdj`}</td>
        </tr>
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">Mode de paiement</td>
          <td style="padding:4px 16px;text-align:right;color:#374151;font-size:14px;">${PAYMENT_LABELS[order.payment_method] || order.payment_method}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px 8px;border-top:1px solid #dde8b0;color:#1f2937;font-weight:bold;font-size:16px;">Total</td>
          <td style="padding:10px 16px 8px;border-top:1px solid #dde8b0;text-align:right;color:#526500;font-weight:bold;font-size:18px;">${Number(order.total).toLocaleString('fr-FR')} Fdj</td>
        </tr>
      </table>
    </div>

    <div style="background:#f0f7e0;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;">Client</p>
      <p style="margin:0;color:#374151;font-size:14px;font-weight:bold;">${order.customer_name}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📞 ${order.phone}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📍 ${order.address}</p>
      ${customerEmail ? `<p style="margin:4px 0 0;color:#374151;font-size:13px;">✉️ ${customerEmail}</p>` : ''}
    </div>

    <p style="color:#6b7280;font-size:13px;">
      Connectez-vous au panneau admin pour traiter cette commande.
    </p>
  `);

  await deliver({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🛍️ Nouvelle commande #${shortId} — ${Number(order.total).toLocaleString('fr-FR')} Fdj`,
    html,
  });
}

// ── 3. Mise à jour statut → client ────────────────────────────────────────────
export async function sendStatusUpdate(order: any, customerEmail: string, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const EMOJI: Record<string, string> = { pending: '⏳', processing: '🚚', shipping: '📦', delivered: '✅', cancelled: '❌' };
  const LABEL: Record<string, string> = {
    pending: m('status_pending', 'En attente'), processing: m('status_processing', 'En cours de préparation'),
    shipping: m('status_shipping', 'Expédié'), delivered: m('status_delivered', 'Livré'), cancelled: m('status_cancelled', 'Annulé'),
  };
  const statusEmoji = EMOJI[order.status] || '';
  const statusText = LABEL[order.status] || order.status;

  const messages: Record<string, string> = {
    processing: m('status_msg_processing', "Votre commande est en cours de préparation. Nous vous contacterons dès qu'elle est prête."),
    shipping:   m('status_msg_shipping', 'Votre commande est en route ! Notre livreur vous contactera pour la remise.'),
    delivered:  m('status_msg_delivered', 'Votre commande a été livrée. Merci pour votre confiance et à bientôt !'),
    cancelled:  m('status_msg_cancelled', 'Votre commande a été annulée. Contactez-nous si vous avez des questions.'),
  };
  const message = messages[order.status] || m('status_msg_default', 'Le statut de votre commande a été mis à jour.');

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">${m('status_title', 'Mise à jour de votre commande')}</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${m('reference', 'Référence')} : <strong>#${shortId}</strong></p>

    <div style="text-align:center;padding:24px;background:#f0f7e0;border-radius:12px;margin-bottom:24px;">
      <p style="margin:0;font-size:32px;">${statusEmoji}</p>
      <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:#526500;">${statusText}</p>
    </div>

    <p style="color:#374151;font-size:14px;line-height:1.6;">${message}</p>

    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      ${m('contact_us', 'Pour toute question, contactez-nous au {phone}.', { phone: '<strong>77432615</strong>' })}
    </p>
  `, M);

  await deliver({
    from: FROM,
    to: customerEmail,
    subject: `${statusEmoji} ${statusText} — ${m('subject_order', 'Commande #{id} Hornafresh', { id: shortId })}`,
    html,
  });
}

// ── 4. Bordereau de préparation → préparateurs ───────────────────────────────
export async function sendPrepSlipToPreparers(order: any, items: any[], emails: string[], isUpdate = false) {
  if (!emails.length) return;
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const ordered = new Date(order.created_at);
  const deadline = new Date(ordered.getTime() + 24 * 3600 * 1000); // livraison sous 24h
  const fmt = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
  const totalStr = `${Number(order.total).toLocaleString('fr-FR')} Fdj`;
  const payLine =
    order.payment_method === 'cash'   ? `💵 À encaisser : ${totalStr}` :
    order.payment_method === 'wallet' ? `💰 Payé (cagnotte) — ${totalStr}` :
                                        `📱 Payé via Waafi (à vérifier) — ${totalStr}`;

  const rows = items.map(it => {
    const name = it.product_name || `Produit #${it.product_id}`;
    const unit = it.product_unit || '';
    const farm = it.product_farm ? ` · 🌱 ${it.product_farm}` : '';
    // Panier composé : la composition (× nombre de paniers) sous la ligne, à cocher article par article
    const contents = Array.isArray(it.bundle_contents) && it.bundle_contents.length
      ? `<ul style="margin:6px 0 0 25px;padding:0;list-style:none;">${it.bundle_contents.map((c: any) =>
          `<li style="font-size:13px;color:#4b5563;padding:2px 0;"><span style="display:inline-block;width:11px;height:11px;border:1px solid #9ca3af;border-radius:2px;vertical-align:middle;margin-right:8px;"></span>🧺 <strong style="color:#526500;">${Number(c.quantity) * Number(it.quantity)} ${c.unit || ''}</strong> ${c.name}</li>`).join('')}</ul>`
      : '';
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f7e0;font-size:15px;color:#374151;">
      <span style="display:inline-block;width:15px;height:15px;border:2px solid #9ca3af;border-radius:3px;vertical-align:middle;margin-right:10px;"></span>
      <strong style="color:#526500;">${it.quantity} ${unit}</strong> — ${name}<span style="color:#9ca3af;font-size:13px;">${farm}</span>${contents}
    </td></tr>`;
  }).join('');

  const specialBlock = order.special_instructions ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#b45309;font-size:13px;">📝 Demande spéciale</p>
      <p style="margin:0;color:#92400e;font-size:14px;">${order.special_instructions}</p>
    </div>` : '';

  const html = baseLayout(`
    ${isUpdate ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
      <p style="margin:0;font-weight:bold;color:#c2410c;font-size:14px;">🔄 Bordereau mis à jour</p>
      <p style="margin:4px 0 0;color:#9a3412;font-size:13px;">Cette commande a été modifiée. Préparez selon CE bordereau (il remplace le précédent).</p>
    </div>` : ''}
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">🧑‍🍳 Bordereau de préparation</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Commande <strong>#${shortId}</strong></p>

    <div style="background:#ecf4d5;border:1px solid #a8c800;border-radius:12px;padding:14px;margin-bottom:16px;">
      <p style="margin:0;color:#6b7280;font-size:12px;text-transform:uppercase;">⏰ À livrer avant</p>
      <p style="margin:2px 0 0;font-size:16px;font-weight:bold;color:#526500;">${fmt(deadline)}</p>
      <p style="margin:2px 0 0;color:#9ca3af;font-size:12px;">Commandée le ${fmt(ordered)}</p>
    </div>

    <div style="background:#f8faf0;border-radius:12px;padding:14px;margin-bottom:16px;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:bold;">Client</p>
      <p style="margin:0;color:#374151;font-size:14px;font-weight:bold;">${order.customer_name || '—'}</p>
      <p style="margin:2px 0 0;color:#374151;font-size:13px;">📞 ${order.phone || ''}</p>
      <p style="margin:2px 0 0;color:#374151;font-size:13px;">📍 ${order.address || ''}</p>
    </div>

    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:bold;">Articles à préparer (${items.length})</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>

    ${specialBlock}

    <div style="border-top:2px solid #526500;padding-top:12px;margin-top:16px;">
      ${order.delivery_option_name ? `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">🚚 Livraison : ${order.delivery_option_name}</p>` : ''}
      <p style="margin:0;font-size:16px;font-weight:bold;color:#526500;">${payLine}</p>
    </div>
  `);

  // Pièce jointe : le bordereau en PDF (échec PDF = on envoie quand même l'email)
  let attachments: { filename: string; content: Buffer }[] | undefined;
  try {
    const pdf = await buildPrepSlipPdf(order, items);
    attachments = [{ filename: `bordereau-${shortId}.pdf`, content: pdf }];
  } catch (e) {
    console.error('[pdf] bordereau generation failed:', e);
  }

  await deliver({
    from: FROM,
    to: emails,
    subject: isUpdate ? `🔄 Commande modifiée — #${shortId}` : `🧑‍🍳 À préparer — Commande #${shortId}`,
    html,
    attachments,
  });
}

// ── 4b. Commande annulée → préparateurs (ne pas préparer) ────────────────────
export async function sendOrderCancelledToPreparers(order: any, emails: string[]) {
  if (!emails.length) return;
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const html = baseLayout(`
    <div style="background:#fff1f2;border:1px solid #fca5a5;border-radius:12px;padding:14px;margin-bottom:14px;">
      <p style="margin:0;font-weight:bold;color:#b91c1c;font-size:16px;">❌ Commande #${shortId} annulée</p>
      <p style="margin:6px 0 0;color:#991b1b;font-size:14px;">Ne préparez pas cette commande. Si elle est déjà prête, contactez l'administrateur.</p>
    </div>
    <p style="margin:0;color:#374151;font-size:14px;">Client : <strong>${order.customer_name || '—'}</strong></p>
  `);
  await deliver({ from: FROM, to: emails, subject: `❌ Commande annulée — #${shortId}`, html });
}

// ── 4c. Email générique → marchand ou membre d'entreprise (titre et texte déjà dans sa langue) ─
export async function sendMerchantEmail(email: string, subject: string, title: string, text: string, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">${title}</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">${text}</p>
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${SITE}/producer/dashboard" style="display:inline-block;background:#a8c800;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:9999px;font-weight:bold;font-size:14px;">${m('open_merchant_space', 'Ouvrir mon espace marchand')}</a>
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;">${m('question', 'Une question ?')} <strong>77 43 26 15</strong> — ${m('team', "L'équipe Hornafresh")}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject, html });
}

// ── 4c. Récapitulatif quotidien → marchand (mode e-mail « daily ») ──────────
export async function sendMerchantDigest(email: string, d: {
  shop: string; new_orders: { id: number; status: string; customer: string; lines: string[]; amount: number }[];
  delivered: number; cancelled: number; amount_new: number; low_stock: { name: string; stock: number; unit: string }[]; due: number; sub_days_left: number | null; commission_rate?: number | null; visible?: boolean;
}, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const STATUS: Record<string, string> = {
    pending: `⏳ ${m('status_pending', 'En attente')}`, processing: `🚚 ${m('status_processing', 'En cours de préparation')}`,
    shipping: `📦 ${m('status_shipping', 'Expédié')}`, delivered: `✅ ${m('status_delivered', 'Livré')}`, cancelled: `❌ ${m('status_cancelled', 'Annulé')}`,
  };
  const ordersHtml = d.new_orders.length ? `
    <h3 style="margin:18px 0 8px;font-size:15px;color:#1f2937;">🛍️ ${m('digest_orders', 'Commandes reçues ({n}) — {amount} hors annulées', { n: d.new_orders.length, amount: fdjFr(d.amount_new) })}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${d.new_orders.map(o => `<tr style="border-bottom:1px solid #eef2e0;"><td style="padding:6px 4px;white-space:nowrap;"><strong>#${o.id}</strong> · ${o.customer}</td><td style="padding:6px 4px;color:#374151;">${o.lines.join(', ')}</td><td style="padding:6px 4px;text-align:right;white-space:nowrap;">${fdjFr(o.amount)}</td><td style="padding:6px 4px;white-space:nowrap;">${STATUS[o.status] || o.status}</td></tr>`).join('')}
    </table>` : `<p style="margin:16px 0 0;color:#6b7280;font-size:14px;">${m('digest_none', 'Aucune nouvelle commande sur la période.')}</p>`;
  const lowHtml = d.low_stock.length ? `
    <h3 style="margin:18px 0 8px;font-size:15px;color:#b45309;">⚠️ ${m('digest_low', 'Stock bas')}</h3>
    <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;">${d.low_stock.map(p => `<li>${p.name} : <strong>${p.stock === 0 ? m('digest_out', 'rupture') : `${p.stock} ${p.unit}`}</strong></li>`).join('')}</ul>` : '';
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">📬 ${m('digest_title', 'Votre récapitulatif Hornafresh')} — ${d.shop}</h2>
    <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">${m('digest_since', 'Depuis votre dernier récapitulatif.')}</p>
    ${ordersHtml}
    ${lowHtml}
    <div style="background:#f8faf0;border-radius:12px;padding:14px;margin:18px 0;font-size:13px;color:#374151;">
      <p style="margin:0;">💸 ${m('digest_due', 'À vous reverser')} : <strong>${fdjFr(d.due)}</strong></p>
      ${d.sub_days_left != null ? `<p style="margin:6px 0 0;">💳 ${m('digest_sub', 'Abonnement : {n} jour(s) restant(s)', { n: `<strong>${d.sub_days_left}</strong>` })}</p>`
        : d.commission_rate != null ? `<p style="margin:6px 0 0;">🤝 ${m('digest_com', 'Formule commission : {rate} % retenus sur vos ventes livrées', { rate: `<strong>${d.commission_rate}</strong>` })}</p>`
        : `<p style="margin:6px 0 0;color:#b91c1c;">💳 ${m('digest_no_formula', 'Aucune formule active — vos produits ne sont pas visibles.')}</p>`}
    </div>
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${SITE}/producer/orders" style="display:inline-block;background:#a8c800;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:9999px;font-weight:bold;font-size:14px;">${m('digest_open', 'Ouvrir mes commandes')}</a>
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;">${m('digest_footer', 'Vous recevez un récapitulatif quotidien. Pour un e-mail à chaque commande, changez le réglage dans votre tableau de bord marchand.')}</p>
  `, M);
  const low = d.low_stock.length ? ` · ${m('digest_subject_low', '{n} stock(s) bas', { n: d.low_stock.length })}` : '';
  await deliver({ from: FROM, to: email, subject: `📬 ${m('digest_subject', 'Récapitulatif Hornafresh — {n} commande(s)', { n: d.new_orders.length })}${low}`, html });
}

// ── 4b. Paiement d'abonnement déclaré par un marchand → admin ────────────────
export async function sendMerchantPaymentAlert(p: { shop: string; email: string | null; plan: string; amount: number; method: string; reference: string | null }) {
  const amt = Number(p.amount).toLocaleString('fr-FR');
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">💳 Paiement d'abonnement déclaré</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Un marchand déclare avoir réglé son abonnement.</p>
    <div style="background:#f8faf0;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#374151;font-size:14px;"><strong>Marchand :</strong> ${p.shop}${p.email ? ` (${p.email})` : ''}</p>
      <p style="margin:6px 0 0;color:#374151;font-size:14px;"><strong>Plan :</strong> ${p.plan} — <strong>${amt} Fdj</strong></p>
      <p style="margin:6px 0 0;color:#374151;font-size:14px;"><strong>Mode :</strong> ${p.method === 'cash' ? 'Espèces' : 'Waafi'}${p.reference ? ` · <strong>Réf. :</strong> ${p.reference}` : ''}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;">Vérifiez le paiement reçu, puis confirmez-le dans Admin → Marchands → À traiter.</p>
  `);
  await deliver({ from: FROM, to: ADMIN_EMAIL, subject: `💳 Abonnement marchand à confirmer — ${p.shop} (${amt} Fdj)`, html });
}

// Paramètres traduisibles des e-mails de commande modèle (libellé de fréquence, note de stock, date).
// Absents, les textes français fournis par l'appelant sont utilisés tels quels.
type SubExtra = { lang?: string | null; labelParam?: Param; noteParam?: Param; dateIso?: string | null };

// ── 5. Abonnement mis en pause (solde insuffisant) → client ──────────────────
export async function sendSubscriptionPaused(email: string, needed: number, balance: number, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⏸️ ${m('paused_title', 'Livraison automatique en pause')}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('paused_intro', 'Votre cagnotte est insuffisante pour cette livraison.')}</p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;color:#92400e;font-size:14px;">${m('needed', 'Montant nécessaire')} : <strong>${fdjFr(needed)}</strong></p>
      <p style="margin:0;color:#92400e;font-size:14px;">${m('balance_now', 'Solde actuel')} : <strong>${fdjFr(balance)}</strong></p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ${m('paused_text', 'Rechargez votre cagnotte auprès de notre équipe (Waafi / espèces) pour reprendre vos livraisons automatiques. Votre commande modèle est conservée et reprendra dès le rechargement.')}
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">${m('topup_contact', 'Pour recharger, contactez-nous au {phone}.', { phone: '<strong>77432615</strong>' })}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject: `⏸️ ${m('subject_paused', 'Cagnotte à recharger — Hornafresh')}`, html });
}

// ── 5a bis. Rappel de la veille : solde insuffisant ou panier indisponible ─────
export async function sendSubscriptionReminder(email: string, p: { label: string; dateStr: string; total: number; balance: number; missing: number; stockNote: string; empty: boolean }, x: SubExtra = {}) {
  const M = await mailer(x.lang); const m = M.m;
  const label = x.labelParam && M.lang !== 'fr' ? m('_p', '{v}', { v: x.labelParam }) : p.label;
  const note = x.noteParam && M.lang !== 'fr' ? m('_p', '{v}', { v: x.noteParam }) : p.stockNote;
  const date = x.dateIso && M.lang !== 'fr' ? M.date(x.dateIso, { weekday: 'long', day: 'numeric', month: 'long' }) : p.dateStr;
  const html = baseLayout(p.empty ? `
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⚠️ ${m('remind_empty_title', 'Livraison de demain : aucun article disponible')}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('remind_empty_intro', "Votre commande modèle {label} est prévue le {date}, mais aucun de ses articles n'est disponible pour le moment.", { label: `<strong>${label}</strong>`, date })}</p>
    ${note ? `<p style="color:#92400e;font-size:14px;">${note}</p>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;">${m('remind_empty_text', 'Ajustez votre panier dans « Ma commande modèle » pour recevoir votre livraison.')}</p>
  ` : `
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⏳ ${m('remind_missing_title', 'Livraison de demain : il manque {amount}', { amount: fdjFr(p.missing) })}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('remind_missing_intro', 'Votre commande modèle {label} part le {date}.', { label: `<strong>${label}</strong>`, date })}</p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;color:#92400e;font-size:14px;">${m('delivery_amount', 'Montant de la livraison')} : <strong>${fdjFr(p.total)}</strong></p>
      <p style="margin:0 0 4px;color:#92400e;font-size:14px;">${m('wallet_balance', 'Solde de votre cagnotte')} : <strong>${fdjFr(p.balance)}</strong></p>
      <p style="margin:0;color:#92400e;font-size:15px;">${m('topup_today', "À recharger aujourd'hui")} : <strong>${fdjFr(p.missing)}</strong></p>
    </div>
    ${note ? `<p style="color:#6b7280;font-size:13px;">${note}</p>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;">${m('remind_missing_text', 'Rechargez votre cagnotte depuis votre espace (Waafi ou espèces) : dès validation, la livraison partira normalement. Sans recharge, la commande modèle sera mise en pause et reprendra automatiquement au prochain rechargement.')}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">${m('question_contact', 'Une question ? Contactez-nous au {phone}.', { phone: '<strong>77432615</strong>' })}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject: p.empty ? `⚠️ ${m('subject_remind_empty', 'Livraison de demain : panier indisponible — Hornafresh')}` : `⏳ ${m('subject_remind_missing', 'Il manque {amount} pour votre livraison de demain — Hornafresh', { amount: fdjFr(p.missing) })}`, html });
}

// ── 5a ter. Reprise automatique après recharge ───────────────────────────────
export async function sendSubscriptionResumed(email: string, freqLabel: string, nextDateStr: string | null, total: number, x: SubExtra = {}) {
  const M = await mailer(x.lang); const m = M.m;
  const label = x.labelParam && M.lang !== 'fr' ? m('_p', '{v}', { v: x.labelParam }) : freqLabel;
  const date = x.dateIso && M.lang !== 'fr' ? M.date(x.dateIso, { weekday: 'long', day: 'numeric', month: 'long' }) : nextDateStr;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">▶️ ${m('resumed_title', 'Votre commande modèle reprend')}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('resumed_intro', 'Votre cagnotte a été rechargée : la commande modèle {label} est de nouveau active.', { label: `<strong>${label}</strong>` })}</p>
    <div style="background:#ecf4d5;border:1px solid #d2e095;border-radius:12px;padding:16px;margin:16px 0;">
      ${date ? `<p style="margin:0 0 4px;color:#526500;font-size:14px;">${m('next_delivery', 'Prochaine livraison')} : <strong>${date}</strong></p>` : ''}
      <p style="margin:0;color:#526500;font-size:14px;">${m('resumed_amount', 'Montant : {amount} (débité de votre cagnotte le jour de la livraison)', { amount: `<strong>${fdjFr(total)}</strong>` })}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">${m('resumed_footer', 'Vous pouvez modifier votre panier à tout moment dans « Ma commande modèle ».')}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject: `▶️ ${m('subject_resumed', 'Votre commande modèle reprend — Hornafresh')}`, html });
}

// ── 5b. Abonnement arrivé à expiration ───────────────────────────────────────
export async function sendSubscriptionExpired(email: string, freqLabel: string, x: SubExtra = {}) {
  const M = await mailer(x.lang); const m = M.m;
  const label = x.labelParam && M.lang !== 'fr' ? m('_p', '{v}', { v: x.labelParam }) : freqLabel;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⏳ ${m('expired_title', 'Abonnement arrivé à échéance')}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('expired_intro', 'Votre commande modèle {label} a atteint sa date de validité et a été mise en pause.', { label: `<strong>${label}</strong>` })}</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ${m('expired_text', 'Pour reprendre vos livraisons automatiques, il vous suffit de renouveler votre commande modèle depuis votre espace : elle repartira pour une nouvelle année.')}
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">${m('question_contact', 'Une question ? Contactez-nous au {phone}.', { phone: '<strong>77432615</strong>' })}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject: `⏳ ${m('subject_expired', 'Renouvelez votre commande modèle — Hornafresh')}`, html });
}

// ── 5c. Réinitialisation de mot de passe (e-mail localisé via Resend) ─────────
const RESET_I18N: Record<string, { subject: string; title: string; intro: string; cta: string; expire: string; sign: string }> = {
  fr: { subject: 'Réinitialisez votre mot de passe — Hornafresh', title: 'Réinitialisation du mot de passe', intro: 'Vous avez demandé à réinitialiser le mot de passe de votre compte Hornafresh. Cliquez ci-dessous pour en choisir un nouveau.', cta: 'Réinitialiser mon mot de passe', expire: 'Ce lien expire après un court délai. Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet e-mail.', sign: 'L\'équipe Hornafresh' },
  en: { subject: 'Reset your password — Hornafresh', title: 'Password reset', intro: 'You requested to reset the password for your Hornafresh account. Click below to choose a new one.', cta: 'Reset my password', expire: 'This link expires shortly. If you did not request this, simply ignore this email.', sign: 'The Hornafresh team' },
  zh: { subject: '重置您的密码 — Hornafresh', title: '密码重置', intro: '您请求重置 Hornafresh 账户的密码。请点击下方按钮设置新密码。', cta: '重置我的密码', expire: '此链接将很快失效。如果这不是您本人的操作，请忽略此邮件。', sign: 'Hornafresh 团队' },
  so: { subject: 'Dib u deji furahaaga — Hornafresh', title: 'Dib-u-dejinta furaha', intro: 'Waxaad codsatay inaad dib u dejiso furaha akoonkaaga Hornafresh. Riix hoosta si aad u dooratid mid cusub.', cta: 'Dib u deji furahayga', expire: 'Link-gan ayaa dhowaan dhacaya. Haddii aadan adigu codsan, fadlan iska indho tir email-kan.', sign: 'Kooxda Hornafresh' },
  aa: { subject: 'Maqaane dib-qimbis — Hornafresh', title: 'Maqaane dib-qimbis', intro: 'Hornafresh akoontih maqaane dib-qimbis esserte. Cusub doorudkeh gubak tuqi.', cta: 'Yi maqaane dib-qimbis', expire: 'Tah link dabaqalih caddam. Atu maessertanih, tah email cabsit.', sign: 'Hornafresh garab' },
  am: { subject: 'የይለፍ ቃልዎን ዳግም ያስጀምሩ — Hornafresh', title: 'የይለፍ ቃል ዳግም ማስጀመር', intro: 'የHornafresh መለያዎን የይለፍ ቃል ዳግም ለማስጀመር ጠይቀዋል። አዲስ ለመምረጥ ከታች ይጫኑ።', cta: 'የይለፍ ቃሌን ዳግም አስጀምር', expire: 'ይህ ማገናኛ በቅርቡ ያበቃል። እርስዎ ካልጠየቁ፣ እባክዎ ይህን ኢሜይል ችላ ይበሉ።', sign: 'የHornafresh ቡድን' },
};

export async function sendPasswordReset(email: string, link: string, lang: string = 'fr') {
  const i = RESET_I18N[lang] || RESET_I18N.fr;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">🔐 ${i.title}</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">${i.intro}</p>
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${link}" style="display:inline-block;background:#a8c800;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:9999px;font-weight:bold;font-size:15px;">${i.cta}</a>
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${i.expire}</p>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">— ${i.sign}</p>
  `);
  await deliver({ from: FROM, to: email, subject: i.subject, html });
}

// ── 6. Nouvelle demande de recharge → admin ──────────────────────────────────
export async function sendDepositRequestAlert(req: any, customer: { name?: string | null; email?: string | null }) {
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">💰 Demande de recharge</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Un client souhaite recharger sa cagnotte.</p>
    <div style="background:#f8faf0;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#374151;font-size:14px;"><strong>Client :</strong> ${customer.name || '—'}${customer.email ? ` (${customer.email})` : ''}</p>
      <p style="margin:6px 0 0;color:#374151;font-size:14px;"><strong>Montant :</strong> ${Number(req.amount).toLocaleString('fr-FR')} Fdj</p>
      ${req.reference ? `<p style="margin:6px 0 0;color:#374151;font-size:14px;"><strong>Réf. Waafi :</strong> ${req.reference}</p>` : ''}
    </div>
    <p style="color:#6b7280;font-size:13px;">Vérifiez le paiement reçu, puis validez la demande dans Admin → Cagnottes.</p>
  `);
  await deliver({ from: FROM, to: ADMIN_EMAIL, subject: `💰 Demande de recharge — ${Number(req.amount).toLocaleString('fr-FR')} Fdj`, html });
}

// ── 7. Recharge validée → client ─────────────────────────────────────────────
export async function sendDepositApproved(email: string, amount: number, balance: number, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">✅ ${m('topup_title', 'Cagnotte rechargée')}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${m('topup_intro', 'Votre recharge a été validée.')}</p>
    <div style="background:#ecf4d5;border:1px solid #a8c800;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;color:#6b7280;font-size:13px;">${m('topup_credited', 'Montant crédité')}</p>
      <p style="margin:2px 0 8px;color:#526500;font-size:22px;font-weight:bold;">+${fdjFr(amount)}</p>
      <p style="margin:0;color:#6b7280;font-size:13px;">${m('topup_new_balance', 'Nouveau solde')} : <strong>${fdjFr(balance)}</strong></p>
    </div>
    <p style="color:#374151;font-size:14px;">${m('topup_text', "Merci ! Vous pouvez l'utiliser au paiement ou pour vos livraisons automatiques.")}</p>
  `, M);
  await deliver({ from: FROM, to: email, subject: `✅ ${m('subject_topup', 'Cagnotte rechargée — Hornafresh')}`, html });
}

// ── 8. Alerte de surveillance → admin (erreur sur le site) ───────────────────
export async function sendErrorAlert(p: { title: string; where: string; message: string; count: number; source: string }) {
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">${esc(p.title)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${esc(p.where)}${p.count > 1 ? ` · ${p.count} fois` : ''}</p>
    <div style="background:#fff1f2;border:1px solid #fca5a5;border-radius:12px;padding:14px;margin:16px 0;">
      <p style="margin:0;color:#991b1b;font-size:14px;font-family:monospace;word-break:break-word;">${esc(p.message)}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;">Détail et résolution : Admin → Surveillance.</p>
  `);
  await deliver({ from: FROM, to: ADMIN_EMAIL, subject: `${p.title} — ${p.where}`.slice(0, 150), html });
}

// ── 9. Annonce → client (canal e-mail des annonces, avec désabonnement) ───────
export async function sendAnnouncementEmail(to: string, a: { title: string; body: string | null; url: string | null; unsubscribeUrl: string }, lang?: string | null) {
  const M = await mailer(lang); const m = M.m;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = a.url ? (a.url.startsWith('http') ? a.url : `${SITE}${a.url}`) : SITE;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;color:#1f2937;font-size:20px;">${esc(a.title)}</h2>
    ${a.body ? `<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">${esc(a.body)}</p>` : ''}
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${link}" style="display:inline-block;background:#a8c800;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:9999px;font-weight:bold;font-size:15px;">${m('ann_cta', 'Voir sur Hornafresh')}</a>
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">${m('ann_footer', 'Vous recevez cet e-mail parce que vous avez un compte Hornafresh.')} <a href="${a.unsubscribeUrl}" style="color:#7d9800;">${m('ann_unsubscribe', 'Ne plus recevoir les annonces')}</a></p>
  `, M);
  await deliver({ from: FROM, to, subject: a.title.slice(0, 150), html });
}

// ── 12. Relevé de crédit (échéance) — PDF joint ───────────────────────────────────────────
export async function sendCreditStatement(to: string, p: { holder: string; lines: { order_id: number | null; created_at: string; due_at: string; remaining: number }[]; total: number; due: string; outstanding: number }, lang?: string | null, pdf?: Buffer | null) {
  const M = await mailer(lang); const m = M.m;
  const dueStr = M.date(p.due + 'T00:00:00Z', { dateStyle: 'long' });
  const rows = p.lines.map(l => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #f0f7e0;color:#374151;font-size:14px;">${m('credit_order', 'Commande #{id}', { id: String(l.order_id ?? '-') })} · ${M.date(l.created_at, { dateStyle: 'medium' })}</td>
        <td style="padding:6px 0;border-bottom:1px solid #f0f7e0;color:#526500;font-size:14px;font-weight:bold;text-align:right;white-space:nowrap;">${fdjFr(l.remaining)}</td>
      </tr>`).join('');
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">🧾 ${m('credit_statement_title', 'Relevé de crédit')}</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${p.holder}</p>
    <div style="text-align:center;padding:20px;background:#f0f7e0;border-radius:12px;margin-bottom:20px;">
      <p style="margin:0;color:#6b7280;font-size:13px;">${m('credit_to_pay_by', 'À régler avant le {date}', { date: `<strong>${dueStr}</strong>` })}</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:bold;color:#526500;">${fdjFr(p.total)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    ${p.outstanding > p.total ? `<p style="margin:12px 0 0;color:#6b7280;font-size:13px;">${m('credit_outstanding_total', 'Encours total, échéances suivantes comprises : {amount}', { amount: fdjFr(p.outstanding) })}</p>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin-top:20px;">${m('credit_how_to_pay', 'Règlement en espèces, par Waafi ou D-Money auprès d\'Hornafresh. Le reçu vous sera envoyé dès réception.')}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:20px;">${m('contact_us', 'Pour toute question, contactez-nous au {phone}.', { phone: '<strong>77432615</strong>' })}</p>
  `, M);
  await deliver({
    from: FROM, to, subject: `🧾 ${m('credit_statement_subject', 'Relevé de crédit Hornafresh — {amount} à régler avant le {date}', { amount: fdjFr(p.total), date: dueStr })}`, html,
    attachments: pdf ? [{ filename: `releve-credit-${p.due}.pdf`, content: pdf }] : undefined,
  });
}
