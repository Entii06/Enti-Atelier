import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock,
  Eye,
  EyeOff,
  Grid3X3,
  ImagePlus,
  Layers,
  Puzzle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  getBuiltinBackupImageSrc,
  getPartOfSpeechForSlotIndex,
} from '../constants/themes';
import {
  ArtworkItem,
  ArtworkPuzzleState,
  PaintingThemeId,
  PlacedPuzzlePieceRecord,
} from '../types';
import {
  buildArtworkMonthMetaList,
  buildRecentCheckInDays,
  computeStreakStats,
  formatCountdownHMS,
  formatDateKeyVi,
  getAvailableUnplacedPieces,
  getCurrentMonthArtworkId,
  getLocalDateKey,
  getPuzzleTiles,
  getSecondsUntilNextLocalMidnight,
  getTotalPlacedPiecesCount,
  getYearTotalPieces,
  MONTHS_IN_YEAR,
  PUZZLE_CANVAS_HEIGHT,
  PUZZLE_CANVAS_WIDTH,
} from '../utils/artworkPuzzle';
import { PART_OF_SPEECH_EN_TAGS, PART_OF_SPEECH_LABELS } from '../utils/srs';
import { ArtworkImage } from './ArtworkImage';
import { StarryHeaderAccent } from './StarryCutoutAccents';

interface ArtworkVaultViewProps {
  artworks: ArtworkItem[];
  activeTheme: PaintingThemeId;
  puzzleState: ArtworkPuzzleState;
  onSelectPuzzleArtwork: (artworkId: string) => void;
  onPlacePiece: (artworkId: string, targetPieceIndex?: number) => void;
  onRecallPieces: (artworkId: string) => void;
  onToggleUnderdrawing: () => void;
  onToggleGridLines: () => void;
  onApplyAsPomodoroTheme: (artworkId: string) => void;
  onOpenAddArtwork: () => void;
}

