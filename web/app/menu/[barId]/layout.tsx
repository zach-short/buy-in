import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import type { MenuItem } from '@pb/core';
import { pageMetadata } from '@/lib/page-metadata';
import { fetchMenuForMetadata } from '@/lib/supabase/public-server';

const FALLBACK = "Tonight's drink menu";
const NAMES_SHOWN = 4;

// Only what get_menu already hands any anonymous visitor: drink names and availability. No bar
// name (not publicly readable) and no prices or stock.
function describeMenu(items: MenuItem[]): string {
  const available = items.filter((item) => item.available);
  if (available.length === 0) return FALLBACK;
  const names = available.slice(0, NAMES_SHOWN).map((item) => item.name).join(', ');
  const more = available.length > NAMES_SHOWN ? ', and more' : '';
  const count = `${available.length} ${available.length === 1 ? 'drink' : 'drinks'}`;
  return `${count} on the menu: ${names}${more}`;
}

export async function generateMetadata({ params }: { params: Promise<{ barId: string }> }): Promise<Metadata> {
  const { barId } = await params;
  const items = await fetchMenuForMetadata(barId);
  return pageMetadata({ title: 'Drink menu', description: describeMenu(items) });
}

export default function BarMenuLayout({ children }: { children: ReactNode }) {
  return children;
}
