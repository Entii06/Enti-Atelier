import {
  ArtworkItem,
  ArtworkPuzzleState,
  PlacedPuzzlePieceRecord,
} from '../types';

export const PUZZLE_GRID_VERSION = 2;
export const MONTHS_IN_YEAR = 12;
export const PUZZLE_CANVAS_WIDTH = 1600;
export const PUZZLE_CANVAS_HEIGHT = 900;

export interface ArtworkMonthMeta {
  artworkId: string;
  orderIndex: number;
  monthNumber: number; // 1..12
  monthLabelVi: string; // "Tháng 1" .. "Tháng 12"
  shortBadgeLabelVi: string; // "Tháng 01" .. "Tháng 12"
  pieceCount: number; // 28 | 29 | 30 | 31
  isCurrentMonth: boolean;
  isExtraArtwork: boolean;
}

export interface PuzzleTile {
  index: number; // 0..(pieceCount - 1)
  displayNumber: number; // 1..pieceCount (Day of Month)
  row: number;
  col: number;
  rowCols: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  pathD: string;
}

interface Pt {
  x: number;
  y: number;
}

interface CubicSegment {
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p3: Pt;
}

export function getDaysInMonth(year: number, monthNumber1To12: number): number {
  const safeMonth = (((monthNumber1To12 - 1) % 12) + 12) % 12 + 1;
  return new Date(year, safeMonth, 0).getDate();
}

export function getYearTotalPieces(
  year: number = new Date().getFullYear()
): number {
  let total = 0;
  for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
    total += getDaysInMonth(year, m);
  }
  return total;
}

export function buildArtworkMonthMetaList(
  artworks: ArtworkItem[],
  now: Date = new Date()
): ArtworkMonthMeta[] {
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return artworks.map((art, index) => {
    const monthNumber = (index % MONTHS_IN_YEAR) + 1;
    const isExtraArtwork = index >= MONTHS_IN_YEAR;
    const pieceCount = getDaysInMonth(year, monthNumber);
    const paddedMonth = String(monthNumber).padStart(2, '0');

    return {
      artworkId: art.id,
      orderIndex: index,
      monthNumber,
      monthLabelVi: isExtraArtwork
        ? `Tranh bổ sung #${index - MONTHS_IN_YEAR + 1} (Tháng ${monthNumber})`
        : `Tháng ${monthNumber}`,
      shortBadgeLabelVi: isExtraArtwork
        ? `Bổ sung #${index - MONTHS_IN_YEAR + 1}`
        : `Tháng ${paddedMonth}`,
      pieceCount,
      isCurrentMonth: !isExtraArtwork && monthNumber === currentMonth,
      isExtraArtwork,
    };
  });
}

export function getArtworkMonthMeta(
  artworks: ArtworkItem[],
  artworkId: string,
  now: Date = new Date()
): ArtworkMonthMeta {
  const list = buildArtworkMonthMetaList(artworks, now);
  const found = list.find((m) => m.artworkId === artworkId);
  if (found) return found;

  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return {
    artworkId,
    orderIndex: 0,
    monthNumber: currentMonth,
    monthLabelVi: `Tháng ${currentMonth}`,
    shortBadgeLabelVi: `Tháng ${String(currentMonth).padStart(2, '0')}`,
    pieceCount: getDaysInMonth(year, currentMonth),
    isCurrentMonth: true,
    isExtraArtwork: false,
  };
}

