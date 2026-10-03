import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { sendOrderConfirmation, sendNewOrderAlert, sendStatusUpdate, sendPrepSlipToPreparers } from '../../../lib/emails';
import { requirePerm } from '../../../lib/admin-auth';
import { executeCancellation } from '../../../lib/order-cancel';
import { roleOf } from '../../../lib/permissions';
import { cleanLang, langOfOrder } from '../../../lib/i18n-server';
import { monitored } from '../../../lib/monitor';

// POST — crée commande + articles avec vérification et décrémentation du stock
async function POST_(request: Request) {
  try {
    const body = await request.json();
    const { ref_code, use_referral_credit } = body;
    let items: any[] = Array.isArray(body.items) ? body.items : [];
    const rawOrder = body.order || {};
    const companyInput = body.company || null;   // { site_id, request_id? } — commande au nom d'une société

    // ── Identité et champs : jamais ceux envoyés tels quels par le navigateur ─────────────
    const { userFromRequest, membershipOf, companyBalance, adjustCompanyWallet, notifyCompany, minTopupFor, fdj } = await import('../../../lib/company');
    const caller = await userFromRequest(request);
    const PAYMENTS = ['waafi', 'cash', 'wallet', 'company_wallet', 'dmoney'];
    if (!PAYMENTS.includes(rawOrder.payment_method)) return NextResponse.json({ error: 'payment_invalid' }, { status: 400 });
    // Une commande rattachée à un compte doit être passée par ce compte (jeton), sinon n'importe qui
    // pourrait commander — et débiter une cagnotte — au nom d'un autre.
    if (rawOrder.user_id && (!caller || caller.id !== rawOrder.user_id)) return NextResponse.json({ error: 'identity_mismatch' }, { status: 401 });
    const order: any = {
      user_id: rawOrder.user_id ? caller!.id : null,
      total: Number(rawOrder.total) || 0,
      delivery_fee: Number(rawOrder.delivery_fee) || 0,
      delivery_option_name: rawOrder.delivery_option_name ?? null,
      special_instructions: rawOrder.special_instructions ?? null,
      status: 'pending',
      payment_method: rawOrder.payment_method,
      lang: cleanLang(rawOrder.lang),                          // langue choisie à la commande (invités compris)
      phone: rawOrder.phone ?? null, email: rawOrder.email ?? null,
      address: rawOrder.address ?? null, customer_name: rawOrder.customer_name ?? null,
    };

    // ── Commande au nom d'une société (cagnotte société, site de livraison) ───────────────
    let company: any = null, companyRole: string | null = null, companyRequest: any = null;
    if (order.payment_method === 'company_wallet' || companyInput) {
      if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      const m = await membershipOf(caller.id);
      if (!m || m.company?.status !== 'active') return NextResponse.json({ error: 'company_inactive' }, { status: 403 });
      if (!['manager', 'buyer'].includes(m.role)) return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
      company = m.company; companyRole = m.role;
      order.payment_method = 'company_wallet';
      order.user_id = caller.id;
      if (companyInput?.request_id) {
        // Demande d'un acheteur validée par le gérant : lignes et site repris de la demande enregistrée
        if (m.role !== 'manager') return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
        const { data: reqRow } = await supabaseAdmin.from('company_order_requests').select('*').eq('id', companyInput.request_id).eq('company_id', company.id).maybeSingle();
        if (!reqRow || reqRow.status !== 'awaiting') return NextResponse.json({ error: 'request_not_awaiting' }, { status: 409 });
        companyRequest = reqRow;
        items = Array.isArray(reqRow.items) ? reqRow.items : [];
        order.user_id = reqRow.user_id;
        order.delivery_fee = Number(reqRow.delivery?.fee) || 0;
        order.delivery_option_name = reqRow.delivery?.option_name ?? null;
        order.special_instructions = reqRow.delivery?.special_instructions ?? null;
      }
      const siteId = companyRequest?.site_id ?? companyInput?.site_id;
      const { data: site } = siteId
        ? await supabaseAdmin.from('company_sites').select('*').eq('id', siteId).eq('company_id', company.id).maybeSingle()
        : { data: null as any };
      if (!site) return NextResponse.json({ error: 'site_required' }, { status: 400 });
      order.address = site.address; order.phone = site.phone; order.email = null;
      order.customer_name = `${company.name} — ${site.recipient_name}`;
      order.company_id = company.id; order.company_site_id = site.id;
    }
    if (!items.length) return NextResponse.json({ error: 'empty_order' }, { status: 400 });

    // Vérifier le stock disponible pour chaque article
    const productIds = items.map((i: any) => i.product_id);
    const { data: stockData, error: stockErr } = await supabaseAdmin
      .from('products')
      .select('id, name, stock_qty, unit, cost_price, status, owner_id, is_bundle, bundle_ends_at')
      .in('id', productIds);

    if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 400 });

    // Paniers composés : disponibilité = stock du panier ET stock des composants, validité anti-gaspi ;
    // coût = somme des coûts des composants ; composition photographiée pour les préparateurs.
    const { loadBundleContents, bundleAvailability, bundleCost, bundleSnapshot, applyStockDeltas, reserveStock } = await import('../../../lib/bundles');
    const bundleContents = await loadBundleContents(supabaseAdmin, (stockData || []).filter((p: any) => p.is_bundle).map((p: any) => p.id));

    // Produit marchand : commandable seulement si le marchand est actif (abonnement en cours ou formule
    // commission active). Le taux de commission du moment est photographié sur la ligne de commande.
    const ownerIds = [...new Set((stockData || []).map((p: any) => p.owner_id).filter(Boolean))] as string[];
    const { merchantTerms } = await import('../../../lib/merchant-formula');
    const terms = await merchantTerms(ownerIds);
    const activeOwners = new Set<string>(ownerIds.filter(id => terms[id]?.active));
    const commissionRateOf = (productId: number): number | null => {
      const owner = (stockData || []).find((p: any) => p.id === productId)?.owner_id;
      return owner && terms[owner]?.rate > 0 ? terms[owner].rate : null;
    };
    // Un produit non publié ou d'un marchand inactif est traité comme indisponible (stock 0)
    const stockMap: Record<number, { name: string; stock_qty: number; unit: string; cost_price: number | null }> =
      Object.fromEntries((stockData || []).map((p: any) => {
        const orderable = p.status === 'published' && (!p.owner_id || activeOwners.has(p.owner_id));
        if (p.is_bundle) {
          const c = bundleContents[p.id] || [];
          return [p.id, { ...p, stock_qty: orderable ? bundleAvailability(p, c) : 0, cost_price: bundleCost(c), bundle_contents: bundleSnapshot(c) }];
        }
        return [p.id, { ...p, stock_qty: orderable ? p.stock_qty : 0 }];
      }));

    // Prix serveur : prix catalogue ou promotion planifiée active — jamais le prix envoyé par le client
    let priceAdjusted = false;
    try {
      const { activePromotions } = await import('../../../lib/promotions');
      const { data: priced } = await supabaseAdmin.from('products').select('id, price').in('id', productIds);
      const promos = await activePromotions(supabaseAdmin, productIds);
      const serverPrice: Record<number, number> = {};
      for (const p of priced || []) serverPrice[p.id] = promos[p.id] && promos[p.id].promo_price < Number(p.price) ? promos[p.id].promo_price : Number(p.price);
      for (const item of items) {
        if (serverPrice[item.product_id] != null && Number(item.price) !== serverPrice[item.product_id]) { item.price = serverPrice[item.product_id]; priceAdjusted = true; }
      }
    } catch (e) { console.error('[orders] price check:', e); }

    // ── Frais de livraison : toujours calculés ici (tarif de l'option en base, seuil automatique,
    //    code promo, parrainage) — jamais le montant envoyé par le navigateur. Une seule remise, la
    //    plus avantageuse (lib/delivery-pricing.ts). Une demande d'entreprise validée par le gérant
    //    ne porte pas de code : seul le seuil automatique peut s'y appliquer.
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0);
    const { quoteDelivery, reservePromo, attachPromo, releasePromo, cleanPhone } = await import('../../../lib/promo-codes');
    const who = { userId: (order.user_id as string | null) || null, phone: cleanPhone(order.phone) };
    const dq = await quoteDelivery({
      optionId: companyRequest ? null : rawOrder.delivery_option_id, optionName: order.delivery_option_name, subtotal, ...who,
      promoCode: companyRequest ? null : body.promo_code, refCode: companyRequest ? null : ref_code,
      useReferralCredit: !companyRequest && !!use_referral_credit,
    });
    // Option absente ou inconnue alors qu'il en existe : refus (sinon la livraison serait facturée 0)
    if (!dq.option && dq.hasOptions) return NextResponse.json({ error: 'delivery_option_invalid' }, { status: 400 });
    if (dq.option) order.delivery_option_name = dq.option.name;
    // Un code affiché comme appliqué mais plus utilisable : on le dit, plutôt que de facturer sans prévenir
    if (dq.promoError) return NextResponse.json({ error: 'promo_invalid', reason: dq.promoError }, { status: 409 });
    if (dq.referralError) return NextResponse.json({ error: 'referral_invalid', reason: dq.referralError }, { status: 409 });
    order.delivery_fee = dq.quote.fee;
    order.delivery_fee_base = dq.quote.base;
    order.delivery_discount = dq.quote.discount;
    order.delivery_discount_source = dq.quote.source;
    order.promo_code = dq.quote.promo_code;
    order.total = subtotal + dq.quote.fee;

    // Société : au-delà du seuil, la commande d'un acheteur doit être validée par le gérant
    if (company && companyRole === 'buyer' && !companyRequest && company.approval_threshold != null && Number(order.total) > Number(company.approval_threshold)) {
      return NextResponse.json({ error: 'approval_required', threshold: Number(company.approval_threshold), total: Number(order.total) }, { status: 409 });
    }

    const insufficientItems = items.filter((item: any) => {
      const available = stockMap[item.product_id]?.stock_qty ?? 0;
      return item.quantity > available;
    });

    if (insufficientItems.length > 0) {
      return NextResponse.json({
        error: 'stock_insufficient',
        items: insufficientItems.map((item: any) => ({
          product_id: item.product_id,
          name: stockMap[item.product_id]?.name ?? `Produit #${item.product_id}`,
          available: stockMap[item.product_id]?.stock_qty ?? 0,
          unit: stockMap[item.product_id]?.unit ?? '',
          requested: item.quantity,
        })),
      }, { status: 400 });
    }

    // Paiement par cagnotte : vérifier le solde AVANT de créer la commande
    if (order.payment_method === 'wallet') {
      if (!order.user_id) {
        return NextResponse.json({ error: 'wallet_requires_account' }, { status: 400 });
      }
      const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', order.user_id).maybeSingle();
      if ((Number(w?.balance) || 0) < Number(order.total)) {
        return NextResponse.json({ error: 'wallet_insufficient', balance: Number(w?.balance) || 0 }, { status: 400 });
      }
    }
    // Cagnotte société (prépayée) : solde vérifié avant, puis débit atomique après création
    if (company) {
      const bal = await companyBalance(company.id);
      if (bal < Number(order.total)) return NextResponse.json({ error: 'company_wallet_insufficient', balance: bal }, { status: 400 });
    }

    // Réserver le stock AVANT de créer la commande — atomique, tout ou rien (paniers : composants inclus).
    // Deux commandes simultanées sur le dernier article : une seule passe, l'autre reçoit stock_insufficient.
    const orderLines = items.map((item: any) => ({ product_id: item.product_id, quantity: Number(item.quantity) }));
    const reservation = await reserveStock(supabaseAdmin, orderLines);
    if (!reservation.ok) {
      const shortBy: Record<number, { available: number }> = Object.fromEntries(reservation.short.map(s => [s.product_id, s]));
      const blocked = items.filter((item: any) => shortBy[item.product_id] || (bundleContents[item.product_id] || []).some(c => shortBy[c.product_id]));
      return NextResponse.json({
        error: 'stock_insufficient',
        items: (blocked.length ? blocked : items).map((item: any) => {
          // Disponible réel : le produit lui-même, ou ce que permettent les composants manquants d'un panier
          const own = shortBy[item.product_id]?.available;
          const viaComponents = (bundleContents[item.product_id] || []).filter(c => shortBy[c.product_id])
            .map(c => Math.floor(shortBy[c.product_id].available / c.quantity));
          const available = Math.max(0, Math.min(...[own, ...viaComponents].filter((n): n is number => n != null), Number(item.quantity) - 1));
          return { product_id: item.product_id, name: stockMap[item.product_id]?.name ?? `Produit #${item.product_id}`, available, unit: stockMap[item.product_id]?.unit ?? '', requested: item.quantity };
        }),
      }, { status: 400 });
    }
    const stockChanges = reservation.changes;
    const releaseStock = () => applyStockDeltas(supabaseAdmin, orderLines.map((l: any) => ({ product_id: l.product_id, delta: l.quantity }))).catch(e => console.error('[orders] release stock:', e));

    // Code promo : utilisation réservée de façon atomique (limites recomptées sous verrou). Deux
    // commandes simultanées sur la dernière utilisation : une seule passe.
    let redemptionId: number | null = null;
    if (dq.quote.source === 'promo' && dq.promo) {
      const r = await reservePromo(dq.promo.id, who, dq.quote.discount);
      if (!r.ok) { await releaseStock(); return NextResponse.json({ error: 'promo_invalid', reason: r.reason }, { status: 409 }); }
      redemptionId = r.redemptionId;
    }

    // Créer la commande
    const { data: createdOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (orderError) { await releaseStock(); if (redemptionId) await releasePromo(redemptionId); return NextResponse.json({ error: orderError.message }, { status: 400 }); }
    // Utilisation rattachée à la commande : supprimée avec elle si la suite échoue (cascade)
    if (redemptionId) await attachPromo(redemptionId, createdOrder.id);

    // Insérer les articles (snapshot produit)
    const { error: snapshotError } = await supabaseAdmin
      .from('order_items')
      .insert(
        items.map((item: any) => ({
          order_id:          createdOrder.id,
          product_id:        item.product_id,
          quantity:          item.quantity,
          price:             item.price,
          product_name:      item.product_name      ?? null,
          product_image_url: item.product_image_url ?? null,
          product_unit:      item.product_unit      ?? null,
          product_farm:      item.product_farm      ?? null,
          product_cost:      stockMap[item.product_id]?.cost_price ?? null,
          bundle_contents:   (stockMap[item.product_id] as any)?.bundle_contents ?? null,
          commission_rate:   commissionRateOf(item.product_id),
        }))
      );

    // Échec des lignes : on ne laisse ni commande vide ni stock réservé pour rien
    if (snapshotError) {
      await releaseStock();
      await supabaseAdmin.from('orders').delete().eq('id', createdOrder.id);
      return NextResponse.json({ error: snapshotError.message }, { status: 400 });
    }

    // Paiement par cagnotte : débiter une fois la commande complète (commande + lignes)
    if (order.payment_method === 'wallet' && createdOrder.user_id) {
      await supabaseAdmin.rpc('wallet_adjust', {
        p_user: createdOrder.user_id,
        p_amount: -Number(createdOrder.total),
        p_type: 'debit',
        p_order: createdOrder.id,
        p_note: 'Paiement commande',
      });
    }

    // Cagnotte société : débit atomique (refusé si le solde a été dépensé entre-temps → tout est annulé)
    if (company) {
      const debit = await adjustCompanyWallet(company.id, -Number(createdOrder.total), 'debit', { orderId: createdOrder.id, userId: caller!.id, note: `Commande #${createdOrder.id}` });
      if (!debit.ok) {
        await releaseStock();
        await supabaseAdmin.from('order_items').delete().eq('order_id', createdOrder.id);
        await supabaseAdmin.from('orders').delete().eq('id', createdOrder.id);
        return NextResponse.json({ error: 'company_wallet_insufficient', balance: await companyBalance(company.id) }, { status: 400 });
      }
      if (companyRequest) {
        await supabaseAdmin.from('company_order_requests').update({ status: 'approved', order_id: createdOrder.id, decided_by: caller!.id, decided_at: new Date().toISOString() }).eq('id', companyRequest.id);
      }
      try {
        // Gérants prévenus d'une commande passée par un acheteur ; alerte si le solde passe sous la recharge minimale
        if (createdOrder.user_id !== caller!.id || companyRole === 'buyer') {
          await notifyCompany(company.id, ['manager'], { title: `🏢 Commande #${createdOrder.id} — ${fdj(createdOrder.total)}`, body: `Passée pour ${company.name} (${order.customer_name}). Solde de la cagnotte : ${fdj(debit.balance || 0)}.` });
        }
        const floor = await minTopupFor(company);
        if ((debit.balance || 0) < floor) {
          await notifyCompany(company.id, ['manager'], { title: '⚠️ Cagnotte société bientôt vide', body: `Solde : ${fdj(debit.balance || 0)}. Pensez à recharger pour vos prochaines commandes.` });
        }
      } catch (e) { console.error('[orders] company notify:', e); }
    }

    // Consommer un crédit parrainage — seulement si c'est lui qui a offert la livraison
    if (dq.quote.source === 'referral_credit' && createdOrder.user_id) {
      try {
        const { data: rc } = await supabaseAdmin
          .from('referral_codes')
          .select('credits')
          .eq('user_id', createdOrder.user_id)
          .maybeSingle();
        if (rc && rc.credits > 0) {
          await supabaseAdmin
            .from('referral_codes')
            .update({ credits: rc.credits - 1 })
            .eq('user_id', createdOrder.user_id);
        }
      } catch (_) {}
    }

    // Attribuer un crédit au parrain — fire-and-forget
    if (ref_code && createdOrder.user_id) {
      (async () => {
        try {
          // Le code parrainage n'est valable qu'à la 1ère commande du filleul
          const { count: ordersCount } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', createdOrder.user_id);
          if (ordersCount && ordersCount > 1) return; // pas la première commande

          const { data: refRecord } = await supabaseAdmin
            .from('referral_codes')
            .select('user_id, credits')
            .eq('code', String(ref_code).toUpperCase())
            .maybeSingle();
          if (!refRecord || refRecord.user_id === createdOrder.user_id) return;

          const { count } = await supabaseAdmin
            .from('referrals')
            .select('id', { count: 'exact', head: true })
            .eq('referee_id', createdOrder.user_id);
          if (count && count > 0) return; // déjà parrainé

          await supabaseAdmin.from('referrals').insert({
            code:        String(ref_code).toUpperCase(),
            referrer_id: refRecord.user_id,
            referee_id:  createdOrder.user_id,
            order_id:    createdOrder.id,
          });
          await supabaseAdmin
            .from('referral_codes')
            .update({ credits: refRecord.credits + 1 })
            .eq('user_id', refRecord.user_id);
        } catch (_) {}
      })();
    }

    // Push — awaité avant la réponse (< 200ms, serverless-safe)
    try {
      const { sendPushToAdmin } = await import('../../../lib/push');
      const { notifyUser } = await import('../../../lib/notify');
      const shortId = String(createdOrder.id).slice(0, 8).toUpperCase();
      // notifyUser = cloche (historique) + push, pour que la confirmation reste consultable dans le centre de notifications
      if (createdOrder.user_id) await notifyUser(createdOrder.user_id, { title: '✅ Commande confirmée', body: `Commande #${shortId} — ${Number(createdOrder.total).toLocaleString('fr-FR')} Fdj`, url: '/profile',
        i18n: { key: 'order.confirmed', params: { id: shortId, amount: `${Number(createdOrder.total).toLocaleString('fr-FR')} Fdj` } } });
      await sendPushToAdmin({ title: '🛍️ Nouvelle commande', body: `#${shortId} — ${createdOrder.customer_name} — ${Number(createdOrder.total).toLocaleString('fr-FR')} Fdj`, url: '/admin' });

      // Marchands : « nouvelle commande » avec la liste de leurs articles à fournir (cloche + push + e-mail)
      try {
        const byOwner: Record<string, string[]> = {};
        for (const item of items) {
          const p: any = stockMap[item.product_id];
          if (p?.owner_id) (byOwner[p.owner_id] ||= []).push(`${item.quantity} ${p.unit || ''} ${p.name}`.replace(/\s+/g, ' ').trim());
        }
        if (Object.keys(byOwner).length) {
          const { notifyWithEmail } = await import('../../../lib/notify');
          // Mode e-mail du marchand : 'instant' = un e-mail par commande ; 'daily' = récapitulatif du cron (cloche + push restent immédiats)
          const { data: modes } = await supabaseAdmin.from('merchant_profiles').select('user_id, email_mode').in('user_id', Object.keys(byOwner));
          const modeOf: Record<string, string> = Object.fromEntries((modes || []).map((m: any) => [m.user_id, m.email_mode || 'instant']));
          for (const [ownerId, lines] of Object.entries(byOwner)) {
            const title = `🛍️ Nouvelle commande #${createdOrder.id}`;
            const text = `À fournir à Hornafresh : ${lines.join(', ')}. Suivez la commande dans « Mes commandes ».`;
            // cloche + push toujours ; e-mail seulement en mode « un e-mail par commande »
            await notifyWithEmail(ownerId, { title, body: text, url: '/producer/orders',
              subject: modeOf[ownerId] === 'daily' ? null : `Nouvelle commande #${createdOrder.id} — Hornafresh`,
              i18n: { key: 'm.new_order', params: { id: createdOrder.id, lines: lines.join(', ') } } }).catch(() => {});
          }
        }
      } catch (e) { console.error('[orders] merchant notify:', e); }

      // Alertes stock bas — Hornafresh pour ses produits, le marchand pour les siens. Seuil : réglage
      // stock.low_threshold (sans réglage, seule la rupture est signalée).
      // Basées sur les variations réellement appliquées (composants d'un panier inclus).
      const { data: lowSetting } = await supabaseAdmin.from('app_settings').select('value_num').eq('key', 'stock.low_threshold').maybeSingle();
      const LOW = lowSetting?.value_num != null ? Number(lowSetting.value_num) : 0;
      type StockItem = { name: string; newStock: number; wasAbove: boolean; owner: string | null };
      const lowAll: StockItem[] = stockChanges
        .map(c => ({ name: c.name, newStock: c.after, wasAbove: c.before > LOW, owner: c.owner_id }))
        .filter((p: StockItem) => p.newStock <= LOW && p.wasAbove);
      for (const p of lowAll.filter(x => x.owner)) {
        try {
          await notifyUser(p.owner!, {
            title: p.newStock === 0 ? `⛔ Rupture — ${p.name}` : `⚠️ Stock bas — ${p.name}`,
            body: p.newStock === 0 ? 'Votre produit est en rupture : il n\'est plus commandable. Mettez le stock à jour dans « Mes produits ».' : `Plus que ${p.newStock} en stock. Pensez à réapprovisionner dans « Mes produits ».`,
            url: '/producer/products',
            i18n: { key: p.newStock === 0 ? 'm.stock_out' : 'm.stock_low', params: { name: p.name, n: p.newStock } },
          });
        } catch { /* ignore */ }
      }
      const lowStock = lowAll.filter(x => !x.owner);

      if (lowStock.length === 1) {
        const p = lowStock[0];
        await sendPushToAdmin({
          title: `⚠️ Stock bas — ${p.name}`,
          body: `Plus que ${p.newStock} unité${p.newStock !== 1 ? 's' : ''} restante${p.newStock !== 1 ? 's' : ''}`,
          url: '/admin',
        });
      } else if (lowStock.length > 1) {
        await sendPushToAdmin({
          title: `⚠️ Stock bas — ${lowStock.length} produits`,
          body: lowStock.map(p => `${p.name} (${p.newStock})`).join(', '),
          url: '/admin',
        });
      }
    } catch (_) {}

    // Emails — awaités avant la réponse (serverless : le code après le return ne s'exécute pas)
    try {
        let customerEmail: string | null = null;
        if (createdOrder.user_id) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(createdOrder.user_id);
          customerEmail = userData?.user?.email ?? null;
        } else {
          customerEmail = createdOrder.email ?? null; // commande invité
        }
        const emailItems = items.map((item: any) => ({
          ...item,
          product_name: item.product_name ?? stockMap[item.product_id]?.name ?? null,
          product_unit: item.product_unit ?? stockMap[item.product_id]?.unit ?? null,
        }));
        console.log('[email] sending to admin:', process.env.ADMIN_EMAIL, '| customer:', customerEmail);
        await sendNewOrderAlert(createdOrder, emailItems, customerEmail);
        console.log('[email] admin alert sent');
        if (customerEmail) {
          await sendOrderConfirmation(createdOrder, emailItems, customerEmail, await langOfOrder(createdOrder));
          console.log('[email] customer confirmation sent');
        }
        // Bordereau de préparation → tous les préparateurs actifs
        const { data: preparers } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
        const prepEmails = (preparers || []).map((p: any) => p.email).filter(Boolean);
        if (prepEmails.length) {
          await sendPrepSlipToPreparers(createdOrder, emailItems, prepEmails);
          console.log('[email] prep slip sent to', prepEmails.length, 'preparers');
        }
    } catch (err) {
      console.error('[email] ERROR:', err);
    }

    return NextResponse.json({ order: createdOrder, price_adjusted: priceAdjusted, delivery: dq.quote });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — toutes les commandes avec articles (admin / gestionnaire "Commandes")
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, user_id, total, delivery_fee, delivery_fee_base, delivery_discount, delivery_discount_source, promo_code, delivery_option_name, status, payment_method, phone, email, address, customer_name, special_instructions, created_at,
      order_items (
        id, product_id, quantity, price,
        product_name, product_image_url, product_unit, product_farm, bundle_contents
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ orders: data });
}

