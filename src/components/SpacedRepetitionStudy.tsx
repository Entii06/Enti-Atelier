import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import {
  Volume2,
  Eye,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Keyboard,
} from 'lucide-react';
import {
  getPartOfSpeechSlotIndex,
  resolveArtwork,
  resolveArtworkForPartOfSpeech,
} from '../constants/themes';
import { ArtworkItem, RecallGrade, VocabCard } from '../types';
import {
  playDictionaryPronunciation,
  PronunciationAccent,
  speakEnglish,
  stopDictionaryPronunciation,
} from '../utils/audio';
import {
  getCardMaturityLabel,
  previewNextIntervalLabel,
  lookupEnglishDictionary,
  normalizePartOfSpeechInput,
  PART_OF_SPEECH_EN_TAGS,
  PART_OF_SPEECH_LABELS,
} from '../utils/srs';
import { useDueCards } from '../hooks/useDueCards';
import { ArtworkImage } from './ArtworkImage';
import {
  CUTOUT_VIVID_CLASS,
  STARRY_CUTOUTS,
  StarryHeaderAccent,
} from './StarryCutoutAccents';

interface SpacedRepetitionStudyProps {
  cards: VocabCard[];
  artworks: ArtworkItem[];
  onRateCard: (cardId: string, grade: RecallGrade, practice?: boolean) => void;
  onOpenAddWord: () => void;
  reviewedTodayCount: number;
}

type StudyInteractionMode = 'flashcard' | 'typing';
type CardDirection = 'en_to_vi' | 'vi_to_en';

function maskTargetWordInSentence(sentence: string, word: string): string {
  if (!sentence || !word) return sentence;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return sentence;
  const regex = new RegExp(`\\b${escaped}\\w*\\b`, 'gi');
  return sentence.replace(regex, '_______');
}

