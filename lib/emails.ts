import { Resend } from 'resend';
import { buildPrepSlipPdf } from './pdf';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Hornafresh <noreply@hornafresh.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

const STATUS_LABELS: Record<string, string> = {
  pending:    '⏳ En attente',
  processing: '🚚 En cours de préparation',
  shipping:   '📦 Expédié',
  delivered:  '✅ Livré',
  cancelled:  '❌ Annulé',
};

const PAYMENT_LABELS: Record<string, string> = {
  waafi:  '📱 Waafi',
  dmoney: '💳 D-Money',
  cash:   '💵 Espèces (à la livraison)',
  wallet: '💰 Cagnotte (prépayé)',
};

function baseLayout(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8faf0;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde8b0;">
        <!-- Header -->
        <div style="background:#526500;padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:28px;">🌿</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">Hornafresh</h1>
          <p style="margin:4px 0 0;color:#c5d87a;font-size:12px;">Le marché bio de Djibouti</p>
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

function itemsTable(items: any[]) {
  const rows = items.map(item => {
    const name  = item.product_name  || `Produit #${item.product_id}`;
    const unit  = item.product_unit  || '';
    const pu    = `${Number(item.price).toLocaleString('fr-FR')} Fdj${unit}`;
    const subtotal = (item.price * item.quantity).toLocaleString('fr-FR');
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f7e0;color:#374151;font-size:14px;">${name}</td>
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
          <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">Produit</th>
          <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">P.U.</th>
          <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">Qté</th>
          <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:11px;font-weight:normal;border-bottom:2px solid #dde8b0;">Sous-total</th>
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
  customerEmail: string
) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const isWaafi = order.payment_method === 'waafi';
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);
  const fmtDate = new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  const waafiBlock = isWaafi ? `
    <div style="background:#e8f5e0;border:1px solid #a8c800;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:bold;color:#526500;">📱 Paiement Waafi à effectuer</p>
      <p style="margin:0 0 8px;color:#374151;font-size:14px;">
        Envoyez <strong>${Number(order.total).toLocaleString('fr-FR')} Fdj</strong> au numéro :
      </p>
      <p style="margin:0;font-size:28px;font-weight:bold;color:#526500;text-align:center;letter-spacing:4px;">77432615</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;text-align:center;">Hornafresh — Djibouti</p>
    </div>
  ` : '';

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">Commande confirmée 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Référence : <strong>#${shortId}</strong> · ${fmtDate}</p>

    ${itemsTable(items)}

    <div style="background:#f8faf0;border-radius:12px;padding:8px 0;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px 4px;color:#6b7280;font-size:14px;">Sous-total</td>
          <td style="padding:8px 16px 4px;text-align:right;color:#374151;font-size:14px;">${Number(subtotal).toLocaleString('fr-FR')} Fdj</td>
        </tr>
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">🚚 Livraison${order.delivery_option_name ? ` (${order.delivery_option_name})` : ''}</td>
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

    ${waafiBlock}

    ${order.special_instructions ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:20px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#b45309;font-size:13px;">📝 Demande spéciale</p>
      <p style="margin:0;color:#92400e;font-size:14px;">${order.special_instructions}</p>
    </div>` : ''}

    <div style="background:#f0f7e0;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Livraison à</p>
      <p style="margin:0;color:#374151;font-size:14px;font-weight:bold;">${order.customer_name}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📍 ${order.address}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:13px;">📞 ${order.phone}</p>
    </div>

    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
      Notre équipe vous contactera pour confirmer la livraison. Merci pour votre confiance !
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `✅ Commande #${shortId} confirmée — Hornafresh`,
    html,
  });
}

// ── 2. Alerte nouvelle commande → admin ───────────────────────────────────────
export async function sendNewOrderAlert(order: any, items: any[], customerEmail: string | null) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
  const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);

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
        </tr>
        <tr>
          <td style="padding:4px 16px;color:#6b7280;font-size:14px;">🚚 Livraison${order.delivery_option_name ? ` (${order.delivery_option_name})` : ''}</td>
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

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🛍️ Nouvelle commande #${shortId} — ${Number(order.total).toLocaleString('fr-FR')} Fdj`,
    html,
  });
}

