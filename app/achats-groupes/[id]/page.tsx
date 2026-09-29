import { notFound } from 'next/navigation';
import GroupBuying from '../../../components/GroupBuying';

// Une campagne d'achat groupé : avancement, réservation, groupe (?g=<code>)
export default async function AchatGroupePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <GroupBuying id={Number(id)} />;
}
