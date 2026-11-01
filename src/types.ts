export type BasePaletteKey =
  | 'starry_night'
  | 'sunflowers'
  | 'almond_blossom'
  | 'cafe_terrace';

export type PaintingThemeId = string;

export interface ArtworkItem {
  id: string;
  viTitle: string;
  originalTitle: string;
  locationYear: string;
  medium: string;
  accessionCode: string;
  quoteVi: string;
  quoteSource: string;
  imageSrc: string;
  backupImageSrc?: string;
  imageScaleClass: string;
  fallbackBgClass: string;
  isDark: boolean;
  paletteKey: BasePaletteKey;
  isCustom?: boolean;
}

export type NavSection =
  | 'pomodoro'
  | 'srs'
  | 'vocabulary'
  | 'gallery'
  | 'analytics';

export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

export type PartOfSpeech =
  | 'verb'
  | 'adjective'
  | 'noun'
  | 'adverb'
  | 'phrase'
  | 'idiom'
  | 'phrasal_verb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'determiner'
  | 'interjection';

export enum RecallGrade {
  AGAIN = 1,
  HARD = 3,
  GOOD = 4,
  EASY = 5,
}

export interface VocabCard {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: PartOfSpeech;
  meaning: string;
  example: string;
  notes: string;
  paintingMotif: PaintingThemeId;
  repetitions: number;
  easeFactor: number;
  interval: number; // in days (0 means learning / due same session)
  nextReviewAt: number; // epoch ms
  lastReviewedAt: number | null;
  totalReviews: number;
  lapses: number;
  createdAt: number;
  fsrs?: {
    version: 'FSRS-6';
    stability: number;
    difficulty: number;
    state: 0 | 1 | 2 | 3;
    learningStep: number;
    // Legacy cards use an estimate until FSRS has observed subsequent reviews.
    estimatedFromLegacy?: boolean;
  };
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  soundChimeEnabled: boolean;
  browserNotificationEnabled: boolean;
}

export interface PomodoroSessionRecord {
  id: string;
  mode: PomodoroMode;
  durationMinutes: number;
  completedAt: number;
  intention: string;
  paintingTheme: PaintingThemeId;
}

export interface ReviewLogRecord {
  id: string;
  cardId: string;
  word: string;
  grade: RecallGrade;
  reviewedAt: number;
  newInterval: number;
  practice?: boolean;
  scheduler?: 'FSRS-6';
  dueBeforeReview?: number;
  previousReviewAt?: number | null;
  memoryBefore?: VocabCard['fsrs'];
  memoryAfter?: VocabCard['fsrs'];
}

export type AmbientSoundType = string;

export type SoundSourceKind =
  | 'builtin_rain'
  | 'builtin_wind'
  | 'youtube'
  | 'mp3';

export interface SoundTrack {
  id: string;
  title: string;
  kind: SoundSourceKind;
  url?: string;
  youtubeId?: string;
  isBuiltin?: boolean;
}

export interface PlacedPuzzlePieceRecord {
  pieceIndex: number;
  placedDate: string;
  placedAt: number;
}

export interface ArtworkPuzzleState {
  gridVersion?: number;
  loginDates: string[];
  selectedArtworkId: string;
  placedByArtwork: Record<string, PlacedPuzzlePieceRecord[]>;
  lastPlacedPiece: {
    artworkId: string;
    pieceIndex: number;
    placedAt: number;
  } | null;
  showUnderdrawing: boolean;
  showGridLines: boolean;
}
