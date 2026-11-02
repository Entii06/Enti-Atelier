import { workspaceStorage } from '../utils/workspaceStorage';
import React, { useEffect, useRef, useState } from 'react';
import { motion, useDragControls } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  CloudRain,
  Wind,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Headphones,
  Quote,
  X,
  ImagePlus,
  Trash2,
  GripHorizontal,
  Sun,
  Plus,
  Music,
  PlaySquare,
  Tv,
  Loader2,
  Bell,
  BellOff,
  BellRing,
} from 'lucide-react';
import {
  AmbientSoundType,
  ArtworkItem,
  NavSection,
  PaintingThemeId,
  PomodoroMode,
  PomodoroSettings,
  RecallGrade,
  SoundTrack,
  VocabCard,
} from '../types';
import { BrowserNotificationPermission } from '../utils/notifications';
import {
  extractYouTubeVideoId,
  fetchYouTubeTitle,
  parseAudioSourceInput,
} from '../utils/soundTracks';
import { ArtworkImage } from './ArtworkImage';
import { WorkspaceNavBar } from './WorkspaceNavBar';
import { GitHubLink } from './GitHubLink';
import { FacebookLink } from './FacebookLink';

interface PomodoroStudioProps {
  artworks: ArtworkItem[];
  activeArtwork: ArtworkItem | undefined;
  activeTheme: PaintingThemeId;
  onSelectTheme: (theme: PaintingThemeId) => void;
  onOpenAddArtwork: () => void;
  onDeleteArtwork: (id: string) => void;
  onRestoreBuiltins: () => void;
  hasDeletedBuiltins: boolean;
  onSelectSection: (section: NavSection) => void;
  mode: PomodoroMode;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  completedFocusToday: number;
  focusedMinutesToday: number;
  intention: string;
  onChangeIntention: (val: string) => void;
  onSelectMode: (mode: PomodoroMode) => void;
  onToggleRun: () => void;
  onReset: () => void;
  onSkip: () => void;
  settings: PomodoroSettings;
  onUpdateSettings: (next: PomodoroSettings) => void;
  notificationPermission: BrowserNotificationPermission;
  notificationBlockedByFrame: boolean;
  onRequestNotificationPermission: () => void;
  onTestBrowserNotification: () => void;
  ambientType: AmbientSoundType;
  onChangeAmbient: (type: AmbientSoundType) => void;
  soundTracks: SoundTrack[];
  hasDeletedBuiltinSounds: boolean;
  ambientVolume: number;
  onChangeAmbientVolume: (vol: number) => void;
  onAddSoundTrack: (track: Omit<SoundTrack, 'id'>) => void;
  onDeleteSoundTrack: (id: string) => void;
  onRestoreBuiltinSounds: () => void;
  showYoutubeMiniPlayer: boolean;
  onToggleYoutubeMiniPlayer: () => void;
  audioPlaybackError: string | null;
  dueCards: VocabCard[];
  unplacedPiecesCount: number;
  reviewedTodayCount: number;
  onRateCard: (cardId: string, grade: RecallGrade) => void;
  onOpenAddWord: () => void;
  bannerNotice: string | null;
  onDismissNotice: () => void;
}

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Tập trung',
  short_break: 'Nghỉ ngắn',
  long_break: 'Nghỉ dài',
};

type ActiveCornerPopover =
  | 'none'
  | 'settings'
  | 'sound'
  | 'notifications'
  | 'quote';

const TIMER_OFFSET_STORAGE_KEY = 'atelier_arles_timer_offset_v1';
const BRIGHTNESS_STORAGE_KEY = 'atelier_arles_brightness_v1';
const TIMER_SCALE_STORAGE_KEY = 'atelier_arles_timer_scale_v1';

function normalizeTimerScale(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.round(Math.max(60, Math.min(150, value)) / 5) * 5;
}

function loadSavedTimerScale(): number {
  try {
    const raw = workspaceStorage.getItem(TIMER_SCALE_STORAGE_KEY);
    return raw ? normalizeTimerScale(Number(JSON.parse(raw))) : 100;
  } catch {
    return 100;
  }
}

const BRIGHTNESS_CLASS_MAP: Record<number, string> = {
  20: 'brightness-[0.20]',
  25: 'brightness-[0.25]',
  30: 'brightness-[0.30]',
  35: 'brightness-[0.35]',
  40: 'brightness-[0.40]',
  45: 'brightness-[0.45]',
  50: 'brightness-[0.50]',
  55: 'brightness-[0.55]',
  60: 'brightness-[0.60]',
  65: 'brightness-[0.65]',
  70: 'brightness-[0.70]',
  75: 'brightness-[0.75]',
  80: 'brightness-[0.80]',
  85: 'brightness-[0.85]',
  90: 'brightness-[0.90]',
  95: 'brightness-[0.95]',
  100: 'brightness-100',
  105: 'brightness-105',
  110: 'brightness-110',
  115: 'brightness-[1.15]',
  120: 'brightness-[1.20]',
  125: 'brightness-125',
  130: 'brightness-[1.30]',
};

