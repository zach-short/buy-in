import { redirect } from 'next/navigation';

// Merged into /results (B11); kept so old links and bookmarks still land somewhere.
export default function StatsPage() {
  redirect('/results?tab=bar');
}