export const SpacedRepetitionStudy: React.FC<SpacedRepetitionStudyProps> = ({
  cards,
  artworks,
  onRateCard,
  onOpenAddWord,
  reviewedTodayCount,
}) => {
  const [studyMode, setStudyMode] = useState<StudyInteractionMode>('flashcard');
  const [direction, setDirection] = useState<CardDirection>('en_to_vi');
  const [practiceAheadIds, setPracticeAheadIds] = useState<string[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const flipControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const flipRequestRef = useRef(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingChecked, setTypingChecked] = useState<null | boolean>(null);

  const dueCards = useDueCards(cards);

  const activeQueue = useMemo(() => {
    if (dueCards.length > 0) return dueCards;
    if (practiceAheadIds.length > 0) {
      return practiceAheadIds
        .map((id) => cards.find((c) => c.id === id))
        .filter((c): c is VocabCard => Boolean(c));
    }
    return [];
  }, [dueCards, practiceAheadIds, cards]);

  const currentCard: VocabCard | undefined = activeQueue[0];
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const ratingControlsRef = useRef<HTMLDivElement>(null);
  const previousCardIdRef = useRef(currentCard?.id);
  const currentPos = currentCard
    ? normalizePartOfSpeechInput(currentCard.partOfSpeech, currentCard.word)
    : 'verb';
  const currentPosSlot = getPartOfSpeechSlotIndex(currentPos) + 1;
  const currentArtwork = currentCard
    ? resolveArtworkForPartOfSpeech(artworks, currentPos)
    : undefined;

  const preferredAccentRef = useRef<PronunciationAccent>('uk');
  const [fallbackPhonetics, setFallbackPhonetics] = useState<
    Record<string, string>
  >({});
  const fetchedPhoneticIdsRef = useRef<Set<string>>(new Set());

  const currentCardId = currentCard?.id;
  const currentCardWord = currentCard?.word;
  const currentCardPhonetic = currentCard?.phonetic;

  useEffect(() => {
    if (!currentCardId || !currentCardWord) return;
    if (currentCardPhonetic && currentCardPhonetic.trim()) return;
    if (fetchedPhoneticIdsRef.current.has(currentCardId)) return;

    const controller = new AbortController();

    lookupEnglishDictionary(currentCardWord, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        fetchedPhoneticIdsRef.current.add(currentCardId);
        const ipa = res?.phonetic?.trim();
        if (ipa) {
          setFallbackPhonetics((prev) => ({
            ...prev,
            [currentCardId]: ipa,
          }));
        }
      })
      .catch(() => {
        // Ignore network or abort errors
      });

    return () => {
      controller.abort();
    };
  }, [currentCardId, currentCardWord, currentCardPhonetic]);

  const formatIpaDisplay = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (
      (trimmed.startsWith('/') && trimmed.endsWith('/')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return trimmed;
    }
    return `/${trimmed}/`;
  };

  const renderWordMeta = (card: VocabCard) => {
    const rawIpa = card.phonetic.trim() || fallbackPhonetics[card.id] || '';
    const ipa = formatIpaDisplay(rawIpa);
    const cardPos = normalizePartOfSpeechInput(card.partOfSpeech, card.word);

    return (
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--accent)]/30 font-mono text-xs sm:text-sm font-medium text-[var(--accent)]">
          {PART_OF_SPEECH_EN_TAGS[cardPos]}
        </span>
        {ipa && (
          <span className="font-mono text-sm sm:text-base font-medium text-[var(--text-secondary)] tracking-wide">
            {ipa}
          </span>
        )}
      </div>
    );
  };

  const handlePlayWordAccent = (accent: PronunciationAccent) => {
    if (!currentCard) return;
    preferredAccentRef.current = accent;
    void playDictionaryPronunciation(currentCard.word, accent);
  };

  const revealFlashcard = async () => {
    if (isRevealed || isFlipping) return;
    if (prefersReducedMotion) {
      setIsRevealed(true);
      return;
    }

    const request = ++flipRequestRef.current;
    setIsFlipping(true);
    await flipControls.start({ rotateY: 90, transition: { duration: 0.18, ease: 'easeIn' } });
    if (request !== flipRequestRef.current) return;

    // Swap the content while the card is edge-on so the answer turns into view.
    setIsRevealed(true);
    flipControls.set({ rotateY: -90 });
    await flipControls.start({ rotateY: 0, transition: { duration: 0.22, ease: 'easeOut' } });
    if (request === flipRequestRef.current) setIsFlipping(false);
  };

  useEffect(() => {
    flipRequestRef.current += 1;
    flipControls.stop();
    flipControls.set({ rotateY: 0 });
    setIsFlipping(false);
    stopDictionaryPronunciation();
    setIsRevealed(false);
    setTypedAnswer('');
    setTypingChecked(null);
  }, [currentCard?.id, studyMode, direction, flipControls]);

  useEffect(() => {
    const previousId = previousCardIdRef.current;
    previousCardIdRef.current = currentCard?.id;
    if (!currentCard || previousId === currentCard.id) return;

    const frame = window.requestAnimationFrame(() => {
      cardContainerRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentCard?.id]);

  useEffect(() => {
    if (!isRevealed || isFlipping) return;

    // Wait for the answer and rating buttons to be laid out before scrolling.
    const frame = window.requestAnimationFrame(() => {
      const controls = ratingControlsRef.current;
      if (!controls) return;
      const bounds = controls.getBoundingClientRect();
      if (bounds.bottom <= window.innerHeight - 24 && bounds.top >= 0) return;

      controls.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'end',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isRevealed, isFlipping, currentCard?.id]);

  useEffect(() => {
    return () => {
      flipRequestRef.current += 1;
      flipControls.stop();
      stopDictionaryPronunciation();
    };
  }, [flipControls]);

  const handleGrade = (grade: RecallGrade) => {
    if (!currentCard || isFlipping) return;
    stopDictionaryPronunciation();
    if (dueCards.length === 0 && practiceAheadIds.length > 0) {
      setPracticeAheadIds((prev) => prev.filter((id) => id !== currentCard.id));
    }
    onRateCard(currentCard.id, grade, dueCards.length === 0);
    setIsRevealed(false);
    setTypedAnswer('');
    setTypingChecked(null);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return;
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isInput) return;
      if (isFlipping) return;

      if (e.code === 'Space' && !isRevealed && studyMode === 'flashcard') {
        e.preventDefault();
        void revealFlashcard();
        return;
      }

      if (
        (e.key === 's' || e.key === 'S') &&
        (direction === 'en_to_vi' || isRevealed)
      ) {
        e.preventDefault();
        void playDictionaryPronunciation(
          currentCard.word,
          preferredAccentRef.current
        );
        return;
      }

      if (isRevealed) {
        if (e.key === '1') {
          e.preventDefault();
          handleGrade(RecallGrade.AGAIN);
        } else if (e.key === '2') {
          e.preventDefault();
          handleGrade(RecallGrade.HARD);
        } else if (e.key === '3') {
          e.preventDefault();
          handleGrade(RecallGrade.GOOD);
        } else if (e.key === '4') {
          e.preventDefault();
          handleGrade(RecallGrade.EASY);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleCheckTyping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;
    const normalizedInput = typedAnswer.trim().toLowerCase();
    const normalizedTarget = currentCard.word.trim().toLowerCase();
    const correct = normalizedInput === normalizedTarget;
    setTypingChecked(correct);
    setIsRevealed(true);
    void playDictionaryPronunciation(
      currentCard.word,
      preferredAccentRef.current
    );
  };

  const handleStartPracticeAhead = () => {
    const sorted = [...cards]
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, 10)
      .map((c) => c.id);
    setPracticeAheadIds(sorted);
  };

  if (cards.length === 0) {
    return (
      <section className="relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-10 sm:p-14 text-center max-w-3xl mx-auto overflow-hidden">
        <img
          src={STARRY_CUTOUTS.moonHalo}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          decoding="async"
          className={`w-22 h-22 mx-auto mb-4 object-contain opacity-100 pointer-events-none select-none ${CUTOUT_VIVID_CLASS}`}
        />
        <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)] balance-text">
          Kho từ vựng của bạn đang trống
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-3 max-w-xl mx-auto leading-relaxed">
          Hãy tự nhập những từ tiếng Anh đầu tiên bạn muốn ghi nhớ. Hệ thống lặp
          lại ngắt quãng FSRS sẽ tự động tính toán thời điểm ôn tập tối ưu cho
          từng từ.
        </p>
        <div className="mt-7">
          <button
            type="button"
            onClick={onOpenAddWord}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ vựng đầu tiên</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header + Study Controls Bar */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
              Phòng ôn tập ngắt quãng
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] font-mono tabular-nums mt-2">
              <span>Cần ôn: {dueCards.length} thẻ</span>
              <span aria-hidden="true">·</span>
              <span>Đã ôn hôm nay: {reviewedTodayCount} lượt</span>
              <span aria-hidden="true">·</span>
              <span>Tổng kho từ: {cards.length} từ</span>
            </div>
          </div>

          <StarryHeaderAccent variant="srs" className="flex" />
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setStudyMode('flashcard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyMode === 'flashcard'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Lật thẻ
            </button>
            <button
              type="button"
              onClick={() => setStudyMode('typing')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyMode === 'typing'
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Gõ từ nhớ chủ động
            </button>
          </div>

          {studyMode === 'flashcard' && (
            <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setDirection('en_to_vi')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'en_to_vi'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Anh → Việt
              </button>
              <button
                type="button"
                onClick={() => setDirection('vi_to_en')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  direction === 'vi_to_en'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Việt → Anh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Completed Due Queue State */}
      {!currentCard ? (
        <div className="relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] overflow-hidden max-w-3xl mx-auto">
          <div className="h-44 w-full relative border-b border-[var(--border-subtle)]">
            <ArtworkImage
              artwork={resolveArtwork(artworks, 'almond_blossom')}
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent flex items-end justify-between p-6">
              <p className="text-xs font-mono text-white/85">
                Hoàn thành lịch lặp lại ngắt quãng hôm nay
              </p>
            </div>
          </div>
          <div className="relative p-8 sm:p-10 text-center">
            <img
              src={STARRY_CUTOUTS.moonHalo}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              decoding="async"
              className={`w-22 h-22 mx-auto mb-4 object-contain opacity-100 pointer-events-none select-none ${CUTOUT_VIVID_CLASS}`}
            />
            <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)] balance-text">
              Bạn đã ôn hết mọi thẻ từ tới hạn hôm nay
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] mt-3 max-w-xl mx-auto leading-relaxed">
              Não bộ cần khoảng nghỉ giữa các lần lặp lại để củng cố trí nhớ dài
              hạn. Bạn có thể thêm từ mới tự học hoặc ôn trước các thẻ sắp tới
              hạn.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenAddWord}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm từ mới</span>
              </button>

              <button
                type="button"
                onClick={handleStartPracticeAhead}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ôn mở rộng ({Math.min(10, cards.length)} thẻ)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          ref={cardContainerRef}
          animate={flipControls}
          aria-busy={isFlipping}
          style={{ transformPerspective: 1600, backfaceVisibility: 'hidden', pointerEvents: isFlipping ? 'none' : undefined }}
          className="max-w-4xl mx-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] overflow-hidden scroll-mt-4"
        >
          <div className="px-6 sm:px-8 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="font-mono tabular-nums text-[var(--accent)]">
                Ảnh {currentPosSlot}
              </span>
              <span aria-hidden="true">·</span>
              <span>{PART_OF_SPEECH_LABELS[currentPos]}</span>
              <span aria-hidden="true">·</span>
              <span>{getCardMaturityLabel(currentCard)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {currentCard.fsrs ? `Độ bền nhớ ${currentCard.fsrs.stability.toFixed(1)} ngày` : 'FSRS · Mục tiêu nhớ 90%'}
              </span>
              {currentArtwork && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{currentArtwork.viTitle}</span>
                </>
              )}
            </div>

            <div className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              Còn lại trong phiên: {activeQueue.length} thẻ
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--border-subtle)] relative min-h-48 md:min-h-80">
              <ArtworkImage
                artwork={currentArtwork}
                className="w-full h-full absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-5">
                <p className="text-xs font-mono tabular-nums text-white/85">
                  Ảnh {currentPosSlot} · {PART_OF_SPEECH_EN_TAGS[currentPos]}
                </p>
                <p className="font-serif text-lg font-semibold text-white mt-0.5">
                  {currentArtwork?.viTitle || 'Không gian phòng vẽ'}
                </p>
              </div>
            </div>

            <div className="relative md:col-span-8 p-6 sm:p-10 flex flex-col justify-between min-h-80 overflow-hidden">
              <img
                src={STARRY_CUTOUTS.sparkleTrio}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                decoding="async"
                className={`pointer-events-none select-none absolute top-5 right-5 w-14 h-14 object-contain opacity-100 ${CUTOUT_VIVID_CLASS}`}
              />
              {studyMode === 'flashcard' ? (
                <div className="relative z-10 space-y-6">
                  {direction === 'en_to_vi' ? (
                    <div className="pr-16 sm:pr-20">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight">
                          {currentCard.word}
                        </h2>
                        <div className="inline-flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handlePlayWordAccent('uk')}
                            aria-label={`Nghe phát âm Anh - Anh từ ${currentCard.word}`}
                            title="Nghe phát âm Anh - Anh (UK)"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                            <span>Anh-Anh (UK)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayWordAccent('us')}
                            aria-label={`Nghe phát âm Anh - Mỹ từ ${currentCard.word}`}
                            title="Nghe phát âm Anh - Mỹ (US)"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                            <span>Anh-Mỹ (US)</span>
                          </button>
                        </div>
                      </div>
                      {renderWordMeta(currentCard)}
                    </div>
                  ) : (
                    <div className="pr-16 sm:pr-20">
                      <p className="text-xs text-[var(--text-muted)] mb-2">
                        Nghĩa tiếng Việt (hãy nhớ lại từ tiếng Anh tương ứng):
                      </p>
                      <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] leading-snug balance-text">
                        {currentCard.meaning}
                      </h2>
                    </div>
                  )}

                  {isRevealed ? (
                    <div className="pt-5 border-t border-[var(--border-subtle)] space-y-4">
                      {direction === 'en_to_vi' ? (
                        <div>
                          <p className="text-xs text-[var(--text-muted)]">
                            Nghĩa tiếng Việt
                          </p>
                          <p className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mt-1">
                            {currentCard.meaning}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">
                              Từ tiếng Anh
                            </p>
                            <p className="font-serif text-3xl font-semibold text-[var(--text-primary)] mt-0.5">
                              {currentCard.word}
                            </p>
                            {renderWordMeta(currentCard)}
                          </div>
                          <div className="inline-flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handlePlayWordAccent('uk')}
                              aria-label={`Nghe phát âm Anh - Anh từ ${currentCard.word}`}
                              title="Nghe phát âm Anh - Anh (UK)"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                              <span>Anh-Anh (UK)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlayWordAccent('us')}
                              aria-label={`Nghe phát âm Anh - Mỹ từ ${currentCard.word}`}
                              title="Nghe phát âm Anh - Mỹ (US)"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                              <span>Anh-Mỹ (US)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {currentCard.example && (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-[var(--text-muted)]">
                              Câu ví dụ ngữ cảnh
                            </p>
                            <button
                              type="button"
                              onClick={() => speakEnglish(currentCard.example, 0.92)}
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Đọc câu</span>
                            </button>
                          </div>
                          <p className="font-serif italic text-lg text-[var(--text-secondary)] mt-1 leading-relaxed">
                            “{currentCard.example}”
                          </p>
                        </div>
                      )}

                      {currentCard.notes && (
                        <div>
                          <p className="text-xs text-[var(--text-muted)]">
                            Ghi chú ghi nhớ cá nhân
                          </p>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {currentCard.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-8">
                      <button
                        type="button"
                        onClick={() => void revealFlashcard()}
                        disabled={isFlipping}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isFlipping ? 'Đang lật thẻ…' : 'Lật xem đáp án (Phím cách)'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative z-10 space-y-5">
                  <div className="pr-16 sm:pr-20">
                    <p className="text-xs text-[var(--text-muted)]">
                      Nhập từ tiếng Anh tương ứng với nghĩa sau:
                    </p>
                    <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mt-1 balance-text">
                      {currentCard.meaning}
                    </h2>
                    {currentCard.example && !isRevealed && (
                      <p className="font-serif italic text-base text-[var(--text-secondary)] mt-3">
                        Gợi ý ngữ cảnh: “
                        {maskTargetWordInSentence(
                          currentCard.example,
                          currentCard.word
                        )}
                        ”
                      </p>
                    )}
                  </div>

                  {!isRevealed ? (
                    <form onSubmit={handleCheckTyping} className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={typedAnswer}
                          onChange={(e) => setTypedAnswer(e.target.value)}
                          placeholder="Gõ từ tiếng Anh vào đây..."
                          autoFocus
                          autoComplete="off"
                          spellCheck={false}
                          className="flex-1 px-4 py-2.5 text-base font-mono rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Kiểm tra
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setTypingChecked(false);
                            setIsRevealed(true);
                            void playDictionaryPronunciation(
                              currentCard.word,
                              preferredAccentRef.current
                            );
                          }}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                        >
                          Chưa nhớ ra — hiện đáp án
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="pt-5 border-t border-[var(--border-subtle)] space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            {typingChecked ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-[var(--semantic-good)] shrink-0" />
                                <span className="text-sm font-semibold text-[var(--semantic-good)]">
                                  Chính xác tuyệt đối
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-[var(--semantic-danger)] shrink-0" />
                                <span className="text-sm font-semibold text-[var(--semantic-danger)]">
                                  Cần củng cố lại chính tả
                                  {typedAnswer.trim()
                                    ? ` (Bạn gõ: "${typedAnswer.trim()}")`
                                    : ''}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="font-serif text-3xl font-semibold text-[var(--text-primary)] mt-2">
                            {currentCard.word}
                          </p>
                          {renderWordMeta(currentCard)}
                        </div>

                        <div className="inline-flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handlePlayWordAccent('uk')}
                            aria-label={`Nghe phát âm Anh - Anh từ ${currentCard.word}`}
                            title="Nghe phát âm Anh - Anh (UK)"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                            <span>Anh-Anh (UK)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayWordAccent('us')}
                            aria-label={`Nghe phát âm Anh - Mỹ từ ${currentCard.word}`}
                            title="Nghe phát âm Anh - Mỹ (US)"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                            <span>Anh-Mỹ (US)</span>
                          </button>
                        </div>
                      </div>

                      {currentCard.example && (
                        <p className="font-serif italic text-lg text-[var(--text-secondary)]">
                          “{currentCard.example}”
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isRevealed && (
                <div ref={ratingControlsRef} className="mt-6 pt-5 border-t border-[var(--border-subtle)] scroll-mb-6">
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    {dueCards.length === 0
                      ? 'Luyện thêm không thay đổi lịch ôn. Đánh giá để ghi nhận lượt luyện:'
                      : 'Đánh giá mức độ ghi nhớ của bạn để FSRS xếp lịch ôn tiếp theo:'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleGrade(RecallGrade.AGAIN)}
                      className="p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--semantic-danger)] hover:bg-[var(--bg-elevated)] text-center transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-[var(--semantic-danger)] whitespace-nowrap">
                        Quên
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {dueCards.length === 0 ? 'Giữ lịch ôn' : previewNextIntervalLabel(currentCard, RecallGrade.AGAIN)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGrade(RecallGrade.HARD)}
                      className="p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--semantic-warn)] hover:bg-[var(--bg-elevated)] text-center transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-[var(--semantic-warn)] whitespace-nowrap">
                        Khó nhớ
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {dueCards.length === 0 ? 'Giữ lịch ôn' : previewNextIntervalLabel(currentCard, RecallGrade.HARD)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGrade(RecallGrade.GOOD)}
                      className="p-3 rounded-xl border border-[var(--border-strong)] bg-[var(--accent-soft)] hover:bg-[var(--bg-elevated)] text-center transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">
                        Nhớ được
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {dueCards.length === 0 ? 'Giữ lịch ôn' : previewNextIntervalLabel(currentCard, RecallGrade.GOOD)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGrade(RecallGrade.EASY)}
                      className="p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--semantic-good)] hover:bg-[var(--bg-elevated)] text-center transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-semibold text-[var(--semantic-good)] whitespace-nowrap">
                        Rất dễ
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {dueCards.length === 0 ? 'Giữ lịch ôn' : previewNextIntervalLabel(currentCard, RecallGrade.EASY)}
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-8 py-3 bg-[var(--bg-canvas)]/45 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              <span>
                Phím tắt: Space để lật thẻ · Phím 1–4 để chấm mức nhớ · Phím S
                để nghe phát âm
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </section>
  );
};
