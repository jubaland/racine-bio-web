import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// GET /api/orders/mine — commandes de l'utilisateur authentifié avec leurs articles
export async function GET(request: Request) {
  // Récupérer le JWT depuis le header Authorization
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Vérifier le token et récupérer l'utilisateur
  const supabaseUser = createClient(
    'https://sneuexxysxlwpokhkjho.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM3OTksImV4cCI6MjA5NDMyOTc5OX0.JizTtZmq83t5KGK2WkMtfIVtUo8VgFg6rI1ZEl4zjZY',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  // Récupérer les commandes + articles via service role (bypass RLS)
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, total, status, payment_method, phone, address, customer_name, created_at,
      order_items (
        id, product_id, quantity, price,
        product_name, product_image_url, product_unit, product_farm
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ orders: data });
}
