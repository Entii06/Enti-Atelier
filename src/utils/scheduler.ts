import { dateChrono, defineScheduler, Rating, State } from 'ts-fsrs';
import {
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerStatsMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
} from 'ts-fsrs/middlewares';
import { FSRS6Model, FSRS6_DEFAULT_WEIGHTS } from 'ts-fsrs/models/fsrs-6';
import { RecallGrade } from '../types.ts';
import type { VocabCard } from '../types.ts';

const DAY_MS = 86_400_000;
const MAX_DAYS = 36_500;

// Match the library's standard policy, using the explicit FSRS-6 model.
const scheduler = defineScheduler({ model: FSRS6Model, chrono: dateChrono })
  .use(
    schedulerDesiredRetentionMiddleware, schedulerFuzzingMiddleware,
    schedulerStatsMiddleware, schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware, schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  )
  .create({ config: {
    weights: [...FSRS6_DEFAULT_WEIGHTS],
    desiredRetention: 0.9,
    fractionalDays: true,
    enableShortTerm: true,
    numRelearningSteps: 1,
    learningSteps: ['1m', '10m'],
    relearningSteps: ['10m'],
    enableFuzz: false,
    maximumInterval: MAX_DAYS,
    clearStatsOnForget: true,
  } });

const ratings = {
  [RecallGrade.AGAIN]: Rating.Again,
  [RecallGrade.HARD]: Rating.Hard,
  [RecallGrade.GOOD]: Rating.Good,
  [RecallGrade.EASY]: Rating.Easy,
} as const;

function bounded(value: number, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Validate imported/local data without moving any valid due dates. */
export function normalizeSchedule(card: VocabCard, now = Date.now()): VocabCard {
  const totalReviews = Math.floor(bounded(card.totalReviews, 0, 0, Number.MAX_SAFE_INTEGER));
  const lastReviewedAt = card.lastReviewedAt === null ? null
    : bounded(card.lastReviewedAt, now, 0, now);
  const memory = card.fsrs;
  const validMemory = memory?.version === 'FSRS-6'
    && [0, 1, 2, 3].includes(memory.state)
    && Number.isFinite(memory.stability) && Number.isFinite(memory.difficulty)
    && (memory.state === State.New
      ? memory.stability === 0 && memory.difficulty === 0 && totalReviews === 0
      : memory.stability >= 0.001 && memory.stability <= MAX_DAYS
        && memory.difficulty >= 1 && memory.difficulty <= 10 && lastReviewedAt !== null)
    && Number.isInteger(memory.learningStep) && memory.learningStep >= 0 && memory.learningStep <= 1;
  return {
    ...card,
    totalReviews,
    lastReviewedAt,
    repetitions: Math.floor(bounded(card.repetitions, 0, 0, Number.MAX_SAFE_INTEGER)),
    easeFactor: bounded(card.easeFactor, 2.5, 1.3, 5),
    interval: bounded(card.interval, 0, 0, MAX_DAYS),
    nextReviewAt: bounded(card.nextReviewAt, now, 0, 8.64e15),
    lapses: Math.floor(bounded(card.lapses, 0, 0, Number.MAX_SAFE_INTEGER)),
    fsrs: validMemory ? memory : undefined,
  };
}

function toSchedulerCard(input: VocabCard, now: number) {
  const card = normalizeSchedule(input, now);
  const empty = scheduler.newCard({ cardId: card.id, now: new Date(now) });
  // SM-2 does not store FSRS memory. Preserve its schedule and counters;
  // seed a conservative estimate, rather than inventing missing review history.
  const memory = card.fsrs ?? (card.totalReviews > 0 ? {
    version: 'FSRS-6' as const,
    stability: Math.max(0.1, card.interval),
    difficulty: 5,
    state: card.interval > 0 ? State.Review : State.Relearning,
    learningStep: 0,
    estimatedFromLegacy: true,
  } : undefined);
  const state = memory?.state ?? State.New;
  return {
    ...empty,
    stability: memory?.stability ?? 0,
    difficulty: memory?.difficulty ?? 0,
    state,
    scheduleStatus: state === State.New ? 'new' as const
      : state === State.Review ? 'review' as const : 'learning' as const,
    dueAt: new Date(card.nextReviewAt),
    lastReviewAt: state === State.New ? null
      : new Date(card.lastReviewedAt ?? Math.max(0, now - card.interval * DAY_MS)),
    reps: card.totalReviews,
    lapses: card.lapses,
    scheduledDays: card.interval,
    learningStep: memory?.learningStep ?? 0,
  };
}

/** Early practice is separate from scheduling and never changes card progress. */
export function reviewCard(input: VocabCard, grade: RecallGrade, now = Date.now(), practice = false) {
  if (!Object.hasOwn(ratings, grade)) throw new Error('Invalid recall grade');
  if (practice) return input;
  const card = normalizeSchedule(input, now);
  const result = scheduler.review({ card: toSchedulerCard(card, now), grade: ratings[grade], now: new Date(now) }).card;
  return {
    ...card,
    repetitions: grade === RecallGrade.AGAIN ? 0 : card.repetitions + 1,
    interval: result.scheduledDays,
    nextReviewAt: result.dueAt.getTime(),
    lastReviewedAt: now,
    totalReviews: card.totalReviews + 1,
    lapses: result.lapses,
    fsrs: {
      version: 'FSRS-6' as const,
      stability: result.stability,
      difficulty: result.difficulty,
      state: result.state,
      learningStep: result.learningStep,
      estimatedFromLegacy: card.fsrs?.estimatedFromLegacy || (!card.fsrs && card.totalReviews > 0),
    },
  } satisfies VocabCard;
}

export function previewNextIntervalLabel(card: VocabCard, grade: RecallGrade, now = Date.now()) {
  const next = reviewCard(card, grade, now);
  const minutes = Math.max(1, Math.round((next.nextReviewAt - now) / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} giờ`;
  return `${Math.round(minutes / 1440)} ngày`;
}

export function isCardDue(card: VocabCard, now = Date.now()) {
  return card.nextReviewAt <= now;
}

export function nextDueRefreshDelay(cards: VocabCard[], now: number) {
  const next = cards.reduce((min, card) => card.nextReviewAt > now ? Math.min(min, card.nextReviewAt) : min, Infinity);
  return Math.min(30_000, Math.max(1, next - now));
}