export const ArtworkVaultView: React.FC<ArtworkVaultViewProps> = ({
  artworks,
  activeTheme,
  puzzleState,
  onSelectPuzzleArtwork,
  onPlacePiece,
  onRecallPieces,
  onToggleUnderdrawing,
  onToggleGridLines,
  onApplyAsPomodoroTheme,
  onOpenAddArtwork,
}) => {
  const uniqueSvgKey = useId().replace(/:/g, '');
  const revealMaskId = `puzzle-reveal-mask-${uniqueSvgKey}`;
  const fallbackGradId = `puzzle-fallback-grad-${uniqueSvgKey}`;

  const [hoveredTileIndex, setHoveredTileIndex] = useState<number | null>(null);
  const [usingBackupImage, setUsingBackupImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmRecall, setConfirmRecall] = useState(false);
  const [secondsToMidnight, setSecondsToMidnight] = useState<number>(() =>
    getSecondsUntilNextLocalMidnight()
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsToMidnight(getSecondsUntilNextLocalMidnight());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nowDate = useMemo(() => new Date(), [secondsToMidnight > 86398]);
  const activeYear = nowDate.getFullYear();
  const yearlyTotalPieces = useMemo(
    () => getYearTotalPieces(activeYear),
    [activeYear]
  );

  const monthMetaList = useMemo(
    () => buildArtworkMonthMetaList(artworks, nowDate),
    [artworks, nowDate]
  );

  const monthMetaById = useMemo(() => {
    const map = new Map(monthMetaList.map((m) => [m.artworkId, m]));
    return map;
  }, [monthMetaList]);

  const currentMonthArtworkId = useMemo(
    () => getCurrentMonthArtworkId(artworks, nowDate),
    [artworks, nowDate]
  );

  const selectedArtwork = useMemo(() => {
    if (artworks.length === 0) return undefined;
    return (
      artworks.find((a) => a.id === puzzleState.selectedArtworkId) ||
      artworks.find((a) => a.id === currentMonthArtworkId) ||
      artworks[0]
    );
  }, [artworks, puzzleState.selectedArtworkId, currentMonthArtworkId]);

  const activeMonthMeta = useMemo(() => {
    if (!selectedArtwork) {
      return {
        artworkId: '',
        orderIndex: 0,
        monthNumber: nowDate.getMonth() + 1,
        monthLabelVi: `Tháng ${nowDate.getMonth() + 1}`,
        shortBadgeLabelVi: `Tháng ${String(nowDate.getMonth() + 1).padStart(
          2,
          '0'
        )}`,
        pieceCount: 31,
        isCurrentMonth: true,
        isExtraArtwork: false,
      };
    }
    return (
      monthMetaById.get(selectedArtwork.id) || {
        artworkId: selectedArtwork.id,
        orderIndex: 0,
        monthNumber: 1,
        monthLabelVi: 'Tháng 1',
        shortBadgeLabelVi: 'Tháng 01',
        pieceCount: 31,
        isCurrentMonth: false,
        isExtraArtwork: false,
      }
    );
  }, [selectedArtwork, monthMetaById, nowDate]);

  const activePieceCount = activeMonthMeta.pieceCount;

  const activeTiles = useMemo(
    () => getPuzzleTiles(activePieceCount, activeMonthMeta.monthNumber),
    [activePieceCount, activeMonthMeta.monthNumber]
  );

  const primaryPuzzleImageSrc = selectedArtwork?.imageSrc || '';
  const candidateBackupImageSrc =
    selectedArtwork?.backupImageSrc ||
    (selectedArtwork && !selectedArtwork.isCustom
      ? getBuiltinBackupImageSrc(selectedArtwork.id, selectedArtwork.viTitle)
      : '');
  const backupPuzzleImageSrc =
    candidateBackupImageSrc && candidateBackupImageSrc !== primaryPuzzleImageSrc
      ? candidateBackupImageSrc
      : '';
  const effectivePuzzleImageSrc =
    usingBackupImage && backupPuzzleImageSrc
      ? backupPuzzleImageSrc
      : primaryPuzzleImageSrc;

  useEffect(() => {
    setUsingBackupImage(false);
    setImageFailed(false);
    setHoveredTileIndex(null);
    setConfirmRecall(false);
  }, [selectedArtwork?.id, primaryPuzzleImageSrc, backupPuzzleImageSrc]);

  const todayKey = getLocalDateKey();
  const unplacedPiecesCount = useMemo(
    () => getAvailableUnplacedPieces(puzzleState),
    [puzzleState]
  );
  const totalPlacedAcrossAll = useMemo(
    () => getTotalPlacedPiecesCount(puzzleState),
    [puzzleState]
  );

  const completedMonthsCount = useMemo(() => {
    let completed = 0;
    for (const meta of monthMetaList) {
      if (meta.isExtraArtwork) continue;
      const placed = puzzleState.placedByArtwork[meta.artworkId]?.length || 0;
      if (placed >= meta.pieceCount) {
        completed += 1;
      }
    }
    return completed;
  }, [monthMetaList, puzzleState.placedByArtwork]);

  const streakStats = useMemo(
    () => computeStreakStats(puzzleState.loginDates, todayKey),
    [puzzleState.loginDates, todayKey]
  );

  const recentDays = useMemo(
    () => buildRecentCheckInDays(puzzleState.loginDates, new Date(), 14),
    [puzzleState.loginDates]
  );

  const activeRecords: PlacedPuzzlePieceRecord[] = useMemo(() => {
    if (!selectedArtwork) return [];
    const raw = puzzleState.placedByArtwork[selectedArtwork.id] || [];
    return raw.filter(
      (r) => r.pieceIndex >= 0 && r.pieceIndex < activePieceCount
    );
  }, [puzzleState.placedByArtwork, selectedArtwork, activePieceCount]);

  const unlockedMap = useMemo(() => {
    const map = new Map<number, PlacedPuzzlePieceRecord>();
    for (const rec of activeRecords) {
      map.set(rec.pieceIndex, rec);
    }
    return map;
  }, [activeRecords]);

  const activePlacedCount = unlockedMap.size;
  const remainingPiecesOnActive = Math.max(
    0,
    activePieceCount - activePlacedCount
  );
  const isArtworkCompleted = activePlacedCount >= activePieceCount;
  const completionPctText = (
    (activePlacedCount / activePieceCount) *
    100
  ).toFixed(0);

  const lastPlacedIndexOnActive =
    selectedArtwork &&
    puzzleState.lastPlacedPiece?.artworkId === selectedArtwork.id &&
    unlockedMap.has(puzzleState.lastPlacedPiece.pieceIndex)
      ? puzzleState.lastPlacedPiece.pieceIndex
      : null;

  const hoveredTile =
    hoveredTileIndex !== null && activeTiles[hoveredTileIndex]
      ? activeTiles[hoveredTileIndex]
      : null;
  const hoveredRecord =
    hoveredTile !== null ? unlockedMap.get(hoveredTile.index) : undefined;

  const canPlaceOnActive =
    Boolean(selectedArtwork) && unplacedPiecesCount > 0 && !isArtworkCompleted;

  const fallbackStops = useMemo(() => {
    const palette = selectedArtwork?.paletteKey || 'starry_night';
    if (palette === 'sunflowers') {
      return ['#78350f', '#d97706', '#fde68a'];
    }
    if (palette === 'almond_blossom') {
      return ['#134e4a', '#0d9488', '#ccfbf1'];
    }
    if (palette === 'cafe_terrace') {
      return ['#0f172a', '#312e81', '#f59e0b'];
    }
    return ['#090f1d', '#1e3a8a', '#eab308'];
  }, [selectedArtwork?.paletteKey]);

  const calendarSlotTotal = Math.min(artworks.length, MONTHS_IN_YEAR) || MONTHS_IN_YEAR;
  const activePairedPos = !activeMonthMeta.isExtraArtwork
    ? getPartOfSpeechForSlotIndex(activeMonthMeta.orderIndex)
    : undefined;

  return (
    <section className="space-y-8">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
            Kho ảnh &amp; Bộ lịch ghép tranh 12 tháng
          </h2>
        </div>

        <StarryHeaderAccent variant="gallery" className="flex" />
      </div>

      {/* 4-Column Curatorial Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] divide-y lg:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Điểm danh đăng nhập hôm nay
          </p>
          <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {streakStats.loggedInToday ? '+1 mảnh' : 'Chưa nhận'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Ngày {formatDateKeyVi(todayKey)} · Mở tiếp sau{' '}
            {formatCountdownHMS(secondsToMidnight)}
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Mảnh sẵn sàng trong khay
          </p>
          <p
            className={`font-mono tabular-nums text-2xl sm:text-3xl font-semibold mt-1.5 ${
              unplacedPiecesCount > 0
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {unplacedPiecesCount}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              mảnh
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Đã ghép {totalPlacedAcrossAll} / {yearlyTotalPieces} mảnh cả năm
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Tiến độ tranh {activeMonthMeta.monthLabelVi}
          </p>
          <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {activePlacedCount}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              / {activePieceCount}
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Đạt {completionPctText}% · Còn {remainingPiecesOnActive} mảnh
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[var(--text-muted)]">
            Bộ lịch năm {activeYear} &amp; Chuỗi ngày
          </p>
          <p className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mt-1.5">
            {completedMonthsCount}{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              / {calendarSlotTotal} tháng
            </span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
            Chuỗi liên tiếp: {streakStats.currentStreak} ngày (kỷ lục{' '}
            {streakStats.longestStreak})
          </p>
        </div>
      </div>

      {/* Main Asymmetric Atelier Grid: 8-col Interactive Monthly Jigsaw Easel + 4-col 12-Month Collection Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT / CENTER: Monthly Interlocking Jigsaw Canvas Easel */}
        <div className="lg:col-span-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] overflow-hidden">
          {selectedArtwork ? (
            <div className="p-5 sm:p-7 space-y-5">
              {/* Top Curatorial Header & Primary Action Controls */}
              <div className="flex flex-col gap-3.5 pb-4 border-b border-[var(--border-subtle)]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono tabular-nums text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--accent)]">
                      Ảnh {activeMonthMeta.orderIndex + 1} ·{' '}
                      {activeMonthMeta.monthLabelVi}
                    </span>
                    {activePairedPos && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--text-secondary)]">
                          {PART_OF_SPEECH_LABELS[activePairedPos]}
                        </span>
                      </>
                    )}
                    {activeMonthMeta.isCurrentMonth && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--text-secondary)]">
                          Tháng hiện tại
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{activePieceCount} mảnh ghép</span>
                  </div>

                  <div className="flex items-baseline gap-x-2.5 mt-1 min-w-0">
                    <h3
                      title={selectedArtwork.viTitle}
                      className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] sm:whitespace-nowrap sm:truncate"
                    >
                      {selectedArtwork.viTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {canPlaceOnActive ? (
                    <button
                      type="button"
                      onClick={() => onPlacePiece(selectedArtwork.id)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Puzzle className="w-4 h-4 shrink-0" />
                      <span>
                        Ghép mảnh hôm nay (còn {unplacedPiecesCount})
                      </span>
                    </button>
                  ) : isArtworkCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--semantic-good)] whitespace-nowrap shrink-0">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Hoàn thành {activePieceCount}/{activePieceCount} mảnh{' '}
                        {activeMonthMeta.monthLabelVi}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-mono tabular-nums text-[var(--text-muted)] whitespace-nowrap shrink-0">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Nhận mảnh tiếp theo sau{' '}
                        {formatCountdownHMS(secondsToMidnight)}
                      </span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={onToggleUnderdrawing}
                    aria-pressed={puzzleState.showUnderdrawing}
                    title="Bật hoặc tắt lớp phác thảo chì mờ bên dưới các mảnh chưa mở"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      puzzleState.showUnderdrawing
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {puzzleState.showUnderdrawing ? (
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Phác thảo mờ</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleGridLines}
                    aria-pressed={puzzleState.showGridLines}
                    title={`Bật hoặc tắt đường viền mảnh ghép và số thứ tự 1–${activePieceCount}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      puzzleState.showGridLines
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5 shrink-0" />
                    <span>Lưới {activePieceCount} mảnh</span>
                  </button>
                </div>
              </div>

              {/* Hidden image loader to enforce Zero-Broken-Image Policy with no-referrer */}
              <img
                src={effectivePuzzleImageSrc}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                onLoad={() => setImageFailed(false)}
                onError={() => {
                  if (!usingBackupImage && backupPuzzleImageSrc) {
                    setUsingBackupImage(true);
                    setImageFailed(false);
                  } else {
                    setImageFailed(true);
                  }
                }}
                className="sr-only"
              />

              {/* Framed Monthly Interlocking Jigsaw Interactive SVG Canvas */}
              <div className="relative rounded-xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-canvas)]">
                <svg
                  viewBox={`0 0 ${PUZZLE_CANVAS_WIDTH} ${PUZZLE_CANVAS_HEIGHT}`}
                  role="img"
                  aria-label={`Khung ghép tranh ${activeMonthMeta.monthLabelVi} (${activePieceCount} mảnh) của tác phẩm ${selectedArtwork.viTitle}: đã mở ${activePlacedCount} trên ${activePieceCount} mảnh`}
                  onMouseLeave={() => setHoveredTileIndex(null)}
                  className="w-full aspect-[16/9] block select-none"
                >
                  <defs>
                    <linearGradient
                      id={fallbackGradId}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={fallbackStops[0]} />
                      <stop offset="55%" stopColor={fallbackStops[1]} />
                      <stop offset="100%" stopColor={fallbackStops[2]} />
                    </linearGradient>

                    <mask id={revealMaskId}>
                      <rect
                        x="0"
                        y="0"
                        width={PUZZLE_CANVAS_WIDTH}
                        height={PUZZLE_CANVAS_HEIGHT}
                        fill="black"
                      />
                      {activeRecords.map((rec) => {
                        const tile = activeTiles[rec.pieceIndex];
                        if (!tile) return null;
                        return (
                          <path
                            key={rec.pieceIndex}
                            d={tile.pathD}
                            fill="white"
                            stroke="white"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        );
                      })}
                    </mask>
                  </defs>

                  {/* 1. Unrevealed Stretched Linen / Slate Backdrop */}
                  <rect
                    x="0"
                    y="0"
                    width={PUZZLE_CANVAS_WIDTH}
                    height={PUZZLE_CANVAS_HEIGHT}
                    className="fill-[var(--bg-canvas)]"
                  />

                  {/* 2. Optional Faint Monochrome Underdrawing beneath Locked Jigsaw Pieces */}
                  {puzzleState.showUnderdrawing &&
                    (!imageFailed && effectivePuzzleImageSrc ? (
                      <image
                        href={effectivePuzzleImageSrc}
                        x="0"
                        y="0"
                        width={PUZZLE_CANVAS_WIDTH}
                        height={PUZZLE_CANVAS_HEIGHT}
                        preserveAspectRatio="xMidYMid slice"
                        className="grayscale contrast-125 opacity-[0.18] pointer-events-none"
                      />
                    ) : (
                      <rect
                        x="0"
                        y="0"
                        width={PUZZLE_CANVAS_WIDTH}
                        height={PUZZLE_CANVAS_HEIGHT}
                        fill={`url(#${fallbackGradId})`}
                        opacity="0.16"
                      />
                    ))}

                  {/* 3. Vivid Full-Color Painting Layer Masked to Unlocked Jigsaw Pieces Only */}
                  <g
                    mask={`url(#${revealMaskId})`}
                    className="pointer-events-none"
                  >
                    {!imageFailed && effectivePuzzleImageSrc ? (
                      <image
                        href={effectivePuzzleImageSrc}
                        x="0"
                        y="0"
                        width={PUZZLE_CANVAS_WIDTH}
                        height={PUZZLE_CANVAS_HEIGHT}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <rect
                        x="0"
                        y="0"
                        width={PUZZLE_CANVAS_WIDTH}
                        height={PUZZLE_CANVAS_HEIGHT}
                        fill={`url(#${fallbackGradId})`}
                      />
                    )}
                  </g>

                  {/* 4. Interactive Interlocking Jigsaw Pieces + Day Numbers */}
                  <g>
                    {activeTiles.map((tile) => {
                      const isUnlocked = unlockedMap.has(tile.index);
                      const isHovered = hoveredTileIndex === tile.index;
                      const tileClickable = !isUnlocked && canPlaceOnActive;

                      let fillValue = 'transparent';
                      if (!isUnlocked) {
                        if (isHovered && tileClickable) {
                          fillValue = 'rgba(250, 204, 21, 0.26)';
                        } else if (isHovered) {
                          fillValue = 'rgba(148, 163, 184, 0.16)';
                        } else {
                          fillValue = 'rgba(15, 23, 42, 0.08)';
                        }
                      }

                      let strokeValue = 'none';
                      if (!isUnlocked) {
                        strokeValue = puzzleState.showGridLines
                          ? 'rgba(100, 116, 139, 0.44)'
                          : 'rgba(100, 116, 139, 0.14)';
                      } else if (puzzleState.showGridLines) {
                        strokeValue = 'rgba(255, 255, 255, 0.24)';
                      }

                      return (
                        <g key={tile.index}>
                          <path
                            d={tile.pathD}
                            fill={fillValue}
                            stroke={strokeValue}
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                            onMouseEnter={() => setHoveredTileIndex(tile.index)}
                            onClick={() => {
                              if (tileClickable) {
                                onPlacePiece(selectedArtwork.id, tile.index);
                              }
                            }}
                            className={
                              tileClickable ? 'cursor-pointer' : 'cursor-default'
                            }
                          />

                          {!isUnlocked &&
                            (puzzleState.showGridLines || isHovered) && (
                              <text
                                x={tile.centerX}
                                y={tile.centerY}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={
                                  isHovered && tileClickable
                                    ? '#facc15'
                                    : 'rgba(148, 163, 184, 0.62)'
                                }
                                fontSize="20"
                                fontWeight={isHovered ? '600' : '500'}
                                className="font-mono pointer-events-none select-none"
                              >
                                {tile.displayNumber}
                              </text>
                            )}
                        </g>
                      );
                    })}
                  </g>

                  {/* 5. Highlight Contour for Most Recently Placed Jigsaw Piece */}
                  {lastPlacedIndexOnActive !== null &&
                    activeTiles[lastPlacedIndexOnActive] && (
                      <path
                        d={activeTiles[lastPlacedIndexOnActive].pathD}
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="3.2"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />
                    )}

                  {/* 6. Active Hover Focus Contour */}
                  {hoveredTile && (
                    <path
                      d={hoveredTile.pathD}
                      fill="none"
                      stroke={
                        !hoveredRecord && canPlaceOnActive
                          ? '#facc15'
                          : 'rgba(248, 250, 252, 0.80)'
                      }
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      className="pointer-events-none"
                    />
                  )}
                </svg>
              </div>

              {/* Exact Monthly-Piece Progress Bar & Interactive Tile Readout */}
              <div className="space-y-3">
                <svg
                  viewBox={`0 0 ${activePieceCount} 6`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="w-full h-2 rounded-sm overflow-hidden block bg-[var(--bg-canvas)]"
                >
                  <rect
                    x="0"
                    y="0"
                    width={activePieceCount}
                    height="6"
                    className="fill-[var(--bg-elevated)]"
                  />
                  {activePlacedCount > 0 && (
                    <rect
                      x="0"
                      y="0"
                      width={activePlacedCount}
                      height="6"
                      className="fill-[var(--accent)]"
                    />
                  )}
                </svg>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <p className="font-mono tabular-nums text-[var(--text-secondary)]">
                    {hoveredTile ? (
                      <>
                        Mảnh ngày #{hoveredTile.displayNumber} /{' '}
                        {activePieceCount} ({activeMonthMeta.monthLabelVi}) ·
                        Hàng {hoveredTile.row + 1}, Cột {hoveredTile.col + 1} ·{' '}
                        {hoveredRecord ? (
                          <span className="text-[var(--semantic-good)]">
                            Đã ghép ngày{' '}
                            {formatDateKeyVi(hoveredRecord.placedDate)}
                          </span>
                        ) : canPlaceOnActive ? (
                          <span className="text-[var(--accent)] font-semibold">
                            Nhấn vào mảnh này để ghép ngay
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">
                            Chưa mở khóa
                          </span>
                        )}
                      </>
                    ) : lastPlacedIndexOnActive !== null &&
                      activeTiles[lastPlacedIndexOnActive] ? (
                      <>
                        Mảnh vừa ghép gần nhất:{' '}
                        <strong className="text-[var(--text-primary)]">
                          Ngày #{activeTiles[lastPlacedIndexOnActive].displayNumber}{' '}
                          / {activePieceCount}
                        </strong>{' '}
                        (viền vàng trên tranh)
                        {canPlaceOnActive
                          ? ' · Nhấn trực tiếp vào mảnh bất kỳ để ghép tiếp'
                          : ''}
                      </>
                    ) : canPlaceOnActive ? (
                      <>
                        Gợi ý: Nhấn nút{' '}
                        <strong className="text-[var(--text-primary)]">
                          Ghép mảnh hôm nay
                        </strong>{' '}
                        hoặc nhấn trực tiếp vào mảnh ghép bất kỳ (1–
                        {activePieceCount}) trên tranh để tự chọn vị trí mở màu.
                      </>
                    ) : (
                      <>
                        Đã hoàn tất lượt ghép hôm nay · Quay lại vào ngày mai để
                        nhận mảnh ghép tiếp theo cho {activeMonthMeta.monthLabelVi}.
                      </>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApplyAsPomodoroTheme(selectedArtwork.id)}
                      className={`text-xs font-medium underline whitespace-nowrap shrink-0 cursor-pointer ${
                        activeTheme === selectedArtwork.id
                          ? 'text-[var(--text-muted)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {activeTheme === selectedArtwork.id
                        ? 'Đang là nền Pomodoro'
                        : 'Đặt làm nền Pomodoro'}
                    </button>

                    {activePlacedCount > 0 && (
                      <>
                        <span className="text-[var(--text-muted)]">·</span>
                        {!confirmRecall ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRecall(true)}
                            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 shrink-0" />
                            <span>Thu hồi mảnh về khay</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                onRecallPieces(selectedArtwork.id);
                                setConfirmRecall(false);
                              }}
                              className="font-semibold text-[var(--semantic-warn)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Xác nhận thu hồi {activePlacedCount} mảnh
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRecall(false)}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Editorial Pull Quote & Medium Footnote */}
              {selectedArtwork.quoteVi && (
                <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                  <blockquote className="font-serif italic text-base text-[var(--text-secondary)] max-w-2xl">
                    &ldquo;{selectedArtwork.quoteVi}&rdquo;
                  </blockquote>
                  <p className="text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0">
                    — {selectedArtwork.quoteSource || selectedArtwork.medium}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 text-center space-y-3">
              <p className="font-serif text-xl text-[var(--text-primary)]">
                Kho ảnh hiện chưa có tác phẩm nào
              </p>
              <button
                type="button"
                onClick={onOpenAddArtwork}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                <span>Thêm bức tranh đầu tiên</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT CURATORIAL RAIL: 12-Month Calendar Artworks List & 14-Day Login Strip */}
        <div className="lg:col-span-4 space-y-6">
          {/* Panel 1: 12-Month Collection */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row lg:flex-col sm:items-center lg:items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)] whitespace-nowrap">
                  Bộ lịch 12 tháng
                </h3>
                <p className="text-[11px] xl:text-xs text-[var(--text-muted)] mt-0.5 font-mono tabular-nums whitespace-nowrap">
                  {artworks.length} bức tranh · Tổng {yearlyTotalPieces} mảnh/năm
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {currentMonthArtworkId &&
                  selectedArtwork?.id !== currentMonthArtworkId && (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectPuzzleArtwork(currentMonthArtworkId)
                      }
                      title="Chuyển nhanh tới bức tranh của tháng hiện tại"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--accent)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      <span>Tháng này</span>
                    </button>
                  )}

                <button
                  type="button"
                  onClick={onOpenAddArtwork}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Thêm ảnh</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 thin-glass-scrollbar">
              {artworks.map((art, idx) => {
                const meta = monthMetaList[idx];
                const pairedPos = getPartOfSpeechForSlotIndex(idx);
                const pieceTotal = meta?.pieceCount || 31;
                const rawCount =
                  puzzleState.placedByArtwork[art.id]?.filter(
                    (r) => r.pieceIndex >= 0 && r.pieceIndex < pieceTotal
                  ).length || 0;
                const pct = Math.round((rawCount / pieceTotal) * 100);
                const isSelected = selectedArtwork?.id === art.id;

                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => onSelectPuzzleArtwork(art.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center gap-3.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-[var(--accent)]'
                        : 'bg-[var(--bg-canvas)]/70 border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-[var(--border-subtle)] shrink-0">
                      <ArtworkImage
                        artwork={art}
                        alt={art.viTitle}
                        className={`w-full h-full ${
                          rawCount >= pieceTotal
                            ? ''
                            : rawCount > 0
                            ? 'saturate-75'
                            : 'grayscale opacity-75'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <span
                          className={
                            meta?.isCurrentMonth
                              ? 'text-[var(--accent)] font-semibold truncate'
                              : 'text-[var(--text-muted)] truncate'
                          }
                        >
                          Ảnh {idx + 1}
                          {pairedPos
                            ? ` · ${PART_OF_SPEECH_EN_TAGS[pairedPos]}`
                            : ''}
                          {' · '}
                          {meta?.monthLabelVi || `Tháng ${idx + 1}`}
                        </span>

                        <span
                          className={`shrink-0 ${
                            rawCount >= pieceTotal
                              ? 'text-[var(--semantic-good)] font-semibold'
                              : rawCount > 0
                              ? 'text-[var(--accent)] font-semibold'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {rawCount}/{pieceTotal}
                        </span>
                      </div>

                      <p className="font-serif text-base font-semibold text-[var(--text-primary)] truncate mt-0.5">
                        {art.viTitle}
                      </p>

                      <p className="text-[11px] text-[var(--text-muted)] truncate font-mono tabular-nums">
                        {rawCount >= pieceTotal
                          ? 'Đã hoàn thiện trọn tháng (100%)'
                          : rawCount > 0
                          ? `Đã mở ${pct}% · Còn ${pieceTotal - rawCount} mảnh`
                          : 'Chưa ghép mảnh nào'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel 2: 14-Day Daily Login Record & Rules */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-5 sm:p-6 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
                Nhật ký điểm danh 14 ngày
              </h3>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                1 ngày = 1 mảnh
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {recentDays.map((day) => (
                <div
                  key={day.dateKey}
                  title={`Ngày ${formatDateKeyVi(day.dateKey)}: ${
                    day.checkedIn ? 'Đã nhận 1 mảnh' : 'Chưa đăng nhập'
                  }`}
                  className={`rounded-lg py-2 px-1 text-center border transition-colors ${
                    day.checkedIn
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text-primary)]'
                      : day.isToday
                      ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-canvas)]/60 border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <p className="text-[10px] font-mono uppercase">
                    {day.weekdayLabel}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums font-semibold mt-0.5">
                    {day.dayOfMonth}
                  </p>
                  <div className="h-3.5 flex items-center justify-center mt-0.5">
                    {day.checkedIn ? (
                      <Check className="w-3 h-3 text-[var(--accent)]" />
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]/50">
                        –
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p className="flex items-start gap-2">
                <Layers className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>
                  12 bức tranh đại diện cho <strong>Tháng 1 đến Tháng 12</strong>
                  , mỗi bức có đúng số mảnh bằng số ngày của tháng đó (tổng{' '}
                  {yearlyTotalPieces} mảnh/năm).
                </span>
              </p>
              <p className="text-[var(--text-muted)]">
                Mỗi ngày mở ứng dụng bạn nhận thêm 1 mảnh ghép mới. Bạn có thể
                ghép theo đúng tranh của tháng hiện tại hoặc tự do chọn bất kỳ
                tháng nào trong bộ sưu tập.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
