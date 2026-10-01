import { Cinzel, Courier_Prime } from 'next/font/google';

// The faces the receipt and portal pages draw with, in place of a Google Fonts `@import` inside
// each page's <style> block. That @import held rendering until Google's stylesheet answered and
// sent every guest's phone to a third party; next/font downloads the files at build time, serves
// them from this origin, and preloads them only on the routes that import this file.
//
// Faces, weights and fallback chains are what the @imports asked for: Courier Prime 400 and 700
// upright, then Courier New and monospace; Cinzel 400 and 600, then serif. `subsets` only picks
// what is preloaded. The files for the other unicode ranges are still emitted and load on demand
// (a name with an accent outside latin still draws in the face), as the Google stylesheet's
// unicode-range blocks did.
//
// Apply with `className` on the element that used to carry `font-family`, never on <body>: the
// weights are listed, so the class sets only the family and style, and each rule keeps its own
// `font-weight`.

// adjustFontFallback is off for this one: its generated fallback is Arial scaled to 134.5%
// (checked in the built CSS), a proportional sans a slow connection would show in place of the
// monospace Courier New these pages drew before the face loaded.
export const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Courier New', 'monospace'],
  adjustFontFallback: false,
});

export const cinzel = Cinzel({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['serif'],
});