// PATCH — modifier le statut. Annulation : admin = immédiate ; gestionnaire = demande à valider.
async function PATCH_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, status } = await request.json();
  const role = roleOf(auth.user?.user_metadata);

  // ── Annulation ───────────────────────────────────────────────────────────
  if (status === 'cancelled') {
    // Gestionnaire : créer une demande d'annulation (validée par un admin).
    if (role !== 'admin') {
      const { data: dup } = await supabaseAdmin
        .from('order_cancel_requests').select('id').eq('order_id', id).eq('status', 'pending').maybeSingle();
      if (dup) return NextResponse.json({ ok: true, pending_validation: true });

      await supabaseAdmin.from('order_cancel_requests').insert({
        order_id: id,
        requested_by: auth.user?.id ?? null,
        requested_by_name: auth.user?.user_metadata?.full_name || auth.user?.email || null,
        status: 'pending',
      });
      try {
        const { sendPushToAdmin } = await import('../../../lib/push');
        await sendPushToAdmin({
          title: '🛑 Demande d\'annulation',
          body: `Commande #${String(id).slice(0, 8).toUpperCase()} — à valider`,
          url: '/admin',
        });
      } catch { /* ignore */ }
      return NextResponse.json({ ok: true, pending_validation: true });
    }

    // Admin : annulation immédiate (stock, remboursement, notifs).
    const r = await executeCancellation(id);
    if (!r.ok) return NextResponse.json({ error: r.error || 'Erreur' }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ── Autres statuts : mise à jour directe ───────────────────────────────────
  const { data: updatedOrder, error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Fidélité : une commande livrée pose un tampon (et verse la récompense quand le compte est atteint)
  if (updatedOrder?.status === 'delivered') {
    const { onOrderDelivered } = await import('../../../lib/loyalty');
    await onOrderDelivered(updatedOrder.id);
  }

  // Notifier le client — awaité (serverless : le code après le return ne s'exécute pas)
  try {
    let customerEmail: string | null = null;
    if (updatedOrder?.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(updatedOrder.user_id);
      customerEmail = userData?.user?.email ?? null;
    } else {
      customerEmail = updatedOrder?.email ?? null; // commande invité
    }
    if (customerEmail) await sendStatusUpdate(updatedOrder, customerEmail, await langOfOrder(updatedOrder));

    // Push — uniquement pour les utilisateurs connectés (les invités n'ont pas d'abonnement)
    if (updatedOrder?.user_id) {
      try {
        const { notifyUser } = await import('../../../lib/notify');
        const STATUS_PUSH: Record<string, string> = {
          processing: '🚚 Commande en préparation',
          shipping:   '📦 Commande expédiée',
          delivered:  '✅ Commande livrée !',
          cancelled:  '❌ Commande annulée',
        };
        if (STATUS_PUSH[updatedOrder.status]) {
          // cloche + push (le suivi de statut reste visible dans le centre de notifications)
          await notifyUser(updatedOrder.user_id, {
            title: STATUS_PUSH[updatedOrder.status],
            body: `Commande #${String(updatedOrder.id).slice(0, 8).toUpperCase()}`,
            url: '/profile',
            i18n: { key: `order.${updatedOrder.status}`, params: { id: String(updatedOrder.id).slice(0, 8).toUpperCase() } },
          });
        }
      } catch (_) {}
    }
  } catch (_) { /* email failure must not affect response */ }

  return NextResponse.json({ ok: true });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/orders', POST_);
export const GET = monitored('/api/orders', GET_);
export const PATCH = monitored('/api/orders', PATCH_);
