import { redirect } from 'next/navigation';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Sign-up and sign-in are one flow on /login since 2026-09-29 (owner). Links already out there
// — landing pages, bookmarks, old invites — still land in it, with ?redirect= carried over.
export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const { redirect: next } = await searchParams;
  redirect(typeof next === 'string' ? `/login?${new URLSearchParams({ redirect: next })}` : '/login');
}
