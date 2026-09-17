import { ImageResponse } from 'next/og';

export const size = { width: 600, height: 420 };
export const contentType = 'image/png';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Session = { id: string; name: string; date: string };
type Player  = { id: string; name: string };
type Order   = { id: string; playerId: string; drinkName: string; price: number; timestamp: string };

export default async function OgImage({
  params,
}: {
  params: Promise<{ sessionId: string; playerId: string }>;
}) {
  const { sessionId, playerId } = await params;

  let session: Session | null = null;
  let player: Player | null = null;
  let orders: Order[] = [];

  try {
    const [sessions, players, allOrders] = await Promise.all([
      fetch(`${BASE}/api/sessions`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`${BASE}/api/players`,  { cache: 'no-store' }).then(r => r.json()),
      fetch(`${BASE}/api/orders?sessionId=${sessionId}`, { cache: 'no-store' }).then(r => r.json()),
    ]);
    session = (sessions as Session[]).find(s => s.id === sessionId) ?? null;
    player  = (players  as Player[]).find(p => p.id === playerId)   ?? null;
    orders  = (allOrders as Order[])
      .filter(o => o.playerId === playerId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch { /* fallback below */ }

  if (!session || !player) {
    return new ImageResponse(
      <div style={{ background: '#0d0d0d', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6560', fontSize: 18, fontFamily: 'monospace' }}>
        Poker Bar
      </div>,
      { width: 600, height: 420 },
    );
  }

  const total = orders.reduce((s, o) => s + o.price, 0);
  const date  = new Date(session.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const shown = orders.slice(0, 6);
  const extra = orders.length - shown.length;

  return new ImageResponse(
    <div style={{ background: '#0d0d0d', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', fontFamily: 'monospace' }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '32px 40px', width: '100%', display: 'flex', flexDirection: 'column' }}>

        <div style={{ color: '#6b6560', fontSize: 10, letterSpacing: '0.3em', textAlign: 'center', marginBottom: '6px' }}>P O K E R   B A R</div>
        <div style={{ color: '#c9a84c', fontSize: 26, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', marginBottom: '4px' }}>{player.name.toUpperCase()}</div>
        <div style={{ color: '#6b6560', fontSize: 11, textAlign: 'center', marginBottom: '20px' }}>{date}  ·  {session.name}</div>

        <div style={{ borderTop: '1px dashed #2a2a2a', marginBottom: '14px' }} />

        {shown.map(o => (
          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ede8de', marginBottom: '7px' }}>
            <span>{o.drinkName}</span>
            <span style={{ fontWeight: 700 }}>${o.price.toFixed(2)}</span>
          </div>
        ))}
        {extra > 0 && <div style={{ color: '#6b6560', fontSize: 11, marginBottom: '7px' }}>+ {extra} more</div>}
        {orders.length === 0 && <div style={{ color: '#6b6560', fontSize: 12, textAlign: 'center' }}>No orders</div>}

        <div style={{ borderTop: '1px dashed #2a2a2a', margin: '10px 0 14px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c9a84c', fontSize: 17, fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>

      </div>
    </div>,
    { width: 600, height: 420 },
  );
}
