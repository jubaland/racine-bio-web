'use client';

import { waLink } from '../lib/whatsapp';

// Bouton « cliquer pour discuter » WhatsApp (lien wa.me, nouvel onglet). Gratuit, sans API.
export default function WhatsAppButton({ phone, text, label, className = '', variant = 'solid' }: {
  phone: string;               // numéro international sans « + » (voir lib/whatsapp)
  text?: string;               // message prérempli
  label: string;
  className?: string;
  variant?: 'solid' | 'outline' | 'link';
}) {
  const base = variant === 'solid'
    ? 'inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold rounded-2xl px-4 py-3 hover:bg-[#1ebe5d] transition shadow-sm'
    : variant === 'outline'
    ? 'inline-flex items-center justify-center gap-2 border-2 border-[#25D366] text-[#128C7E] font-semibold rounded-2xl px-4 py-2.5 hover:bg-[#e9fbef] transition'
    : 'inline-flex items-center gap-1.5 text-[#128C7E] hover:underline underline-offset-2';
  return (
    <a href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" className={`${base} ${className}`}>
      <WhatsAppIcon className={variant === 'link' ? 'w-4 h-4' : 'w-5 h-5'} />
      <span>{label}</span>
    </a>
  );
}

export function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  );
}
