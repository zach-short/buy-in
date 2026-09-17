const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const fetcher = <T>(path: string) => apiFetch<T>(path);

export interface Player {
  id: string;
  name: string;
  phone?: string;
  venmo?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Spirit' | 'Mixer' | 'Garnish' | 'Syrup' | 'Equipment';
  unit: string;
  qtyOnHand: number;
  reorderThreshold: number;
  costPerUnit: number;
}

export interface Ingredient {
  itemId: string;
  qtyUsed: number;
}

export interface DrinkRecipe {
  id: string;
  name: string;
  price: number;
  costEstimate: number;
  ingredients: Ingredient[];
}

export interface Session {
  id: string;
  name: string;
  date: string;
  status: 'active' | 'closed';
  playerIds: string[];
}

export interface Order {
  id: string;
  sessionId: string;
  playerId: string;
  drinkId: string;
  drinkName: string;
  price: number;
  costEstimate: number;
  timestamp: string;
  paid: boolean;
}

export interface BuyIn {
  id: string;
  sessionId: string;
  playerId: string;
  amount: number;
  timestamp: string;
}

export interface Cashout {
  id: string;
  sessionId: string;
  playerId: string;
  amount: number;
  timestamp: string;
}

export interface Payment {
  id: string;
  playerId: string;
  amount: number;
  note: string;
  direction: 'received' | 'sent';
  timestamp: string;
}

export interface CreateOrderResponse {
  order: Order;
  lowStockWarnings: string[];
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function canMake(drink: DrinkRecipe, inventory: InventoryItem[]): boolean {
  const stock = new Map(inventory.map((i) => [i.id, i.qtyOnHand]));
  return drink.ingredients.every((ing) => (stock.get(ing.itemId) ?? 0) >= ing.qtyUsed);
}

export function openVenmo(handle: string, amount: number) {
  const h = handle.replace(/^@/, '');
  const note = encodeURIComponent('poker');
  const deepLink = `venmo://paycharge?txn=pay&recipients=${h}&amount=${amount.toFixed(2)}&note=${note}`;
  const webUrl = `https://account.venmo.com/pay?recipients=${h}&amount=${amount.toFixed(2)}&note=${note}`;
  window.location.href = deepLink;
  setTimeout(() => { if (!document.hidden) window.location.href = webUrl; }, 1500);
}

export function markPlayerTabPaid(sessionId: string, playerId: string, paid = true) {
  return apiFetch<{ paid: boolean }>(`/api/sessions/${sessionId}/players/${playerId}/paid`, {
    method: 'PATCH',
    body: JSON.stringify({ paid }),
  });
}

export function computeBalance(
  playerId: string,
  orders: Order[],
  buyIns: BuyIn[],
  cashouts: Cashout[],
  payments: Payment[],
): number {
  const drinks   = orders.filter(o => o.playerId === playerId).reduce((s, o) => s + o.price, 0);
  const buys     = buyIns.filter(b => b.playerId === playerId).reduce((s, b) => s + b.amount, 0);
  const outs     = cashouts.filter(c => c.playerId === playerId).reduce((s, c) => s + c.amount, 0);
  const received = payments.filter(p => p.playerId === playerId && p.direction === 'received').reduce((s, p) => s + p.amount, 0);
  const sent     = payments.filter(p => p.playerId === playerId && p.direction === 'sent').reduce((s, p) => s + p.amount, 0);
  return drinks + buys - outs - received + sent;
}
