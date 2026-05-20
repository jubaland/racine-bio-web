import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  "https://sneuexxysxlwpokhkjho.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZXVleHh5c3hsd3Bva2hramhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTM3OTksImV4cCI6MjA5NDMyOTc5OX0.JizTtZmq83t5KGK2WkMtfIVtUo8VgFg6rI1ZEl4zjZY"
);

export async function fetchProducts() {
  const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function fetchCategories() {
  const { data } = await supabase.from('categories').select('*').order('id', { ascending: true });
  return data || [];
}

export async function fetchPromos() {
  const { data } = await supabase.from('promos').select('*').eq('active', true);
  return data || [];
}

export async function fetchProducers() {
  const { data } = await supabase.from('producers').select('*').order('rating', { ascending: false });
  return data || [];
}