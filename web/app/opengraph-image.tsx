import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

import { CARD_ALT, SITE_TAGLINE } from '@/lib/page-metadata';
import { THEME_COLORS } from '@/lib/theme-colors';

export const alt = CARD_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori takes no CSS variables or oklch(), so the card reads the hex mirror of globals.css
// rather than the tokens themselves; the font is the site's heading face, bundled because
// Satori cannot reach next/font.
const FONT_FAMILY = 'Cinzel';
// Inset of the hairline frame from the image edge, echoing the site's card surfaces.
const FRAME_INSET = 40;

function loadCinzel(): Promise<Buffer> {
  // process.cwd() is the Next.js project directory (web/), per the ImageResponse docs.
  return readFile(join(process.cwd(), 'assets/fonts/Cinzel-SemiBold.ttf'));
}

function BrassRule() {
  return <div style={{ width: 96, height: 2, marginTop: 44, marginBottom: 44, background: THEME_COLORS.primary }} />;
}

// Generic on purpose (HANDOFF G4, 2026-09-27): link-preview bots cache this, so it must never
// carry a name, a table or a balance that a revoked link would keep showing.
export default async function OpenGraphImage() {
  const cinzel = await loadCinzel();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: FRAME_INSET,
          background: THEME_COLORS.background,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: THEME_COLORS.card,
            border: `1px solid ${THEME_COLORS.border}`,
            borderRadius: 6,
          }}
        >
          {/* the trailing letter-spacing would push the word off-centre, so pad the left to match */}
          <div style={{ fontSize: 124, letterSpacing: 28, paddingLeft: 28, color: THEME_COLORS.foreground }}>
            BUY-IN
          </div>
          <BrassRule />
          <div style={{ fontSize: 26, letterSpacing: 6, paddingLeft: 6, color: THEME_COLORS.foreground }}>
            {SITE_TAGLINE.toUpperCase()}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: FONT_FAMILY, data: cinzel, style: 'normal', weight: 600 }],
    },
  );
}