export function getCurrentMonthArtworkId(
  artworks: ArtworkItem[],
  now: Date = new Date()
): string {
  if (artworks.length === 0) return '';
  const currentMonthIndex = now.getMonth(); // 0..11
  if (currentMonthIndex < artworks.length) {
    return artworks[currentMonthIndex].id;
  }
  return artworks[0].id;
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function getRowColumnCounts(pieceCount: number): number[] {
  const safeCount = Math.max(1, Math.round(pieceCount));
  if (safeCount === 28) return [7, 7, 7, 7];
  if (safeCount === 29) return [7, 8, 7, 7];
  if (safeCount === 30) return [6, 6, 6, 6, 6];
  if (safeCount === 31) return [6, 6, 7, 6, 6];

  const rows = Math.max(1, Math.round(Math.sqrt((safeCount * 9) / 16)));
  const baseCols = Math.floor(safeCount / rows);
  const remainder = safeCount % rows;
  const result: number[] = [];
  for (let r = 0; r < rows; r++) {
    result.push(baseCols + (r < remainder ? 1 : 0));
  }
  return result;
}

function fmtCoord(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function mergeSortedUniqueCoords(a: number[], b: number[]): number[] {
  const combined = [...a, ...b].sort((x, y) => x - y);
  const unique: number[] = [];
  for (const val of combined) {
    if (unique.length === 0 || Math.abs(val - unique[unique.length - 1]) > 1e-4) {
      unique.push(val);
    }
  }
  return unique;
}

/**
 * Builds canonical C1-continuous interlocking jigsaw Bezier segments from A -> B.
 * Short staggered sub-segments (< 140 viewBox units) stay straight so tabs never crowd.
 */
function buildCanonicalJigsawEdge(
  a: Pt,
  b: Pt,
  edgeKey: string,
  maxAllowedTabDepth: number
): CubicSegment[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);

  if (length < 140) {
    return [
      {
        p0: a,
        c1: { x: a.x + dx / 3, y: a.y + dy / 3 },
        c2: { x: a.x + (2 * dx) / 3, y: a.y + (2 * dy) / 3 },
        p3: b,
      },
    ];
  }

  const sign = (hashSeed(edgeKey) & 1) === 0 ? 1 : -1;
  const tabDepth = Math.min(length * 0.175, maxAllowedTabDepth, 32) * sign;

  const tx = dx / length;
  const ty = dy / length;
  const nx = -ty;
  const ny = tx;

  const mapPt = (u: number, v: number): Pt => ({
    x: a.x + tx * (u * length) + nx * (v * tabDepth),
    y: a.y + ty * (u * length) + ny * (v * tabDepth),
  });

  const p0 = mapPt(0, 0);
  const j1 = mapPt(0.35, 0);
  const peak = mapPt(0.5, 1.0);
  const j2 = mapPt(0.65, 0);
  const pEnd = mapPt(1, 0);

  return [
    {
      p0,
      c1: mapPt(0.16, 0),
      c2: mapPt(0.3, -0.07),
      p3: j1,
    },
    {
      p0: j1,
      c1: mapPt(0.4, 0.07),
      c2: mapPt(0.33, 1.0),
      p3: peak,
    },
    {
      p0: peak,
      c1: mapPt(0.67, 1.0),
      c2: mapPt(0.6, 0.07),
      p3: j2,
    },
    {
      p0: j2,
      c1: mapPt(0.7, -0.07),
      c2: mapPt(0.84, 0),
      p3: pEnd,
    },
  ];
}

function appendForwardSegments(parts: string[], segs: CubicSegment[]): void {
  for (const s of segs) {
    parts.push(
      `C ${fmtCoord(s.c1.x)} ${fmtCoord(s.c1.y)}, ${fmtCoord(s.c2.x)} ${fmtCoord(
        s.c2.y
      )}, ${fmtCoord(s.p3.x)} ${fmtCoord(s.p3.y)}`
    );
  }
}

function appendReversedSegments(parts: string[], segs: CubicSegment[]): void {
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    parts.push(
      `C ${fmtCoord(s.c2.x)} ${fmtCoord(s.c2.y)}, ${fmtCoord(s.c1.x)} ${fmtCoord(
        s.c1.y
      )}, ${fmtCoord(s.p0.x)} ${fmtCoord(s.p0.y)}`
    );
  }
}

const TILES_CACHE = new Map<string, readonly PuzzleTile[]>();

