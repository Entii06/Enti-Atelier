import type { ArtworkItem, ArtworkPuzzleState, VocabCard, ReviewLogRecord } from '../types';
import { workspaceStorage } from './workspaceStorage.ts';
import { loadReviewHistory, mergeReviewHistory, saveReviewHistory } from './reviewHistory.ts';
import { loadCustomArtworksFromDB, mergeCustomArtworksToDB } from './artworkStorage.ts';

const prefix = 'atelier_arles_';
export const backupKeys = [
  'cards', 'theme', 'deleted_builtins', 'pomo_settings', 'pomo_history',
  'intention', 'custom_sounds', 'deleted_sounds', 'ambient_volume',
  'workspace_color_mode', 'artwork_puzzle', 'timer_offset', 'brightness', 'timer_scale',
].map(name => `${prefix}${name}_v1`);
export const CARDS_KEY = `${prefix}cards_v1`;
const PUZZLE_KEY = `${prefix}artwork_puzzle_v1`;
export interface WorkspaceBackup {
  format: 'enti-atelier-backup';
  version: 1;
  createdAt: string;
  workspace: Record<string, unknown>;
  reviews: ReviewLogRecord[];
  artworks: ArtworkItem[];
}

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown) => number(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const fields = (v: Record<string, any>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
const unique = (v: unknown, check: (x: any) => boolean) => Array.isArray(v) && v.every(x => object(x) && typeof x.id === 'string' && !!x.id && check(x)) && new Set(v.map(x => x.id)).size === v.length;
const memory = (v: any) => v === undefined || (object(v) && v.version === 'FSRS-6' && positive(v.stability) && number(v.difficulty) && v.difficulty >= 1 && v.difficulty <= 10 && [0, 1, 2, 3].includes(v.state) && Number.isInteger(v.learningStep) && v.learningStep >= 0);
const validCard = (v: any) => fields(v, ['word', 'meaning', 'phonetic', 'partOfSpeech', 'example', 'notes', 'paintingMotif']) &&
  ['repetitions', 'easeFactor', 'interval', 'nextReviewAt', 'totalReviews', 'lapses', 'createdAt'].every(k => positive(v[k])) &&
  (v.lastReviewedAt === null || positive(v.lastReviewedAt)) && memory(v.fsrs);
const validReview = (v: any) => fields(v, ['cardId', 'word']) && [1, 3, 4, 5].includes(v.grade) && positive(v.reviewedAt) && positive(v.newInterval) && memory(v.memoryBefore) && memory(v.memoryAfter);
const image = (v: unknown) => typeof v === 'string' && /^(data:image\/(png|jpe?g|webp|gif|avif);base64,|https?:\/\/|\/)/i.test(v);
const validArtwork = (v: any) => fields(v, ['viTitle', 'originalTitle', 'locationYear', 'medium', 'accessionCode', 'quoteVi', 'quoteSource', 'imageScaleClass', 'fallbackBgClass']) && image(v.imageSrc) && (v.backupImageSrc === undefined || image(v.backupImageSrc)) && typeof v.isDark === 'boolean' && ['starry_night', 'sunflowers', 'almond_blossom', 'cafe_terrace'].includes(v.paletteKey);
const dateKey = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
function validPuzzle(v: any) {
  if (!object(v) || !strings(v.loginDates) || !v.loginDates.every(dateKey) || typeof v.selectedArtworkId !== 'string' || !object(v.placedByArtwork) || typeof v.showGridLines !== 'boolean' || typeof v.showUnderdrawing !== 'boolean') return false;
  if (v.gridVersion !== undefined && v.gridVersion !== 2) return false;
  let count = 0;
  for (const pieces of Object.values(v.placedByArtwork)) {
    if (!Array.isArray(pieces) || !pieces.every(p => object(p) && Number.isInteger(p.pieceIndex) && p.pieceIndex >= 0 && p.pieceIndex < 31 && dateKey(p.placedDate) && positive(p.placedAt)) || new Set(pieces.map(p => p.pieceIndex)).size !== pieces.length) return false;
    count += pieces.length;
  }
  return count <= new Set(v.loginDates).size && (v.lastPlacedPiece === null || (object(v.lastPlacedPiece) && typeof v.lastPlacedPiece.artworkId === 'string' && Number.isInteger(v.lastPlacedPiece.pieceIndex) && positive(v.lastPlacedPiece.placedAt)));
}

function validSetting(key: string, v: any): boolean {
  switch (key.slice(prefix.length, -3)) {
    case 'cards': return unique(v, validCard);
    case 'pomo_history': return unique(v, x => ['focus', 'short_break', 'long_break'].includes(x.mode) && positive(x.durationMinutes) && positive(x.completedAt) && fields(x, ['intention', 'paintingTheme']));
    case 'artwork_puzzle': return validPuzzle(v);
    case 'deleted_builtins': case 'deleted_sounds': return strings(v);
    case 'theme': case 'intention': return typeof v === 'string';
    case 'workspace_color_mode': return v === 'light' || v === 'dark';
    case 'ambient_volume': return number(v) && v >= 0 && v <= 1;
    case 'brightness': return number(v) && v >= 20 && v <= 130;
    case 'timer_scale': return number(v) && v >= 60 && v <= 150;
    case 'timer_offset': return object(v) && number(v.x) && number(v.y);
    case 'custom_sounds': return unique(v, x => fields(x, ['title']) && ['builtin_rain', 'builtin_wind', 'youtube', 'mp3'].includes(x.kind) && (x.url === undefined || typeof x.url === 'string') && (x.youtubeId === undefined || typeof x.youtubeId === 'string'));
    case 'pomo_settings': return object(v) && ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes', 'sessionsBeforeLongBreak'].every(k => number(v[k]) && v[k] > 0 && v[k] <= 1440) && typeof v.soundChimeEnabled === 'boolean' && typeof v.browserNotificationEnabled === 'boolean';
    default: return false;
  }
}

/** Validate every section before performing any writes. Reject other JSON import formats. */
export function parseBackup(input: unknown): WorkspaceBackup {
  if (!object(input) || input.format !== 'enti-atelier-backup' || input.version !== 1 || typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt)) || !object(input.workspace) || !unique(input.reviews, validReview) || !unique(input.artworks, validArtwork)) throw new Error('Tệp sao lưu không hợp lệ hoặc phiên bản chưa được hỗ trợ.');
  for (const [key, value] of Object.entries(input.workspace)) {
    if (!backupKeys.includes(key) || !validSetting(key, value)) throw new Error(`Dữ liệu sao lưu không hợp lệ: ${key}.`);
  }
  if (!Object.hasOwn(input.workspace, CARDS_KEY)) throw new Error('Bản sao lưu thiếu kho từ vựng.');
  return input as WorkspaceBackup;
}

