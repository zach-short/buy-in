import { ImageResponse } from 'next/og';

export const alt = 'Buy-In — home bar management for poker nights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Generic on purpose (HANDOFF G4, 2026-09-27): link-preview bots cache this, so it must never
// carry a name, a table or a balance that a revoked link would keep showing.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111111',
          color: '#f5f5f5',
        }}
      >
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: 24, textTransform: 'uppercase' }}>
          Buy-In
        </div>
        <div style={{ fontSize: 40, marginTop: 24, letterSpacing: 6, color: '#a3a3a3' }}>
          HOME BAR MANAGEMENT FOR POKER NIGHTS
        </div>
      </div>
    ),
    size,
  );
}
