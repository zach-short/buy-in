'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the element has scrolled into view. With `once` (the default) it latches true, which is
 * what an entrance animation wants; without it, it tracks, which is what a looping demo wants so
 * it stops running off-screen.
 */
export function useInView<T extends Element>({ once = true }: { once?: boolean } = {}) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, once]);

  return [setNode, inView] as const;
}