export function mergeCards(current: VocabCard[], incoming: VocabCard[]) {
  const cards = new Map(current.map(c => [c.id, c]));
  for (const card of incoming) {
    const existing = cards.get(card.id);
    // Keep current content on ties, and preserve the more recently reviewed FSRS state.
    if (!existing || (card.lastReviewedAt ?? 0) > (existing.lastReviewedAt ?? 0)) cards.set(card.id, card);
  }
  return [...cards.values()];
}

export function mergePuzzle(current: ArtworkPuzzleState, incoming: ArtworkPuzzleState): ArtworkPuzzleState {
  const loginDates = [...new Set([...current.loginDates, ...incoming.loginDates])].sort();
  const placedByArtwork = Object.fromEntries(Object.entries(current.placedByArtwork).map(([id, pieces]) => [id, [...pieces]]));
  // Two devices may have spent the same earned piece on different paintings.
  // Keep at most one placed piece per earned login; extra pieces remain unplaced.
  let remaining = Math.max(0, loginDates.length - Object.values(placedByArtwork).flat().length);
  for (const [id, pieces] of Object.entries(incoming.placedByArtwork)) {
    placedByArtwork[id] ??= [];
    for (const piece of pieces) {
      if (remaining && !placedByArtwork[id].some(p => p.pieceIndex === piece.pieceIndex)) {
        placedByArtwork[id].push(piece);
        remaining--;
      }
    }
  }
  return { ...current, loginDates, placedByArtwork, lastPlacedPiece: null };
}

export async function createBackup(cards: VocabCard[], reviews: ReviewLogRecord[]): Promise<WorkspaceBackup> {
  const raw = await workspaceStorage.exportValues();
  const workspace = Object.fromEntries(backupKeys.filter(key => raw[key] !== undefined).map(key => [key, JSON.parse(raw[key])]));
  workspace[CARDS_KEY] ??= cards;
  workspace[`${prefix}timer_scale_v1`] ??= 100;
  workspace[`${prefix}brightness_v1`] ??= 90;
  workspace[`${prefix}timer_offset_v1`] ??= { x: 0, y: 0 };
  // Failing to read media/history must fail the export, rather than silently omit them.
  const [storedReviews, artworks] = await Promise.all([loadReviewHistory(), loadCustomArtworksFromDB(true)]);
  return parseBackup({ format: 'enti-atelier-backup', version: 1, createdAt: new Date().toISOString(), workspace, reviews: mergeReviewHistory(storedReviews, reviews), artworks });
}

export async function restoreBackup(input: WorkspaceBackup, currentCards: VocabCard[]) {
  const backup = parseBackup(input);
  // Additive writes are idempotent, so retrying a partially interrupted restore is safe.
  await mergeCustomArtworksToDB(backup.artworks);
  await saveReviewHistory(backup.reviews);
  for (const [key, value] of Object.entries(backup.workspace)) {
    await workspaceStorage.updateJSON<any>(key, key === CARDS_KEY ? currentCards : value, current => {
      if (key === CARDS_KEY) return mergeCards(current, value as VocabCard[]);
      if (key === PUZZLE_KEY) return mergePuzzle(current, value as ArtworkPuzzleState);
      if (key.endsWith('pomo_history_v1') || key.endsWith('custom_sounds_v1')) return [...new Map([...value as any[], ...current].map(x => [x.id, x])).values()];
      if (key.endsWith('deleted_builtins_v1') || key.endsWith('deleted_sounds_v1')) return [...new Set([...current, ...value as string[]])];
      return value;
    });
  }
}