function normalizeBrightnessStep(val: number): number {
  const clamped = Math.max(20, Math.min(130, val));
  return Math.round(clamped / 5) * 5;
}

function loadSavedBrightness(): number {
  if (typeof window === 'undefined') return 90;
  try {
    const raw = workspaceStorage.getItem(BRIGHTNESS_STORAGE_KEY);
    if (!raw) return 90;
    const parsed = Number(JSON.parse(raw));
    if (!Number.isFinite(parsed)) return 90;
    return normalizeBrightnessStep(parsed);
  } catch {
    return 90;
  }
}

function loadSavedTimerOffset(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const raw = workspaceStorage.getItem(TIMER_OFFSET_STORAGE_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return { x: 0, y: 0 };
    }
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
      return { x: 0, y: 0 };
    }
    const maxX = Math.max(0, Math.floor((window.innerWidth - 320) / 2));
    const maxY = Math.max(0, Math.floor((window.innerHeight - 260) / 2));
    return {
      x: Math.max(-maxX, Math.min(maxX, Math.round(parsed.x))),
      y: Math.max(-maxY, Math.min(maxY, Math.round(parsed.y))),
    };
  } catch {
    return { x: 0, y: 0 };
  }
}

export const PomodoroStudio: React.FC<PomodoroStudioProps> = ({
  artworks,
  activeArtwork,
  activeTheme,
  onSelectTheme,
  onOpenAddArtwork,
  onDeleteArtwork,
  onRestoreBuiltins,
  hasDeletedBuiltins,
  onSelectSection,
  mode,
  secondsLeft,
  totalSeconds,
  isRunning,
  completedFocusToday,
  focusedMinutesToday,
  intention,
  onChangeIntention,
  onSelectMode,
  onToggleRun,
  onReset,
  onSkip,
  settings,
  onUpdateSettings,
  notificationPermission,
  notificationBlockedByFrame,
  onRequestNotificationPermission,
  onTestBrowserNotification,
  ambientType,
  onChangeAmbient,
  soundTracks,
  hasDeletedBuiltinSounds,
  ambientVolume,
  onChangeAmbientVolume,
  onAddSoundTrack,
  onDeleteSoundTrack,
  onRestoreBuiltinSounds,
  showYoutubeMiniPlayer,
  onToggleYoutubeMiniPlayer,
  audioPlaybackError,
  dueCards,
  unplacedPiecesCount,
  bannerNotice,
  onDismissNotice,
}) => {
  const [openPopover, setOpenPopover] = useState<ActiveCornerPopover>('none');
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmDeleteActive, setConfirmDeleteActive] = useState(false);

  // Add / Delete Sound UI state inside the Sound popover
  const [isAddingSound, setIsAddingSound] = useState(false);
  const [newSoundUrl, setNewSoundUrl] = useState('');
  const [newSoundTitle, setNewSoundTitle] = useState('');
  const [addSoundError, setAddSoundError] = useState<string | null>(null);
  const [isResolvingSound, setIsResolvingSound] = useState(false);
  const [confirmDeleteSoundId, setConfirmDeleteSoundId] = useState<
    string | null
  >(null);

  const hudContainerRef = useRef<HTMLDivElement | null>(null);
  const timerBoxRef = useRef<HTMLDivElement | null>(null);
  const timerContentRef = useRef<HTMLDivElement | null>(null);
  const [timerScale, setTimerScale] = useState(loadSavedTimerScale);
  const [maximumTimerScale, setMaximumTimerScale] = useState(150);
  const effectiveTimerScale = Math.min(timerScale, maximumTimerScale);
  const dragControls = useDragControls();
  const [initialOffset, setInitialOffset] = useState<{ x: number; y: number }>(
    () => loadSavedTimerOffset()
  );
  const [hasMoved, setHasMoved] = useState<boolean>(
    () => Math.abs(initialOffset.x) > 4 || Math.abs(initialOffset.y) > 4
  );
  const [dragResetKey, setDragResetKey] = useState(0);
  const [imageBrightness, setImageBrightness] = useState<number>(() =>
    loadSavedBrightness()
  );

  useEffect(() => {
    const content = timerContentRef.current;
    if (!content) return;
    const updateLimit = () => {
      const zoom = Number(window.getComputedStyle(content).zoom) || 1;
      const naturalWidth = content.getBoundingClientRect().width / zoom;
      if (naturalWidth <= 0) return;
      const fittingScale = Math.floor(((window.innerWidth - 64) / naturalWidth) * 20) * 5;
      setMaximumTimerScale(Math.max(60, Math.min(150, fittingScale)));
    };
    updateLimit();
    const observer = new ResizeObserver(updateLimit);
    observer.observe(content);
    window.addEventListener('resize', updateLimit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLimit);
    };
  }, [dragResetKey]);

  const handleTimerScaleChange = (value: number) => {
    const next = normalizeTimerScale(value);
    setTimerScale(next);
    workspaceStorage.setItem(TIMER_SCALE_STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    setConfirmDeleteActive(false);
  }, [activeTheme]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Gracefully ignore if restricted by parent iframe permissions
    }
  };

  const togglePopover = (target: ActiveCornerPopover) => {
    setOpenPopover((prev) => (prev === target ? 'none' : target));
  };

  const handleTimerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, a')) return;
    dragControls.start(e);
  };

  const handleTimerDragEnd = () => {
    const el = timerBoxRef.current;
    if (!el) return;
    try {
      const rawTransform = window.getComputedStyle(el).transform;
      const matrix =
        rawTransform && rawTransform !== 'none'
          ? new DOMMatrixReadOnly(rawTransform)
          : new DOMMatrixReadOnly();
      const next = {
        x: Math.round(matrix.m41),
        y: Math.round(matrix.m42),
      };
      const moved = Math.abs(next.x) > 4 || Math.abs(next.y) > 4;
      setHasMoved(moved);
      workspaceStorage.setItem(
        TIMER_OFFSET_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Ignore storage errors
    }
  };

  const handleResetTimerPosition = () => {
    const zero = { x: 0, y: 0 };
    setInitialOffset(zero);
    setHasMoved(false);
    setDragResetKey((prev) => prev + 1);
    try {
      workspaceStorage.removeItem(TIMER_OFFSET_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleBrightnessChange = (val: number) => {
    const next = normalizeBrightnessStep(val);
    setImageBrightness(next);
    try {
      workspaceStorage.setItem(BRIGHTNESS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const brightnessClass =
    BRIGHTNESS_CLASS_MAP[imageBrightness] || 'brightness-90';

  const activeSoundTrack =
    ambientType === 'off'
      ? undefined
      : soundTracks.find((s) => s.id === ambientType);

  const detectedInputKind = newSoundUrl.trim()
    ? extractYouTubeVideoId(newSoundUrl)
      ? 'youtube'
      : 'mp3'
    : null;

  const handleSaveNewSound = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAudioSourceInput(newSoundUrl);
    if (!parsed.ok) {
      setAddSoundError(parsed.error);
      return;
    }

    setAddSoundError(null);
    let finalTitle = newSoundTitle.trim();

    if (!finalTitle && parsed.kind === 'youtube') {
      setIsResolvingSound(true);
      const fetched = await fetchYouTubeTitle(parsed.url);
      setIsResolvingSound(false);
      finalTitle = fetched || parsed.fallbackTitle;
    } else if (!finalTitle) {
      finalTitle = parsed.fallbackTitle;
    }

    onAddSoundTrack({
      title: finalTitle,
      kind: parsed.kind,
      url: parsed.url,
      youtubeId: parsed.youtubeId,
      isBuiltin: false,
    });

    setNewSoundUrl('');
    setNewSoundTitle('');
    setIsAddingSound(false);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  const progressRatio =
    totalSeconds > 0
      ? Math.max(0, Math.min(1, (totalSeconds - secondsLeft) / totalSeconds))
      : 0;
  const currentCycleIndex =
    (completedFocusToday % settings.sessionsBeforeLongBreak) + 1;

  return (
    <div className="relative min-h-screen w-full overflow-hidden select-none text-white">
      {/* FULL-SCREEN VAN GOGH / USER PAINTING CANVAS (100vw × 100vh) */}
      <div className="fixed inset-0 z-0 bg-black">
        <ArtworkImage
          artwork={activeArtwork}
          className={`w-full h-full transition-[filter] duration-150 ${brightnessClass}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
      </div>

      {/* FOREGROUND FULL-SCREEN HUD: 4 CORNERS + DRAGGABLE CLOCK */}
      <div
        ref={hudContainerRef}
        className="relative z-10 min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 lg:p-8"
      >
        {/* ==================== TOP ROW: TOP-LEFT & TOP-RIGHT CORNERS ==================== */}
        <div className="relative z-30 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 pointer-events-none">
          {/* TOP-LEFT CORNER: Brand & Workspace Navigation (50% page width on desktop) */}
          <WorkspaceNavBar
            activeSection="pomodoro"
            dueCount={dueCards.length}
            unplacedPiecesCount={unplacedPiecesCount}
            onSelectSection={onSelectSection}
            variant="glass"
            className={`transition-opacity duration-200 ${
              zenMode
                ? 'opacity-0 pointer-events-none'
                : 'opacity-100 pointer-events-auto'
            }`}
          />

          {/* TOP-RIGHT CORNER: Image Brightness Slider, Ambient Audio, Timer Settings, Zen & Fullscreen */}
          <div className="relative flex flex-wrap items-center justify-end gap-2 ml-auto shrink-0 pointer-events-auto">
            {!zenMode && (
              <>
                <div
                  className="inline-flex items-center gap-2 px-3 h-[38px] rounded-2xl bg-black/45 backdrop-blur-md border border-white/15"
                  title="Thanh chỉnh độ sáng hình ảnh nền"
                >
                  <button
                    type="button"
                    onClick={() => handleBrightnessChange(100)}
                    title="Đặt lại độ sáng 100%"
                    aria-label="Đặt lại độ sáng 100%"
                    className="text-amber-300 hover:text-amber-200 transition-colors cursor-pointer shrink-0"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <input
                    id="artwork-brightness-slider"
                    type="range"
                    min={20}
                    max={130}
                    step={5}
                    value={imageBrightness}
                    onChange={(e) =>
                      handleBrightnessChange(Number(e.target.value))
                    }
                    aria-label="Thanh chỉnh độ sáng hình ảnh"
                    className="w-20 sm:w-24 h-1 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono tabular-nums text-[11px] text-white/85 w-8 text-right shrink-0">
                    {imageBrightness}%
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15">
                  <button
                    type="button"
                    onClick={() => togglePopover('sound')}
                    aria-expanded={openPopover === 'sound'}
                    title="Âm thanh nền & Chuông báo"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      openPopover === 'sound' || ambientType !== 'off'
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Headphones className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline max-w-28 truncate">
                      {activeSoundTrack ? activeSoundTrack.title : 'Âm thanh'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePopover('notifications')}
                    aria-expanded={openPopover === 'notifications'}
                    title="Thông báo đẩy trình duyệt khi hết phiên Pomodoro"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      openPopover === 'notifications'
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {settings.browserNotificationEnabled &&
                    notificationPermission === 'granted' ? (
                      <BellRing className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    ) : !settings.browserNotificationEnabled ? (
                      <BellOff className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    ) : (
                      <Bell className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden xl:inline">Thông báo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePopover('settings')}
                    aria-expanded={openPopover === 'settings'}
                    title="Tùy chỉnh đồng hồ Pomodoro"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      openPopover === 'settings'
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Đồng hồ</span>
                  </button>
                </div>
              </>
            )}

            {/* Zen & Fullscreen Controls */}
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15">
              <button
                type="button"
                onClick={() => {
                  setZenMode((prev) => !prev);
                  setOpenPopover('none');
                }}
                title={
                  zenMode
                    ? 'Hiện các góc điều khiển'
                    : 'Ẩn góc (Chế độ ngắm tranh)'
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl text-white/85 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {zenMode ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Hiện góc</span>
                  </>
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                aria-label={
                  isFullscreen ? 'Thoát toàn màn hình' : 'Mở toàn màn hình'
                }
                className="p-1.5 rounded-xl text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {!zenMode && (
              <>
                <FacebookLink variant="glass" />
                <GitHubLink variant="glass" />
              </>
            )}

            {/* TOP-RIGHT POPOVER: SOUND & AMBIENT (with Add YouTube/MP3 & Delete) */}
            {openPopover === 'sound' && !zenMode && (
              <div className="absolute right-0 top-14 w-80 sm:w-96 rounded-2xl bg-stone-950/95 backdrop-blur-xl border border-white/20 p-4 shadow-2xl space-y-3.5 z-30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">
                    Không gian âm thanh
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingSound((prev) => !prev);
                        setAddSoundError(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        isAddingSound
                          ? 'bg-amber-400 text-stone-950 font-semibold'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm âm thanh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenPopover('none')}
                      className="text-white/60 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Form: Add YouTube Link or MP3 File Link */}
                {isAddingSound && (
                  <form
                    onSubmit={(e) => void handleSaveNewSound(e)}
                    className="p-3 rounded-xl bg-white/5 border border-white/15 space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="new-sound-url"
                          className="text-[11px] font-medium text-white/80"
                        >
                          Link YouTube hoặc link file MP3
                        </label>
                        {detectedInputKind && (
                          <span className="text-[10px] font-mono text-amber-300">
                            {detectedInputKind === 'youtube'
                              ? 'YouTube'
                              : 'MP3 / Audio'}
                          </span>
                        )}
                      </div>
                      <input
                        id="new-sound-url"
                        type="text"
                        value={newSoundUrl}
                        onChange={(e) => {
                          setNewSoundUrl(e.target.value);
                          if (addSoundError) setAddSoundError(null);
                        }}
                        placeholder="https://youtu.be/... hoặc https://.../music.mp3"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-sound-title"
                        className="block text-[11px] font-medium text-white/80 mb-1"
                      >
                        Tên âm thanh (tùy chọn)
                      </label>
                      <input
                        id="new-sound-title"
                        type="text"
                        value={newSoundTitle}
                        onChange={(e) => setNewSoundTitle(e.target.value)}
                        placeholder="Để trống sẽ tự động lấy tên..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-black/50 border border-white/15 text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    {addSoundError && (
                      <p className="text-[11px] text-red-300">{addSoundError}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSound(false);
                          setAddSoundError(null);
                        }}
                        className="px-2.5 py-1 text-xs text-white/70 hover:text-white cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isResolvingSound}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-stone-950 cursor-pointer"
                      >
                        {isResolvingSound && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>Lưu &amp; Phát</span>
                      </button>
                    </div>
                  </form>
                )}

                {audioPlaybackError && (
                  <p className="px-2.5 py-2 rounded-lg bg-red-950/70 border border-red-400/30 text-[11px] text-red-200">
                    {audioPlaybackError}
                  </p>
                )}

                {/* Sound List: Off + Builtin & Custom Tracks */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5 thin-glass-scrollbar">
                  <button
                    type="button"
                    onClick={() => onChangeAmbient('off')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                      ambientType === 'off'
                        ? 'bg-amber-400 text-stone-950 font-semibold'
                        : 'bg-white/5 text-white/85 hover:bg-white/15'
                    }`}
                  >
                    <span>Yên tĩnh (Tắt âm nền)</span>
                    {ambientType === 'off' && <span>Đang chọn</span>}
                  </button>

                  {soundTracks.map((track) => {
                    const isSelected = ambientType === track.id;
                    const isConfirmingDelete = confirmDeleteSoundId === track.id;

                    const IconComp =
                      track.kind === 'builtin_rain'
                        ? CloudRain
                        : track.kind === 'builtin_wind'
                        ? Wind
                        : track.kind === 'youtube'
                        ? PlaySquare
                        : Music;

                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-1.5 p-1 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-amber-400 text-stone-950'
                            : 'bg-white/5 text-white/85 hover:bg-white/15'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onChangeAmbient(track.id)}
                          className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <IconComp className="w-3.5 h-3.5 shrink-0" />
                            <span
                              className={`truncate ${
                                isSelected ? 'font-semibold' : 'font-medium'
                              }`}
                            >
                              {track.title}
                            </span>
                          </span>

                          {!isConfirmingDelete && (
                            <span
                              className={`text-[10px] font-mono shrink-0 ${
                                isSelected
                                  ? 'text-stone-900 font-semibold'
                                  : 'text-white/45'
                              }`}
                            >
                              {isSelected
                                ? 'Đang bật'
                                : track.kind === 'youtube'
                                ? 'YouTube'
                                : track.kind === 'mp3'
                                ? 'MP3'
                                : ''}
                            </span>
                          )}
                        </button>

                        {isSelected &&
                          track.kind === 'youtube' &&
                          !isConfirmingDelete && (
                            <button
                              type="button"
                              onClick={onToggleYoutubeMiniPlayer}
                              title={
                                showYoutubeMiniPlayer
                                  ? 'Ẩn khung phát YouTube'
                                  : 'Hiện khung phát YouTube nhỏ'
                              }
                              className="p-1.5 rounded-lg bg-stone-950/15 hover:bg-stone-950/25 text-stone-950 shrink-0 cursor-pointer"
                            >
                              <Tv className="w-3.5 h-3.5" />
                            </button>
                          )}

                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1 pr-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSoundTrack(track.id);
                                setConfirmDeleteSoundId(null);
                              }}
                              className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSoundId(null)}
                              className={`px-1.5 py-0.5 text-[11px] cursor-pointer ${
                                isSelected
                                  ? 'text-stone-900 hover:underline'
                                  : 'text-white/70 hover:text-white'
                              }`}
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSoundId(track.id)}
                            title={`Xóa âm thanh "${track.title}"`}
                            aria-label={`Xóa âm thanh ${track.title}`}
                            className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
                              isSelected
                                ? 'text-stone-900/75 hover:text-red-900 hover:bg-stone-950/15'
                                : 'text-white/50 hover:text-red-300 hover:bg-white/10'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {hasDeletedBuiltinSounds && (
                    <button
                      type="button"
                      onClick={onRestoreBuiltinSounds}
                      className="w-full pt-1 text-center text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      Khôi phục âm thanh mặc định
                    </button>
                  )}
                </div>

                {/* Background Audio Volume Slider */}
                <div className="pt-3 border-t border-white/15 space-y-2.5">
                  <div>
                    <label
                      htmlFor="ambient-volume-slider"
                      className="flex items-center justify-between text-xs text-white/80 mb-1"
                    >
                      <span>Âm lượng nhạc nền</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {Math.round(ambientVolume * 100)}%
                      </span>
                    </label>
                    <input
                      id="ambient-volume-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(ambientVolume * 100)}
                      onChange={(e) =>
                        onChangeAmbientVolume(Number(e.target.value) / 100)
                      }
                      className="w-full h-1 accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-white/80">
                      Chuông báo hết phiên
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          soundChimeEnabled: !settings.soundChimeEnabled,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    >
                      {settings.soundChimeEnabled ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Đang bật</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-white/60" />
                          <span>Đã tắt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TOP-RIGHT POPOVER: POMODORO DURATION SETTINGS */}
            {openPopover === 'settings' && !zenMode && (
              <div className="absolute right-0 top-14 max-h-[65dvh] w-72 overflow-y-auto rounded-2xl bg-stone-950/90 backdrop-blur-xl border border-white/20 p-4 shadow-2xl space-y-4 z-30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">
                    Tùy chỉnh đồng hồ Pomodoro
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenPopover('none')}
                    className="text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 border-b border-white/15 pb-4">
                  <label htmlFor="timer-size-slider" className="flex items-center justify-between text-xs text-white/80">
                    <span>Kích cỡ khung đồng hồ</span>
                    <span className="font-mono tabular-nums text-amber-300">{effectiveTimerScale}%</span>
                  </label>
                  <input
                    id="timer-size-slider"
                    type="range"
                    min={60}
                    max={maximumTimerScale}
                    step={5}
                    value={effectiveTimerScale}
                    onChange={(event) => handleTimerScaleChange(Number(event.target.value))}
                    aria-valuetext={`${effectiveTimerScale}%`}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                    <span>{maximumTimerScale < 150 ? 'Tự giới hạn để vừa màn hình' : 'Thu nhỏ hoặc phóng to cả cụm đồng hồ'}</span>
                    <button
                      type="button"
                      onClick={() => handleTimerScaleChange(100)}
                      className="shrink-0 text-amber-300 underline hover:text-amber-200 cursor-pointer"
                    >
                      Mặc định
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="corner-focus-mins"
                      className="flex justify-between text-xs text-white/80 mb-1"
                    >
                      <span>Tập trung</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {settings.focusMinutes} phút
                      </span>
                    </label>
                    <input
                      id="corner-focus-mins"
                      type="range"
                      min={10}
                      max={60}
                      step={5}
                      value={settings.focusMinutes}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          focusMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="corner-short-mins"
                      className="flex justify-between text-xs text-white/80 mb-1"
                    >
                      <span>Nghỉ ngắn</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {settings.shortBreakMinutes} phút
                      </span>
                    </label>
                    <input
                      id="corner-short-mins"
                      type="range"
                      min={3}
                      max={15}
                      step={1}
                      value={settings.shortBreakMinutes}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          shortBreakMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="corner-long-mins"
                      className="flex justify-between text-xs text-white/80 mb-1"
                    >
                      <span>Nghỉ dài</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {settings.longBreakMinutes} phút
                      </span>
                    </label>
                    <input
                      id="corner-long-mins"
                      type="range"
                      min={10}
                      max={30}
                      step={5}
                      value={settings.longBreakMinutes}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          longBreakMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/15 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/80">
                    Thông báo đẩy hết phiên
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextEnabled = !settings.browserNotificationEnabled;
                      onUpdateSettings({
                        ...settings,
                        browserNotificationEnabled: nextEnabled,
                      });
                      if (nextEnabled && notificationPermission === 'default') {
                        onRequestNotificationPermission();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    {settings.browserNotificationEnabled ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Đang bật</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5 text-white/60" />
                        <span>Đã tắt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TOP-RIGHT POPOVER: BROWSER PUSH NOTIFICATIONS */}
            {openPopover === 'notifications' && !zenMode && (
              <div className="absolute right-0 top-14 w-80 sm:w-88 rounded-2xl bg-stone-950/95 backdrop-blur-xl border border-white/20 p-4 shadow-2xl space-y-3.5 z-30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">
                    Thông báo đẩy trình duyệt
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenPopover('none')}
                    className="text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[11px] leading-relaxed text-white/75">
                  Hiển thị thông báo hệ thống ngay khi hết phiên Tập trung hoặc
                  Nghỉ để bạn yên tâm làm việc ở tab hay ứng dụng khác.
                </p>

                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-white">
                    Thông báo khi hết phiên
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextEnabled = !settings.browserNotificationEnabled;
                      onUpdateSettings({
                        ...settings,
                        browserNotificationEnabled: nextEnabled,
                      });
                      if (nextEnabled && notificationPermission === 'default') {
                        onRequestNotificationPermission();
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      settings.browserNotificationEnabled
                        ? 'bg-amber-400 text-stone-950 font-semibold'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {settings.browserNotificationEnabled ? (
                      <>
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Đang bật</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5" />
                        <span>Đã tắt</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-white/70">Trạng thái trình duyệt</span>
                    <span
                      className={`font-mono text-[11px] ${
                        notificationPermission === 'granted'
                          ? 'text-emerald-300'
                          : notificationPermission === 'denied'
                          ? 'text-red-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {notificationPermission === 'granted'
                        ? 'Đã cấp quyền'
                        : notificationPermission === 'denied'
                        ? 'Đang bị chặn'
                        : notificationPermission === 'default'
                        ? 'Chưa cấp quyền'
                        : 'Không hỗ trợ'}
                    </span>
                  </div>

                  {notificationPermission === 'default' && (
                    <button
                      type="button"
                      onClick={onRequestNotificationPermission}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-stone-950 transition-colors cursor-pointer"
                    >
                      Cho phép thông báo trên trình duyệt
                    </button>
                  )}

                  {notificationPermission === 'granted' && (
                    <button
                      type="button"
                      onClick={onTestBrowserNotification}
                      className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                      Gửi thử thông báo ngay
                    </button>
                  )}

                  {(notificationPermission === 'denied' ||
                    notificationBlockedByFrame) && (
                    <p className="text-[11px] leading-relaxed text-amber-200/90">
                      {notificationBlockedByFrame
                        ? 'Khung xem trước đang giới hạn hộp thoại thông báo. Hãy mở trang web ở tab trình duyệt riêng để bật thông báo đẩy.'
                        : 'Quyền thông báo đang bị tắt trong trình duyệt. Hãy nhấn biểu tượng ổ khóa trên thanh địa chỉ và chọn Cho phép Thông báo.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optional Subtle Toast Notice */}
        {bannerNotice && !zenMode && (
          <div className="mx-auto mt-2 max-w-xl px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center gap-3 text-xs sm:text-sm text-white">
            <span>{bannerNotice}</span>
            <button
              type="button"
              onClick={onDismissNotice}
              className="text-white/70 hover:text-white text-xs underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* ==================== CENTER STAGE: DRAGGABLE YOUTUBE-STYLE AMBIENT TIMER ==================== */}
        <motion.div
          key={dragResetKey}
          ref={timerBoxRef}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={hudContainerRef}
          dragElastic={0}
          dragMomentum={false}
          initial={initialOffset}
          onPointerDown={handleTimerPointerDown}
          onDragEnd={handleTimerDragEnd}
          className="relative z-20 self-center my-auto px-5 py-4 flex flex-col items-center justify-center text-center touch-none cursor-grab active:cursor-grabbing"
        >
          <div
            ref={timerContentRef}
            style={{ zoom: effectiveTimerScale / 100 }}
            className="flex w-max flex-col items-center justify-center"
          >
          {/* Subtle Drag Grip + Reset-to-Center Action */}
          <div
            className={`mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/15 text-xs text-white/75 hover:text-white transition-all ${
              zenMode
                ? 'opacity-0 pointer-events-none'
                : 'opacity-85 hover:opacity-100'
            }`}
            title="Nhấn giữ và kéo để di chuyển đồng hồ sang vị trí khác"
          >
            <GripHorizontal className="w-3.5 h-3.5 text-white/70" />
            <span className="text-[11px] tracking-wide">Kéo di chuyển</span>
            <span className="text-white/25" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => togglePopover('settings')}
              title="Tùy chỉnh kích cỡ khung đồng hồ"
              className="text-[11px] font-medium text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Kích cỡ
            </button>
            {hasMoved && (
              <>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={handleResetTimerPosition}
                  className="text-[11px] font-medium text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  Về giữa
                </button>
              </>
            )}
          </div>

          {/* Mode Tabs Above Timer */}
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 transition-opacity duration-200 ${
              zenMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            role="tablist"
            aria-label="Chế độ Pomodoro"
          >
            {(['focus', 'short_break', 'long_break'] as PomodoroMode[]).map(
              (m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectMode(m)}
                    className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-stone-950 font-semibold'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                );
              }
            )}
          </div>

          {/* Giant Countdown Readout (grab directly to drag anywhere) */}
          <div
            className="font-mono tabular-nums text-7xl sm:text-8xl md:text-9xl font-medium tracking-tight text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.72)] mt-4 mb-3"
            aria-live="polite"
            title="Nhấn giữ và kéo để di chuyển đồng hồ"
          >
            {formattedTime}
          </div>

          {/* Crisp SVG Progress Line Beneath Timer */}
          <svg
            viewBox="0 0 320 6"
            className="w-60 sm:w-80 h-1.5 overflow-visible"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1="3"
              x2="320"
              y2="3"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {progressRatio > 0 && (
              <line
                x1="0"
                y1="3"
                x2={Math.max(4, Math.min(320, progressRatio * 320))}
                y2="3"
                stroke="#fbbf24"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Subtle Session & Focus Intention Line */}
          <div className="mt-3 w-72 sm:w-96 max-w-[85vw]">
            <input
              type="text"
              value={intention}
              onChange={(e) => onChangeIntention(e.target.value)}
              aria-label="Mục tiêu phiên tập trung"
              placeholder={`Phiên ${currentCycleIndex}/${settings.sessionsBeforeLongBreak} · Nhấn để ghi mục tiêu học tập...`}
              className="w-full text-center text-xs sm:text-sm font-serif italic text-white placeholder:text-white/70 bg-black/45 hover:bg-black/55 focus:bg-black/65 backdrop-blur-md rounded-xl px-3.5 py-2 border border-white/15 focus:border-white/30 focus:outline-none transition-colors cursor-text shadow-sm"
            />
          </div>

          {/* Minimal Playback Controls */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onReset}
              aria-label="Đặt lại đồng hồ"
              title="Đặt lại"
              className="p-3 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 text-white/85 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleRun}
              aria-label={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
              title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
              className="inline-flex items-center justify-center p-4 rounded-full bg-white hover:bg-amber-300 text-stone-950 transition-colors shrink-0 cursor-pointer shadow-xl"
            >
              {isRunning ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onSkip}
              aria-label="Chuyển sang phiên tiếp theo"
              title="Chuyển phiên"
              className="p-3 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 text-white/85 hover:text-white transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
          </div>
        </motion.div>

        {/* ==================== BOTTOM ROW: BOTTOM-LEFT & BOTTOM-RIGHT CORNERS ==================== */}
        <div
          className={`relative z-30 flex flex-col xl:flex-row items-stretch xl:items-end justify-between gap-4 pointer-events-none transition-opacity duration-200 ${
            zenMode ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* BOTTOM-LEFT CORNER: Painting Switcher + THÊM ẢNH + XÓA ẢNH + Quote */}
          <div
            className={`relative self-start max-w-full ${
              zenMode ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            {openPopover === 'quote' && activeArtwork && (
              <div className="mb-3 max-w-md rounded-2xl bg-stone-950/90 backdrop-blur-xl border border-white/20 p-4 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-mono text-amber-300">
                    {activeArtwork.accessionCode}
                    {activeArtwork.locationYear
                      ? ` · ${activeArtwork.locationYear}`
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenPopover('none')}
                    className="text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <blockquote className="font-serif italic text-base leading-relaxed text-white mt-2">
                  “
                  {activeArtwork.quoteVi ||
                    'Mỗi phiên tập trung yên tĩnh là một nét cọ bền bỉ trên hành trình của riêng bạn.'}
                  ”
                </blockquote>
                <p className="text-xs text-white/65 mt-2">
                  {activeArtwork.quoteSource || activeArtwork.viTitle}
                </p>
              </div>
            )}

            <div className="inline-flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15 max-w-full">
              {/* Thumbnail List */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-[62vw] sm:max-w-lg thin-glass-scrollbar">
                {artworks.map((t) => {
                  const selected = activeArtwork?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTheme(t.id)}
                      aria-pressed={selected}
                      title={t.viTitle}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-white/25 text-white font-semibold border border-amber-300/70'
                          : 'text-white/75 hover:text-white hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <ArtworkImage
                        artwork={t}
                        className="w-5 h-5 rounded-sm shrink-0"
                      />
                      <span className="hidden sm:inline max-w-28 truncate">
                        {t.viTitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              {artworks.length > 0 && (
                <span className="text-white/20 px-0.5" aria-hidden="true">
                  |
                </span>
              )}

              {/* ADD IMAGE BUTTON */}
              <button
                type="button"
                onClick={onOpenAddArtwork}
                title="Thêm ảnh nền mới từ máy tính hoặc đường dẫn URL"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/15 hover:bg-white/25 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5 text-amber-300" />
                <span>Thêm ảnh</span>
              </button>

              {/* DELETE IMAGE BUTTON (with inline confirmation) */}
              {activeArtwork ? (
                confirmDeleteActive ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-red-950/80 border border-red-400/40">
                    <span className="text-xs text-red-200 whitespace-nowrap">
                      Xóa ảnh này?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteArtwork(activeArtwork.id);
                        setConfirmDeleteActive(false);
                      }}
                      className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-red-500 hover:bg-red-400 text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteActive(false)}
                      className="px-1.5 py-0.5 text-xs text-white/75 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteActive(true)}
                    title={`Xóa ảnh nền "${activeArtwork.viTitle}"`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-white/80 hover:text-red-300 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa ảnh</span>
                  </button>
                )
              ) : (
                hasDeletedBuiltins && (
                  <button
                    type="button"
                    onClick={onRestoreBuiltins}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-amber-300 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục tranh gốc</span>
                  </button>
                )
              )}

              {activeArtwork && (
                <button
                  type="button"
                  onClick={() => togglePopover('quote')}
                  title="Xem trích dẫn"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    openPopover === 'quote'
                      ? 'bg-amber-400 text-stone-950 font-semibold'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Quote className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Lời họa sĩ</span>
                </button>
              )}
            </div>
          </div>

          {/* BOTTOM-RIGHT CORNER: Pure Pomodoro Today Summary */}
          <div
            className={`relative self-end ${
              zenMode ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15">
              <div className="text-xs font-mono tabular-nums text-white/85 flex items-center">
                <span>
                  {completedFocusToday} phiên ({focusedMinutesToday}p)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
