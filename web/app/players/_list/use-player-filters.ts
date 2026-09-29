import { useState } from 'react';

import { hiddenByArchive, matchesBalance, matchesSearch, type BalanceFilter, type PlayerListRow } from './player-list';

// Search, the balance chip and the archived toggle together decide which rows show. Archived
// players with a zero balance sit behind the toggle; everyone else is always eligible.
export function usePlayerFilters<Player extends { name: string }>(rows: readonly PlayerListRow<Player>[]) {
  const [query, setQuery]               = useState('');
  const [filter, setFilter]             = useState<BalanceFilter>('all');
  const [showArchived, setShowArchived] = useState(false);

  const hiddenCount = rows.filter(hiddenByArchive).length;
  const visible = rows.filter((row) =>
    (showArchived || !hiddenByArchive(row))
    && matchesBalance(row.balanceCents, filter)
    && matchesSearch(row.player.name, query),
  );

  return { query, setQuery, filter, setFilter, showArchived, setShowArchived, hiddenCount, visible };
}
