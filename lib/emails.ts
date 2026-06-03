import { Resend } from 'resend';

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
    const subtotal = (item.price * item.quantity).toLocaleString('fr-FR');
    return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f7e0;color:#374151;font-size:14px;">${name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f7e0;color:#6b7280;font-size:13px;text-align:center;">×${item.quantity} ${unit}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f7e0;color:#526500;font-size:14px;font-weight:bold;text-align:right;">${subtotal} Fdj</td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding-bottom:8px;color:#6b7280;font-size:12px;font-weight:normal;border-bottom:2px solid #dde8b0;">Produit</th>
          <th style="text-align:center;padding-bottom:8px;color:#6b7280;font-size:12px;font-weight:normal;border-bottom:2px solid #dde8b0;">Qté</th>
          <th style="text-align:right;padding-bottom:8px;color:#6b7280;font-size:12px;font-weight:normal;border-bottom:2px solid #dde8b0;">Sous-total</th>
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
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Référence : <strong>#${shortId}</strong></p>

    ${itemsTable(items)}

    <div style="background:#f8faf0;border-radius:12px;padding:16px;margin:20px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:14px;">Mode de paiement</span>
        <span style="color:#374151;font-size:14px;">${PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #dde8b0;padding-top:8px;margin-top:8px;">
        <span style="color:#1f2937;font-weight:bold;font-size:16px;">Total</span>
        <span style="color:#526500;font-weight:bold;font-size:18px;">${Number(order.total).toLocaleString('fr-FR')} Fdj</span>
      </div>
    </div>

    ${waafiBlock}

    <div style="background:#f0f7e0;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Livraison à</p>
      <p style="margin:0;color:#374151;font-size:14px;">${order.customer_name}</p>
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

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px;">🛍️ Nouvelle commande #${shortId}</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
      ${new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
    </p>

    ${itemsTable(items)}

    <div style="background:#f8faf0;border-radius:12px;padding:16px;margin:20px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:14px;">Mode de paiement</span>
        <span style="color:#374151;font-size:14px;">${PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #dde8b0;padding-top:8px;margin-top:8px;">
        <span style="color:#1f2937;font-weight:bold;font-size:16px;">Total</span>
        <span style="color:#526500;font-weight:bold;font-size:18px;">${Number(order.total).toLocaleString('fr-FR')} Fdj</span>
      </div>
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