export function getPuzzleTiles(
  pieceCount: number,
  monthSeed: number = 1
): readonly PuzzleTile[] {
  const safeCount = Math.max(1, Math.round(pieceCount));
  const cacheKey = `${safeCount}:m${monthSeed}`;
  const cached = TILES_CACHE.get(cacheKey);
  if (cached) return cached;

  const rowColsList = getRowColumnCounts(safeCount);
  const rowCount = rowColsList.length;
  const rowHeight = PUZZLE_CANVAS_HEIGHT / rowCount;
  const maxTabDepth = rowHeight * 0.2;

  const rowXBreakpoints: number[][] = rowColsList.map((cols) => {
    const arr: number[] = [];
    for (let c = 0; c <= cols; c++) {
      arr.push((c * PUZZLE_CANVAS_WIDTH) / cols);
    }
    return arr;
  });

  // Precompute shared horizontal boundary sub-segments between row r-1 and row r
  const horizontalSeams: Map<number, { xs: number[]; segs: CubicSegment[][] }> =
    new Map();

  for (let r = 1; r < rowCount; r++) {
    const y = r * rowHeight;
    const jointXs = mergeSortedUniqueCoords(
      rowXBreakpoints[r - 1],
      rowXBreakpoints[r]
    );
    const segsPerInterval: CubicSegment[][] = [];
    for (let k = 0; k < jointXs.length - 1; k++) {
      const xA = jointXs[k];
      const xB = jointXs[k + 1];
      segsPerInterval.push(
        buildCanonicalJigsawEdge(
          { x: xA, y },
          { x: xB, y },
          `h:${monthSeed}:${r}:${k}:${safeCount}`,
          maxTabDepth
        )
      );
    }
    horizontalSeams.set(r, { xs: jointXs, segs: segsPerInterval });
  }

  // Precompute shared vertical edges within each row r at interior column c
  const verticalSeams: Map<string, CubicSegment[]> = new Map();
  for (let r = 0; r < rowCount; r++) {
    const cols = rowColsList[r];
    const yTop = r * rowHeight;
    const yBottom = (r + 1) * rowHeight;
    for (let c = 1; c < cols; c++) {
      const x = rowXBreakpoints[r][c];
      verticalSeams.set(
        `${r}:${c}`,
        buildCanonicalJigsawEdge(
          { x, y: yTop },
          { x, y: yBottom },
          `v:${monthSeed}:${r}:${c}:${safeCount}`,
          Math.min(maxTabDepth, (PUZZLE_CANVAS_WIDTH / cols) * 0.2)
        )
      );
    }
  }

  const tiles: PuzzleTile[] = [];
  let runningIndex = 0;

  for (let r = 0; r < rowCount; r++) {
    const cols = rowColsList[r];
    const yTop = r * rowHeight;
    const yBottom = (r + 1) * rowHeight;

    for (let c = 0; c < cols; c++) {
      const xLeft = rowXBreakpoints[r][c];
      const xRight = rowXBreakpoints[r][c + 1];
      const width = xRight - xLeft;
      const height = rowHeight;

      const dParts: string[] = [`M ${fmtCoord(xLeft)} ${fmtCoord(yTop)}`];

      // 1. Top edge (xLeft -> xRight)
      if (r === 0) {
        dParts.push(`L ${fmtCoord(xRight)} ${fmtCoord(yTop)}`);
      } else {
        const seam = horizontalSeams.get(r)!;
        for (let k = 0; k < seam.xs.length - 1; k++) {
          if (
            seam.xs[k] >= xLeft - 1e-3 &&
            seam.xs[k + 1] <= xRight + 1e-3
          ) {
            appendForwardSegments(dParts, seam.segs[k]);
          }
        }
      }

      // 2. Right edge (yTop -> yBottom)
      if (c === cols - 1) {
        dParts.push(`L ${fmtCoord(xRight)} ${fmtCoord(yBottom)}`);
      } else {
        const vSegs = verticalSeams.get(`${r}:${c + 1}`)!;
        appendForwardSegments(dParts, vSegs);
      }

      // 3. Bottom edge (xRight -> xLeft)
      if (r === rowCount - 1) {
        dParts.push(`L ${fmtCoord(xLeft)} ${fmtCoord(yBottom)}`);
      } else {
        const seam = horizontalSeams.get(r + 1)!;
        for (let k = seam.xs.length - 2; k >= 0; k--) {
          if (
            seam.xs[k] >= xLeft - 1e-3 &&
            seam.xs[k + 1] <= xRight + 1e-3
          ) {
            appendReversedSegments(dParts, seam.segs[k]);
          }
        }
      }

      // 4. Left edge (yBottom -> yTop)
      if (c === 0) {
        dParts.push(`L ${fmtCoord(xLeft)} ${fmtCoord(yTop)}`);
      } else {
        const vSegs = verticalSeams.get(`${r}:${c}`)!;
        appendReversedSegments(dParts, vSegs);
      }

      dParts.push('Z');

      tiles.push({
        index: runningIndex,
        displayNumber: runningIndex + 1,
        row: r,
        col: c,
        rowCols: cols,
        x: xLeft,
        y: yTop,
        width,
        height,
        centerX: xLeft + width / 2,
        centerY: yTop + height / 2,
        pathD: dParts.join(' '),
      });

      runningIndex += 1;
    }
  }

  TILES_CACHE.set(cacheKey, tiles);
  return tiles;
}

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateKeyVi(dateKey: string): string {
  if (!DATE_KEY_REGEX.test(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

export function getSecondsUntilNextLocalMidnight(
  now: Date = new Date()
): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  return Math.ceil(diffMs / 1000);
}

export function formatCountdownHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;
}

function parseLocalDateKeyToDayNumber(dateKey: string): number | null {
  if (!DATE_KEY_REGEX.test(dateKey)) return null;
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const utcMs = Date.UTC(y, m - 1, d);
  return Math.floor(utcMs / 86_400_000);
}

export function computeStreakStats(
  loginDates: string[],
  todayKey: string = getLocalDateKey()
): {
  currentStreak: number;
  longestStreak: number;
  loggedInToday: boolean;
} {
  const uniqueSorted = Array.from(
    new Set(loginDates.filter((d) => DATE_KEY_REGEX.test(d)))
  ).sort();

  if (uniqueSorted.length === 0) {
    return { currentStreak: 0, longestStreak: 0, loggedInToday: false };
  }

  const dayNumbers = uniqueSorted
    .map(parseLocalDateKeyToDayNumber)
    .filter((n): n is number => n !== null);

  if (dayNumbers.length === 0) {
    return { currentStreak: 0, longestStreak: 0, loggedInToday: false };
  }

  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else if (dayNumbers[i] !== dayNumbers[i - 1]) {
      running = 1;
    }
  }

  const todayNum = parseLocalDateKeyToDayNumber(todayKey);
  const daySet = new Set(dayNumbers);
  const loggedInToday = todayNum !== null && daySet.has(todayNum);

  let currentStreak = 0;
  if (todayNum !== null) {
    let cursor = loggedInToday ? todayNum : todayNum - 1;
    while (daySet.has(cursor)) {
      currentStreak += 1;
      cursor -= 1;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    loggedInToday,
  };
}

export interface RecentCheckInDay {
  dateKey: string;
  weekdayLabel: string;
  dayOfMonth: string;
  checkedIn: boolean;
  isToday: boolean;
}

const WEEKDAY_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function buildRecentCheckInDays(
  loginDates: string[],
  today: Date = new Date(),
  daysCount: number = 14
): RecentCheckInDay[] {
  const loginSet = new Set(loginDates);
  const todayKey = getLocalDateKey(today);
  const result: RecentCheckInDay[] = [];

  for (let offset = daysCount - 1; offset >= 0; offset--) {
    const d = new Date(today);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const key = getLocalDateKey(d);
    result.push({
      dateKey: key,
      weekdayLabel: WEEKDAY_SHORT_VI[d.getDay()],
      dayOfMonth: `${d.getDate()}/${d.getMonth() + 1}`,
      checkedIn: loginSet.has(key),
      isToday: key === todayKey,
    });
  }

  return result;
}

export function createInitialPuzzleState(
  defaultArtworkId: string = ''
): ArtworkPuzzleState {
  return {
    gridVersion: PUZZLE_GRID_VERSION,
    loginDates: [],
    selectedArtworkId: defaultArtworkId,
    placedByArtwork: {},
    lastPlacedPiece: null,
    showUnderdrawing: true,
    showGridLines: true,
  };
}

export function sanitizePuzzleState(
  raw: unknown,
  defaultArtworkId: string = '',
  pieceCountByArtwork?: Record<string, number>
): ArtworkPuzzleState {
  const fallback = createInitialPuzzleState(defaultArtworkId);
  if (!raw || typeof raw !== 'object') return fallback;

  const candidate = raw as Partial<ArtworkPuzzleState>;

  const loginDates = Array.isArray(candidate.loginDates)
    ? Array.from(
        new Set(
          candidate.loginDates.filter(
            (d): d is string => typeof d === 'string' && DATE_KEY_REGEX.test(d)
          )
        )
      ).sort()
    : [];

  // When migrating from v1 (365 tiles per artwork) to v2 (12 monthly paintings, 28-31 jigsaw pieces each),
  // preserve 100% of earned loginDates and return old placed pieces back to the user's tray cleanly.
  if (candidate.gridVersion !== PUZZLE_GRID_VERSION) {
    return {
      gridVersion: PUZZLE_GRID_VERSION,
      loginDates,
      selectedArtworkId: defaultArtworkId || candidate.selectedArtworkId || '',
      placedByArtwork: {},
      lastPlacedPiece: null,
      showUnderdrawing:
        typeof candidate.showUnderdrawing === 'boolean'
          ? candidate.showUnderdrawing
          : true,
      showGridLines:
        typeof candidate.showGridLines === 'boolean'
          ? candidate.showGridLines
          : true,
    };
  }

  const maxAllowedPieces = loginDates.length;
  let remainingBudget = maxAllowedPieces;

  const placedByArtwork: Record<string, PlacedPuzzlePieceRecord[]> = {};
  if (
    candidate.placedByArtwork &&
    typeof candidate.placedByArtwork === 'object'
  ) {
    for (const [artworkId, list] of Object.entries(candidate.placedByArtwork)) {
      if (!Array.isArray(list) || remainingBudget <= 0) continue;
      const maxIndexExclusive = pieceCountByArtwork?.[artworkId] ?? 31;
      const seenIndices = new Set<number>();
      const validRecords: PlacedPuzzlePieceRecord[] = [];

      for (const item of list) {
        if (remainingBudget <= 0) break;
        if (!item || typeof item !== 'object') continue;
        const idx = Number((item as PlacedPuzzlePieceRecord).pieceIndex);
        if (
          !Number.isInteger(idx) ||
          idx < 0 ||
          idx >= maxIndexExclusive ||
          seenIndices.has(idx)
        ) {
          continue;
        }
        seenIndices.add(idx);
        remainingBudget -= 1;
        validRecords.push({
          pieceIndex: idx,
          placedDate:
            typeof item.placedDate === 'string' &&
            DATE_KEY_REGEX.test(item.placedDate)
              ? item.placedDate
              : loginDates[loginDates.length - 1] || getLocalDateKey(),
          placedAt:
            typeof item.placedAt === 'number' && Number.isFinite(item.placedAt)
              ? item.placedAt
              : Date.now(),
        });
      }

      if (validRecords.length > 0) {
        placedByArtwork[artworkId] = validRecords;
      }
    }
  }

  let lastPlacedPiece: ArtworkPuzzleState['lastPlacedPiece'] = null;
  if (
    candidate.lastPlacedPiece &&
    typeof candidate.lastPlacedPiece === 'object'
  ) {
    const lp = candidate.lastPlacedPiece;
    const maxForLp =
      typeof lp.artworkId === 'string'
        ? pieceCountByArtwork?.[lp.artworkId] ?? 31
        : 31;
    if (
      typeof lp.artworkId === 'string' &&
      typeof lp.pieceIndex === 'number' &&
      lp.pieceIndex >= 0 &&
      lp.pieceIndex < maxForLp &&
      typeof lp.placedAt === 'number'
    ) {
      lastPlacedPiece = {
        artworkId: lp.artworkId,
        pieceIndex: lp.pieceIndex,
        placedAt: lp.placedAt,
      };
    }
  }

  return {
    gridVersion: PUZZLE_GRID_VERSION,
    loginDates,
    selectedArtworkId:
      typeof candidate.selectedArtworkId === 'string' &&
      candidate.selectedArtworkId.trim()
        ? candidate.selectedArtworkId
        : defaultArtworkId,
    placedByArtwork,
    lastPlacedPiece,
    showUnderdrawing:
      typeof candidate.showUnderdrawing === 'boolean'
        ? candidate.showUnderdrawing
        : true,
    showGridLines:
      typeof candidate.showGridLines === 'boolean'
        ? candidate.showGridLines
        : true,
  };
}

export function applyDailyLoginCheckIn(
  state: ArtworkPuzzleState,
  todayKey: string = getLocalDateKey()
): {
  nextState: ArtworkPuzzleState;
  newlyCheckedInToday: boolean;
} {
  if (!DATE_KEY_REGEX.test(todayKey)) {
    return { nextState: state, newlyCheckedInToday: false };
  }
  if (state.loginDates.includes(todayKey)) {
    return { nextState: state, newlyCheckedInToday: false };
  }

  const nextLoginDates = Array.from(
    new Set([...state.loginDates, todayKey])
  ).sort();

  return {
    nextState: {
      ...state,
      gridVersion: PUZZLE_GRID_VERSION,
      loginDates: nextLoginDates,
    },
    newlyCheckedInToday: true,
  };
}

export function getTotalPlacedPiecesCount(state: ArtworkPuzzleState): number {
  let sum = 0;
  for (const list of Object.values(state.placedByArtwork)) {
    sum += list.length;
  }
  return sum;
}

export function getAvailableUnplacedPieces(state: ArtworkPuzzleState): number {
  return Math.max(
    0,
    state.loginDates.length - getTotalPlacedPiecesCount(state)
  );
}

/**
 * Generates a deterministic, artistically balanced reveal sequence for an artwork's monthly jigsaw grid
 * so automatic daily placements distribute vividly across focal areas and outer canvas.
 */
export function buildCuratedRevealOrder(
  artworkId: string,
  pieceCount: number,
  monthSeed: number = 1
): number[] {
  const seed = hashSeed(artworkId || 'atelier_arles');
  const tiles = getPuzzleTiles(pieceCount, monthSeed);
  const scored = tiles.map((tile) => {
    const cx = tile.centerX / PUZZLE_CANVAS_WIDTH - 0.5;
    const cy = tile.centerY / PUZZLE_CANVAS_HEIGHT - 0.5;
    const distFromCenter = Math.sqrt(cx * cx * 0.85 + cy * cy * 1.15);

    const mixedHash =
      ((Math.imul(tile.index + 1, 2654435761) ^ seed) >>> 0) / 4294967295;
    const score = mixedHash * 0.78 + distFromCenter * 0.22;
    return { index: tile.index, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.map((item) => item.index);
}

export function pickNextCuratedPieceIndex(
  artworkId: string,
  pieceCount: number,
  monthSeed: number,
  unlockedSet: ReadonlySet<number>
): number | null {
  if (unlockedSet.size >= pieceCount) return null;
  const order = buildCuratedRevealOrder(artworkId, pieceCount, monthSeed);
  for (const idx of order) {
    if (!unlockedSet.has(idx)) {
      return idx;
    }
  }
  return null;
}

export function placePieceOnArtwork(
  state: ArtworkPuzzleState,
  artworkId: string,
  pieceCount: number,
  monthSeed: number = 1,
  requestedPieceIndex?: number,
  todayKey: string = getLocalDateKey()
): {
  nextState: ArtworkPuzzleState;
  placedPieceIndex: number | null;
} {
  const safePieceCount = Math.max(1, Math.round(pieceCount));
  const available = getAvailableUnplacedPieces(state);
  if (available <= 0) {
    return { nextState: state, placedPieceIndex: null };
  }

  const existingRecords = state.placedByArtwork[artworkId] || [];
  if (existingRecords.length >= safePieceCount) {
    return { nextState: state, placedPieceIndex: null };
  }

  const unlockedSet = new Set(existingRecords.map((r) => r.pieceIndex));

  let chosenIndex: number | null = null;
  if (
    typeof requestedPieceIndex === 'number' &&
    Number.isInteger(requestedPieceIndex) &&
    requestedPieceIndex >= 0 &&
    requestedPieceIndex < safePieceCount &&
    !unlockedSet.has(requestedPieceIndex)
  ) {
    chosenIndex = requestedPieceIndex;
  } else {
    chosenIndex = pickNextCuratedPieceIndex(
      artworkId,
      safePieceCount,
      monthSeed,
      unlockedSet
    );
  }

  if (chosenIndex === null) {
    return { nextState: state, placedPieceIndex: null };
  }

  const now = Date.now();
  const nextRecord: PlacedPuzzlePieceRecord = {
    pieceIndex: chosenIndex,
    placedDate: todayKey,
    placedAt: now,
  };

  return {
    nextState: {
      ...state,
      gridVersion: PUZZLE_GRID_VERSION,
      selectedArtworkId: artworkId,
      placedByArtwork: {
        ...state.placedByArtwork,
        [artworkId]: [...existingRecords, nextRecord],
      },
      lastPlacedPiece: {
        artworkId,
        pieceIndex: chosenIndex,
        placedAt: now,
      },
    },
    placedPieceIndex: chosenIndex,
  };
}

export function recallArtworkPiecesToTray(
  state: ArtworkPuzzleState,
  artworkId: string
): ArtworkPuzzleState {
  if (!state.placedByArtwork[artworkId]?.length) return state;
  const nextPlaced = { ...state.placedByArtwork };
  delete nextPlaced[artworkId];

  return {
    ...state,
    gridVersion: PUZZLE_GRID_VERSION,
    placedByArtwork: nextPlaced,
    lastPlacedPiece:
      state.lastPlacedPiece?.artworkId === artworkId
        ? null
        : state.lastPlacedPiece,
  };
}
