// Aides communes aux tests d'API (scripts/phase*_test_*.mjs).

/**
 * Option de livraison réelle la moins chère. Depuis la phase 33, les frais de livraison sont calculés
 * par le serveur à partir de l'option choisie : une commande de test doit donc en désigner une vraie.
 *   const DEL = await cheapestDelivery(admin);
 *   order: { ...DEL.fields, … }        // total attendu = articles + DEL.price
 * Sans aucune option active en base, le serveur n'en exige pas : fields est vide et price vaut 0.
 */
export async function cheapestDelivery(admin) {
  const { data } = await admin.from('delivery_options').select('id, name, price').eq('is_active', true).order('price').order('id').limit(1);
  if (!data?.length) return { fields: {}, name: null, price: 0 };
  return { fields: { delivery_option_id: data[0].id, delivery_option_name: data[0].name }, name: data[0].name, price: Number(data[0].price) || 0 };
}