// ── 3. Mise à jour statut → client ────────────────────────────────────────────
export async function sendStatusUpdate(order: any, customerEmail: string) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const statusLabel = STATUS_LABELS[order.status] || order.status;

  const messages: Record<string, string> = {
    processing: "Votre commande est en cours de préparation. Nous vous contacterons dès qu'elle est prête.",
    shipping:   'Votre commande est en route ! Notre livreur vous contactera pour la remise.',
    delivered:  'Votre commande a été livrée. Merci pour votre confiance et à bientôt !',
    cancelled:  'Votre commande a été annulée. Contactez-nous si vous avez des questions.',
  };

  const message = messages[order.status] || 'Le statut de votre commande a été mis à jour.';

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">Mise à jour de votre commande</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Référence : <strong>#${shortId}</strong></p>

    <div style="text-align:center;padding:24px;background:#f0f7e0;border-radius:12px;margin-bottom:24px;">
      <p style="margin:0;font-size:32px;">${statusLabel.split(' ')[0]}</p>
      <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:#526500;">${statusLabel.slice(3)}</p>
    </div>

    <p style="color:#374151;font-size:14px;line-height:1.6;">${message}</p>

    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Pour toute question, contactez-nous au <strong>77432615</strong>.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `${statusLabel} — Commande #${shortId} Hornafresh`,
    html,
  });
}

// ── 4. Bordereau de préparation → préparateurs ───────────────────────────────
export async function sendPrepSlipToPreparers(order: any, items: any[], emails: string[]) {
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
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f7e0;font-size:15px;color:#374151;">
      <span style="display:inline-block;width:15px;height:15px;border:2px solid #9ca3af;border-radius:3px;vertical-align:middle;margin-right:10px;"></span>
      <strong style="color:#526500;">${it.quantity} ${unit}</strong> — ${name}<span style="color:#9ca3af;font-size:13px;">${farm}</span>
    </td></tr>`;
  }).join('');

  const specialBlock = order.special_instructions ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px;margin:16px 0;">
      <p style="margin:0 0 4px;font-weight:bold;color:#b45309;font-size:13px;">📝 Demande spéciale</p>
      <p style="margin:0;color:#92400e;font-size:14px;">${order.special_instructions}</p>
    </div>` : '';

  const html = baseLayout(`
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

  await resend.emails.send({
    from: FROM,
    to: emails,
    subject: `🧑‍🍳 À préparer — Commande #${shortId}`,
    html,
    attachments,
  });
}

// ── 5. Abonnement mis en pause (solde insuffisant) → client ──────────────────
export async function sendSubscriptionPaused(email: string, needed: number, balance: number) {
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⏸️ Livraison hebdomadaire en pause</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Votre cagnotte est insuffisante pour la livraison de cette semaine.</p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;color:#92400e;font-size:14px;">Montant nécessaire : <strong>${Number(needed).toLocaleString('fr-FR')} Fdj</strong></p>
      <p style="margin:0;color:#92400e;font-size:14px;">Solde actuel : <strong>${Number(balance).toLocaleString('fr-FR')} Fdj</strong></p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      Rechargez votre cagnotte auprès de notre équipe (Waafi / espèces) pour reprendre vos livraisons automatiques.
      Votre commande type est conservée et reprendra dès le rechargement.
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">Pour recharger, contactez-nous au <strong>77432615</strong>.</p>
  `);
  await resend.emails.send({ from: FROM, to: email, subject: '⏸️ Cagnotte à recharger — Hornafresh', html });
}

// ── 5b. Abonnement arrivé à expiration ───────────────────────────────────────
export async function sendSubscriptionExpired(email: string, freqLabel: string) {
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">⏳ Abonnement arrivé à échéance</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Votre commande type <strong>${freqLabel}</strong> a atteint sa date de validité et a été mise en pause.</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      Pour reprendre vos livraisons automatiques, il vous suffit de renouveler votre commande type
      depuis votre espace : elle repartira pour une nouvelle année.
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">Une question ? Contactez-nous au <strong>77432615</strong>.</p>
  `);
  await resend.emails.send({ from: FROM, to: email, subject: '⏳ Renouvelez votre commande type — Hornafresh', html });
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
  await resend.emails.send({ from: FROM, to: email, subject: i.subject, html });
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
  await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject: `💰 Demande de recharge — ${Number(req.amount).toLocaleString('fr-FR')} Fdj`, html });
}

// ── 7. Recharge validée → client ─────────────────────────────────────────────
export async function sendDepositApproved(email: string, amount: number, balance: number) {
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">✅ Cagnotte rechargée</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Votre recharge a été validée.</p>
    <div style="background:#ecf4d5;border:1px solid #a8c800;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;color:#6b7280;font-size:13px;">Montant crédité</p>
      <p style="margin:2px 0 8px;color:#526500;font-size:22px;font-weight:bold;">+${Number(amount).toLocaleString('fr-FR')} Fdj</p>
      <p style="margin:0;color:#6b7280;font-size:13px;">Nouveau solde : <strong>${Number(balance).toLocaleString('fr-FR')} Fdj</strong></p>
    </div>
    <p style="color:#374151;font-size:14px;">Merci ! Vous pouvez l'utiliser au paiement ou pour vos livraisons automatiques.</p>
  `);
  await resend.emails.send({ from: FROM, to: email, subject: '✅ Cagnotte rechargée — Hornafresh', html });
}
