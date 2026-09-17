import { Metadata } from 'next';
import ReceiptUI from './receipt-ui';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string; playerId: string }>;
}): Promise<Metadata> {
  const { sessionId, playerId } = await params;
  try {
    const [sessions, players] = await Promise.all([
      fetch(`${BASE}/api/sessions`, { cache: 'no-store' }).then((r) =>
        r.json(),
      ),
      fetch(`${BASE}/api/players`, { cache: 'no-store' }).then((r) => r.json()),
    ]);
    const session = sessions.find(
      (s: { id: string; date: string }) => s.id === sessionId,
    );
    const player = players.find(
      (p: { id: string; name: string }) => p.id === playerId,
    );
    if (!session || !player) return { title: 'Receipt' };
    const date = new Date(session.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = `${player.name} Receipt — ${date}`;
    return {
      title: { absolute: title },
      openGraph: { title, description: `${player.name}'s bar tab · ${date}` },
    };
  } catch {
    return { title: 'Receipt' };
  }
}

export default function PublicReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string; playerId: string }>;
}) {
  return <ReceiptUI params={params} />;
}
