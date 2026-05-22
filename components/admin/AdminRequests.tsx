'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Modal, { FormField, inputClass } from './Modal';

interface ProducerRequest {
  id: string;
  full_name: string;
  email: string;
  farm_name: string;
  region: string;
  products_description: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ En attente', cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '✅ Approuvée', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '❌ Refusée', cls: 'bg-red-100 text-red-600' },
};

const TABLE_SETUP_SQL = `
-- Créer la table producer_requests dans Supabase SQL Editor :

create table public.producer_requests (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  farm_name text not null,
  region text,
  products_description text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Activer RLS
alter table public.producer_requests enable row level security;

-- Permettre l'insertion publique (formulaire front)
create policy "Anyone can submit a request"
  on public.producer_requests for insert with check (true);

-- Permettre la lecture aux admins uniquement (via service role ou user_metadata check)
create policy "Admins can view requests"
  on public.producer_requests for select using (true);

create policy "Admins can update requests"
  on public.producer_requests for update using (true);
`.trim();

export default function AdminRequests() {
  const [requests, setRequests] = useState<ProducerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ProducerRequest | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('producer_requests').select('*').order('created_at', { ascending: false });
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data, error } = await query;
    if (error?.code === '42P01') {
      setTableExists(false);
    } else {
      setTableExists(true);
      setRequests(data || []);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    await supabase.from('producer_requests').update({ status }).eq('id', id);
    setUpdating(false);
    if (selectedRequest?.id === id) setSelectedRequest(prev => prev ? { ...prev, status } : null);
    fetchAll();
  };

  const copySQL = () => {
    navigator.clipboard.writeText(TABLE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400">Chargement...</p></div>;
  }

  if (!tableExists) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 Demandes producteurs</h1>
        <div className="bg-white rounded-2xl border border-[#dde8b0] p-8">
          <div className="max-w-lg mx-auto text-center">
            <p className="text-5xl mb-4">🗃️</p>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Table non configurée</h2>
            <p className="text-gray-400 text-sm mb-6">
              La table <code className="bg-[#f0f7e8] px-1 rounded">producer_requests</code> n&apos;existe pas encore dans votre base Supabase.
              Exécutez le SQL ci-dessous pour la créer.
            </p>
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="bg-[#526500] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3d4d00] transition mb-4"
            >
              {showSetup ? 'Masquer le SQL' : '📋 Voir le SQL de configuration'}
            </button>
            {showSetup && (
              <div className="text-left mt-4">
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                    {TABLE_SETUP_SQL}
                  </pre>
                  <button
                    onClick={copySQL}
                    className="absolute top-2 right-2 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg transition"
                  >
                    {copied ? '✓ Copié' : 'Copier'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Allez dans <strong>Supabase Dashboard → SQL Editor</strong> et exécutez ce script, puis rechargez cette page.
                </p>
                <button onClick={fetchAll} className="mt-4 w-full py-2.5 border border-[#dde8b0] rounded-xl text-sm text-gray-600 hover:bg-[#f8faf0] transition">
                  🔄 Vérifier à nouveau
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = (s: string) => STATUS_LABELS[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Demandes producteurs</h1>
        <div className="flex gap-2">
          {[{ value: '', label: 'Toutes' }, ...Object.entries(STATUS_LABELS).map(([v, { label }]) => ({ value: v, label }))].map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === s.value ? 'bg-[#526500] text-white' : 'bg-white border border-[#dde8b0] text-gray-600 hover:border-[#a8c800]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {requests.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#dde8b0]">
            <p className="text-4xl mb-3 opacity-20">📋</p>
            Aucune demande{filterStatus ? ' avec ce statut' : ''}
          </div>
        )}
        {requests.map(req => {
          const info = statusInfo(req.status);
          return (
            <div key={req.id} className="bg-white rounded-2xl border border-[#dde8b0] p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#f0f7e8] flex items-center justify-center text-2xl flex-shrink-0">👨‍🌾</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{req.full_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>{info.label}</span>
                  </div>
                  <p className="text-sm text-gray-500">{req.email}</p>
                  <p className="text-sm text-[#526500] font-medium mt-1">🌱 {req.farm_name}</p>
                  {req.region && <p className="text-xs text-gray-400 mt-0.5">📍 {req.region}</p>}
                  {req.products_description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{req.products_description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-2">{new Date(req.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => setSelectedRequest(req)} className="text-xs text-[#7d9800] hover:text-[#526500] font-medium">
                    Voir détails
                  </button>
                  {req.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(req.id, 'approved')}
                        disabled={updating}
                        className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium"
                      >
                        ✓ Approuver
                      </button>
                      <button
                        onClick={() => updateStatus(req.id, 'rejected')}
                        disabled={updating}
                        className="text-xs bg-red-400 text-white px-3 py-1.5 rounded-lg hover:bg-red-500 transition disabled:opacity-50 font-medium"
                      >
                        ✕ Refuser
                      </button>
                    </>
                  )}
                  {req.status !== 'pending' && (
                    <button
                      onClick={() => updateStatus(req.id, 'pending')}
                      disabled={updating}
                      className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Remettre en attente
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selectedRequest && (
        <Modal title="Détails de la demande" onClose={() => setSelectedRequest(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Nom complet</p>
                <p className="text-sm font-medium text-gray-800">{selectedRequest.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-800">{selectedRequest.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Nom de la ferme</p>
                <p className="text-sm font-medium text-gray-800">{selectedRequest.farm_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Région</p>
                <p className="text-sm font-medium text-gray-800">{selectedRequest.region || '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Produits / Description</p>
              <p className="text-sm text-gray-700 bg-[#f8faf0] rounded-xl p-3">{selectedRequest.products_description || '—'}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[selectedRequest.status]?.cls}`}>
                {STATUS_LABELS[selectedRequest.status]?.label || selectedRequest.status}
              </span>
              <p className="text-xs text-gray-400">{new Date(selectedRequest.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
            {selectedRequest.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { updateStatus(selectedRequest.id, 'rejected'); setSelectedRequest(null); }}
                  disabled={updating}
                  className="flex-1 py-3 bg-red-50 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
                >
                  ✕ Refuser
                </button>
                <button
                  onClick={() => { updateStatus(selectedRequest.id, 'approved'); setSelectedRequest(null); }}
                  disabled={updating}
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition disabled:opacity-50"
                >
                  ✓ Approuver
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
