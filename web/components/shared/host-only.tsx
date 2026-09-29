import { StatusScreen } from '@/components/shared/status-screen';

// Copy chosen by the owner 2026-09-29, plain register (member-home SCOPE.md §7, build-time answers).
const HOST_ONLY = 'This page is for the table host.';

/** What a member sees on a host-only URL instead of an empty list or a thrown fetchBarId (O4(b)). */
export function HostOnly() {
  return <StatusScreen kind='empty' title={HOST_ONLY} action={{ label: 'Home', href: '/' }} />;
}
