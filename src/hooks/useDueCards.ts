import { useEffect, useMemo, useState } from 'react';
import type { VocabCard } from '../types';
import { isCardDue, nextDueRefreshDelay } from '../utils/scheduler';

export function useDueCards(cards: VocabCard[]) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      timer = setTimeout(refresh, nextDueRefreshDelay(cards, time));
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [cards]);
  return useMemo(() => cards.filter(card => isCardDue(card, now))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt), [cards, now]);
}
