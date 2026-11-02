import { useWorkspaceState } from './hooks/useWorkspaceState';
import { BackupControls } from './components/BackupControls';
import { workspaceStorage } from './utils/workspaceStorage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Pause, Play, Sun } from 'lucide-react';
import { AddArtworkModal } from './components/AddArtworkModal';
import { AnalyticsView } from './components/AnalyticsView';
import { ArtworkVaultView } from './components/ArtworkVaultView';
import { BackgroundAudioPlayer } from './components/BackgroundAudioPlayer';
import { PomodoroStudio } from './components/PomodoroStudio';
import { SpacedRepetitionStudy } from './components/SpacedRepetitionStudy';
import {
  CUTOUT_VIVID_CLASS,
  STARRY_CUTOUTS,
} from './components/StarryCutoutAccents';
import { VocabularyLibrary } from './components/VocabularyLibrary';
import { SingleWordInput, WordModal } from './components/WordModal';
import { WorkspaceNavBar } from './components/WorkspaceNavBar';
import { GitHubLink } from './components/GitHubLink';
import { FacebookLink } from './components/FacebookLink';
import { DonateWidget } from './components/DonateWidget';
import {
  BUILTIN_ARTWORKS,
  getBuiltinBackupImageSrc,
  resolveArtworkForPartOfSpeech,
} from './constants/themes';
import {
  AmbientSoundType,
  ArtworkItem,
  ArtworkPuzzleState,
  BasePaletteKey,
  NavSection,
  PaintingThemeId,
  PartOfSpeech,
  PomodoroMode,
  PomodoroSessionRecord,
  PomodoroSettings,
  RecallGrade,
  ReviewLogRecord,
  SoundTrack,
  VocabCard,
} from './types';
import {
  applyDailyLoginCheckIn,
  buildArtworkMonthMetaList,
  createInitialPuzzleState,
  getArtworkMonthMeta,
  getAvailableUnplacedPieces,
  getCurrentMonthArtworkId,
  getLocalDateKey,
  placePieceOnArtwork,
  recallArtworkPiecesToTray,
  sanitizePuzzleState,
} from './utils/artworkPuzzle';
import {
  deleteCustomArtworkFromDB,
  loadCustomArtworksFromDB,
  saveCustomArtworkToDB,
} from './utils/artworkStorage';
import {
  ambientSound,
  playPiecePlaceChime,
  playSessionChime,
} from './utils/audio';
import {
  EMPTY_SERVER_MANIFEST,
  fetchServerDefaultArtworks,
  ServerDefaultArtworksManifest,
  syncServerDefaultArtworks,
} from './utils/defaultArtworksApi';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendPomodoroBrowserNotification,
  sendTestBrowserNotification,
  startUnthrottledTicker,
} from './utils/notifications';
import { useReviewHistory } from './hooks/useReviewHistory';
import { useDueCards } from './hooks/useDueCards';
import { normalizeSchedule, reviewCard } from './utils/scheduler';
import { BUILTIN_SOUND_TRACKS } from './utils/soundTracks';
import {
  createStarterDeck,
  normalizePartOfSpeechInput,
} from './utils/srs';

const STORAGE_KEYS = {
  THEME: 'atelier_arles_theme_v1',
  DELETED_BUILTINS: 'atelier_arles_deleted_builtins_v1',
  SERVER_DEFAULTS_CACHE: 'atelier_arles_server_defaults_v1',
  CARDS: 'atelier_arles_cards_v1',
  POMO_SETTINGS: 'atelier_arles_pomo_settings_v1',
  POMO_HISTORY: 'atelier_arles_pomo_history_v1',
  REVIEW_LOGS: 'atelier_arles_review_logs_v1',
  INTENTION: 'atelier_arles_intention_v1',
  CUSTOM_SOUNDS: 'atelier_arles_custom_sounds_v1',
  DELETED_BUILTIN_SOUNDS: 'atelier_arles_deleted_sounds_v1',
  AMBIENT_VOLUME: 'atelier_arles_ambient_volume_v1',
  WORKSPACE_COLOR_MODE: 'atelier_arles_workspace_color_mode_v1',
  ARTWORK_PUZZLE: 'atelier_arles_artwork_puzzle_v1',
};

const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundChimeEnabled: true,
  browserNotificationEnabled: true,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = workspaceStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getDurationForMode(
  mode: PomodoroMode,
  settings: PomodoroSettings
): number {
  if (mode === 'focus') return settings.focusMinutes * 60;
  if (mode === 'short_break') return settings.shortBreakMinutes * 60;
  return settings.longBreakMinutes * 60;
}

function findIdbArtworkMatch(
  art: ArtworkItem,
  idbList: ArtworkItem[]
): ArtworkItem | undefined {
  const byId = idbList.find((c) => c.id === art.id);
  if (byId) return byId;
  const normalizedTitle = art.viTitle.trim().toLowerCase();
  if (!normalizedTitle) return undefined;
  return idbList.find(
    (c) => c.viTitle.trim().toLowerCase() === normalizedTitle
  );
}

function hydrateArtworksWithIdbData(
  list: ArtworkItem[],
  idbList: ArtworkItem[]
): ArtworkItem[] {
  return list.map((art) => {
    const match = findIdbArtworkMatch(art, idbList);
    if (
      match &&
      match.imageSrc.startsWith('data:image/') &&
      art.imageSrc.startsWith('/default-artworks/')
    ) {
      return {
        ...art,
        imageSrc: match.imageSrc,
      };
    }
    return art;
  });
}

export default function App() {
  const [deletedBuiltinIds, setDeletedBuiltinIds] = useWorkspaceState<string[]>(STORAGE_KEYS.DELETED_BUILTINS, () =>
    loadFromStorage<string[]>(STORAGE_KEYS.DELETED_BUILTINS, [])
  );
  const [serverManifest, setServerManifest] =
    useState<ServerDefaultArtworksManifest>(() =>
      loadFromStorage<ServerDefaultArtworksManifest>(
        STORAGE_KEYS.SERVER_DEFAULTS_CACHE,
        EMPTY_SERVER_MANIFEST
      )
    );
  const [customArtworks, setCustomArtworks] = useState<ArtworkItem[]>([]);
  const [isArtworkModalOpen, setIsArtworkModalOpen] = useState(false);

  const [activeTheme, setActiveTheme] = useWorkspaceState<PaintingThemeId>(STORAGE_KEYS.THEME, () => {
    const saved = loadFromStorage<string>(STORAGE_KEYS.THEME, '');
    if (saved) return saved;
    const cachedManifest = loadFromStorage<ServerDefaultArtworksManifest>(
      STORAGE_KEYS.SERVER_DEFAULTS_CACHE,
      EMPTY_SERVER_MANIFEST
    );
    if (cachedManifest.replaceBuiltins && cachedManifest.artworks.length > 0) {
      return (
        cachedManifest.defaultThemeId || cachedManifest.artworks[0]?.id || ''
      );
    }
    return BUILTIN_ARTWORKS[0]?.id || '';
  });

  const [activeSection, setActiveSection] = useState<NavSection>('pomodoro');
  const [workspaceColorMode, setWorkspaceColorMode] = useWorkspaceState<'dark' | 'light'>(STORAGE_KEYS.WORKSPACE_COLOR_MODE,
    () => {
      const saved = loadFromStorage<string>(
        STORAGE_KEYS.WORKSPACE_COLOR_MODE,
        'dark'
      );
      return saved === 'light' ? 'light' : 'dark';
    }
  );

  const [cards, setCards] = useWorkspaceState<VocabCard[]>(STORAGE_KEYS.CARDS, () => {
    const raw = loadFromStorage<VocabCard[]>(
      STORAGE_KEYS.CARDS,
      createStarterDeck()
    );
    return raw.map((rawCard) => {
      const c = normalizeSchedule(rawCard);
      const normalizedPos = normalizePartOfSpeechInput(c.partOfSpeech, c.word);
      const syncedMotif =
        resolveArtworkForPartOfSpeech(BUILTIN_ARTWORKS, normalizedPos)?.id ||
        c.paintingMotif;
      return {
        ...c,
        partOfSpeech: normalizedPos,
        paintingMotif: syncedMotif,
      };
    });
  }, latest => latest.map(card => normalizeSchedule(card)));

  const [pomodoroSettings, setPomodoroSettings] = useWorkspaceState<PomodoroSettings>(STORAGE_KEYS.POMO_SETTINGS,
    () => ({
      ...DEFAULT_POMODORO_SETTINGS,
      ...loadFromStorage<Partial<PomodoroSettings>>(
        STORAGE_KEYS.POMO_SETTINGS,
        DEFAULT_POMODORO_SETTINGS
      ),
    })
  );

  const [pomodoroHistory, setPomodoroHistory] = useWorkspaceState<
    PomodoroSessionRecord[]
  >(STORAGE_KEYS.POMO_HISTORY, () =>
    loadFromStorage<PomodoroSessionRecord[]>(STORAGE_KEYS.POMO_HISTORY, [])
  );

  const [reviewLogs, setReviewLogs, reviewStorageError] = useReviewHistory(STORAGE_KEYS.REVIEW_LOGS);

  const [intention, setIntention] = useWorkspaceState<string>(STORAGE_KEYS.INTENTION, () =>
    loadFromStorage<string>(STORAGE_KEYS.INTENTION, '')
  );

  const [puzzleState, setPuzzleState] = useWorkspaceState<ArtworkPuzzleState>(STORAGE_KEYS.ARTWORK_PUZZLE, () => {
    const initialDefaultPuzzleId =
      getCurrentMonthArtworkId(BUILTIN_ARTWORKS) ||
      activeTheme ||
      BUILTIN_ARTWORKS[0]?.id ||
      '';
    const initialPieceMap: Record<string, number> = {};
    for (const meta of buildArtworkMonthMetaList(BUILTIN_ARTWORKS)) {
      initialPieceMap[meta.artworkId] = meta.pieceCount;
    }
    const raw = loadFromStorage<unknown>(
      STORAGE_KEYS.ARTWORK_PUZZLE,
      createInitialPuzzleState(initialDefaultPuzzleId)
    );
    const sanitized = sanitizePuzzleState(
      raw,
      initialDefaultPuzzleId,
      initialPieceMap
    );
    return applyDailyLoginCheckIn(sanitized, getLocalDateKey()).nextState;
  }, latest => {
    const pieceCounts = Object.fromEntries(buildArtworkMonthMetaList(BUILTIN_ARTWORKS).map(meta => [meta.artworkId, meta.pieceCount]));
    return sanitizePuzzleState(latest, getCurrentMonthArtworkId(BUILTIN_ARTWORKS) || activeTheme, pieceCounts);
  });

  // Pomodoro runtime state
  const [pomoMode, setPomoMode] = useState<PomodoroMode>('focus');
  const [secondsLeft, setSecondsLeft] = useState<number>(
    () => pomodoroSettings.focusMinutes * 60
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [ambientType, setAmbientType] = useState<AmbientSoundType>('off');
  const [customSoundTracks, setCustomSoundTracks] = useWorkspaceState<SoundTrack[]>(STORAGE_KEYS.CUSTOM_SOUNDS, () =>
    loadFromStorage<SoundTrack[]>(STORAGE_KEYS.CUSTOM_SOUNDS, [])
  );
  const [deletedBuiltinSoundIds, setDeletedBuiltinSoundIds] = useWorkspaceState<
    string[]
  >(STORAGE_KEYS.DELETED_BUILTIN_SOUNDS, () => loadFromStorage<string[]>(STORAGE_KEYS.DELETED_BUILTIN_SOUNDS, []));
  const [ambientVolume, setAmbientVolume] = useWorkspaceState<number>(STORAGE_KEYS.AMBIENT_VOLUME, () =>
    loadFromStorage<number>(STORAGE_KEYS.AMBIENT_VOLUME, 0.5)
  );
  const [showYoutubeMiniPlayer, setShowYoutubeMiniPlayer] =
    useState<boolean>(false);
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(
    null
  );
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  useEffect(() => {
    const reportStorageError = () => setBannerNotice(
      'Trình duyệt không thể lưu dữ liệu mới. Vui lòng kiểm tra dung lượng và quyền lưu trữ của trang.',
    );
    window.addEventListener('atelier-storage-error', reportStorageError);
    return () => window.removeEventListener('atelier-storage-error', reportStorageError);
  }, []);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() =>
      getBrowserNotificationPermission()
    );
  const [notificationBlockedByFrame, setNotificationBlockedByFrame] =
    useState<boolean>(false);
  const [backgroundCompletionTitle, setBackgroundCompletionTitle] = useState<
    string | null
  >(null);

  // Modal state for adding/editing vocabulary
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [wordModalTab, setWordModalTab] = useState<'single' | 'bulk'>('single');
  const [editingCard, setEditingCard] = useState<VocabCard | null>(null);

  const targetEndMsRef = useRef<number | null>(null);
  const secondsLeftRef = useRef<number>(secondsLeft);
  secondsLeftRef.current = secondsLeft;

  // Load server default artworks + IndexedDB uploads and self-heal missing disk files after cold starts
  useEffect(() => {
    let active = true;
    const hadSavedLocalTheme =
      typeof window !== 'undefined' &&
      workspaceStorage.getItem(STORAGE_KEYS.THEME) !== null;
    const savedDeletedIds = new Set(
      loadFromStorage<string[]>(STORAGE_KEYS.DELETED_BUILTINS, [])
    );

    async function initArtworks() {
      const [manifest, idbArtworks] = await Promise.all([
        fetchServerDefaultArtworks(),
        loadCustomArtworksFromDB(),
      ]);
      if (!active) return;

      setCustomArtworks(idbArtworks);
      setServerManifest(manifest);

      if (manifest.writable) {
        const baseServerArtworks =
          manifest.artworks.length > 0 ? manifest.artworks : BUILTIN_ARTWORKS;
        const missingIds = new Set(manifest.missingFileIds || []);
        const matchedIdbIds = new Set<string>();
        let repairedMissingFilesCount = 0;

        const hydratedServerArtworks = baseServerArtworks.map((art) => {
          const idbMatch = findIdbArtworkMatch(art, idbArtworks);
          if (idbMatch) {
            matchedIdbIds.add(idbMatch.id);
          }
          if (
            idbMatch &&
            idbMatch.imageSrc.startsWith('data:image/') &&
            (missingIds.has(art.id) || !art.imageSrc)
          ) {
            repairedMissingFilesCount += 1;
            return {
              ...art,
              imageSrc: idbMatch.imageSrc,
            };
          }
          return art;
        });

        const existingIds = new Set(baseServerArtworks.map((a) => a.id));
        const unsyncedFromIdb = idbArtworks.filter(
          (a) =>
            !existingIds.has(a.id) &&
            !matchedIdbIds.has(a.id) &&
            !savedDeletedIds.has(a.id)
        );

        if (
          !manifest.replaceBuiltins ||
          manifest.artworks.length === 0 ||
          repairedMissingFilesCount > 0 ||
          unsyncedFromIdb.length > 0
        ) {
          const mergedToPromote = [
            ...hydratedServerArtworks,
            ...unsyncedFromIdb,
          ];
          const savedTheme = loadFromStorage<string>(STORAGE_KEYS.THEME, '');
          const preferredDefaultId =
            mergedToPromote.find((a) => a.id === savedTheme)?.id ||
            manifest.defaultThemeId ||
            mergedToPromote[0]?.id ||
            '';

          const synced = await syncServerDefaultArtworks({
            artworks: mergedToPromote,
            replaceBuiltins: true,
            defaultThemeId: preferredDefaultId,
          });

          if (!active || !synced) return;
          setServerManifest(synced);
          if (unsyncedFromIdb.length > 0) {
            setDeletedBuiltinIds([]);
          }
          if (
            synced.defaultThemeId &&
            !synced.artworks.some((a) => a.id === savedTheme)
          ) {
            setActiveTheme(synced.defaultThemeId);
          }
          return;
        }
      }

      if (
        !hadSavedLocalTheme &&
        manifest.replaceBuiltins &&
        manifest.artworks.length > 0
      ) {
        const openingId =
          manifest.defaultThemeId || manifest.artworks[0]?.id || '';
        if (openingId) {
          setActiveTheme(openingId);
        }
      }
    }

    void initArtworks();

    return () => {
      active = false;
    };
  }, []);

  const baseDefaultArtworks = useMemo(
    () =>
      serverManifest.replaceBuiltins && serverManifest.artworks.length > 0
        ? serverManifest.artworks
        : BUILTIN_ARTWORKS,
    [serverManifest]
  );

  const hasDeletedDefaults = useMemo(
    () => baseDefaultArtworks.some((b) => deletedBuiltinIds.includes(b.id)),
    [baseDefaultArtworks, deletedBuiltinIds]
  );

  // Combined gallery of website default artworks + IndexedDB data hydration + unsynced local uploads
  const artworks = useMemo(() => {
    const missingIds = new Set(serverManifest.missingFileIds || []);
    const matchedIdbIds = new Set<string>();

    const visibleDefaults = baseDefaultArtworks
      .filter((b) => !deletedBuiltinIds.includes(b.id))
      .map((b) => {
        const idbMatch = findIdbArtworkMatch(b, customArtworks);
        if (idbMatch) {
          matchedIdbIds.add(idbMatch.id);
        }
        const builtinBackup =
          b.backupImageSrc || getBuiltinBackupImageSrc(b.id, b.viTitle);
        const idbDataSrc =
          idbMatch && idbMatch.imageSrc.startsWith('data:image/')
            ? idbMatch.imageSrc
            : undefined;

        if (
          idbDataSrc &&
          (missingIds.has(b.id) || b.imageSrc.startsWith('/default-artworks/'))
        ) {
          return {
            ...b,
            imageSrc: idbDataSrc,
            backupImageSrc: builtinBackup,
          };
        }

        if (missingIds.has(b.id) && builtinBackup) {
          return {
            ...b,
            imageSrc: builtinBackup,
            backupImageSrc: builtinBackup,
          };
        }

        return {
          ...b,
          backupImageSrc: idbDataSrc || builtinBackup,
        };
      });

    const defaultIds = new Set(baseDefaultArtworks.map((b) => b.id));
    const extraCustom = customArtworks.filter(
      (c) =>
        !defaultIds.has(c.id) &&
        !matchedIdbIds.has(c.id) &&
        !deletedBuiltinIds.includes(c.id)
    );
    return [...visibleDefaults, ...extraCustom];
  }, [
    baseDefaultArtworks,
    serverManifest.missingFileIds,
    deletedBuiltinIds,
    customArtworks,
  ]);

  const activeArtwork = useMemo(
    () => artworks.find((a) => a.id === activeTheme) || artworks[0],
    [artworks, activeTheme]
  );

  const soundTracks = useMemo(() => {
    const visibleBuiltins = BUILTIN_SOUND_TRACKS.filter(
      (s) => !deletedBuiltinSoundIds.includes(s.id)
    );
    return [...visibleBuiltins, ...customSoundTracks];
  }, [deletedBuiltinSoundIds, customSoundTracks]);

  const activeSoundTrack = useMemo(
    () =>
      ambientType === 'off'
        ? undefined
        : soundTracks.find((s) => s.id === ambientType),
    [ambientType, soundTracks]
  );

  // Keep activeTheme aligned if current artwork was removed
  useEffect(() => {
    if (activeArtwork && activeArtwork.id !== activeTheme) {
      setActiveTheme(activeArtwork.id);
    }
  }, [activeArtwork, activeTheme]);

  // Keep every vocabulary card's paintingMotif paired 1-to-1 with its partOfSpeech artwork slot
  useEffect(() => {
    if (artworks.length === 0) return;
    setCards((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const normalizedPos = normalizePartOfSpeechInput(
          c.partOfSpeech,
          c.word
        );
        const expectedId =
          resolveArtworkForPartOfSpeech(artworks, normalizedPos)?.id ||
          c.paintingMotif;
        if (c.partOfSpeech !== normalizedPos || c.paintingMotif !== expectedId) {
          changed = true;
          return {
            ...c,
            partOfSpeech: normalizedPos,
            paintingMotif: expectedId,
          };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, [artworks]);

  // Keep selected puzzle artwork aligned with available artworks (defaulting to current month)
  useEffect(() => {
    if (
      artworks.length > 0 &&
      !artworks.some((a) => a.id === puzzleState.selectedArtworkId)
    ) {
      const fallbackMonthId =
        getCurrentMonthArtworkId(artworks) || artworks[0].id;
      setPuzzleState((prev) => ({
        ...prev,
        selectedArtworkId: fallbackMonthId,
      }));
    }
  }, [artworks, puzzleState.selectedArtworkId]);

  // Check daily login rollover at midnight or tab focus

  const puzzleStateRef = useRef<ArtworkPuzzleState>(puzzleState);
  puzzleStateRef.current = puzzleState;

  useEffect(() => {
    const syncDailyCheckIn = () => {
      const todayKey = getLocalDateKey();
      const { nextState, newlyCheckedInToday } = applyDailyLoginCheckIn(
        puzzleStateRef.current,
        todayKey
      );
      if (newlyCheckedInToday) {
        puzzleStateRef.current = nextState;
        setPuzzleState(prev => applyDailyLoginCheckIn(prev, todayKey).nextState);
        setBannerNotice(
          'Chào ngày mới! Bạn vừa nhận +1 mảnh ghép hôm nay trong Kho ảnh.'
        );
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncDailyCheckIn();
      }
    };

    setPuzzleState(prev => applyDailyLoginCheckIn(prev, getLocalDateKey()).nextState);
    window.addEventListener('focus', syncDailyCheckIn);
    document.addEventListener('visibilitychange', handleVisibility);
    const intervalId = window.setInterval(syncDailyCheckIn, 60_000);

    return () => {
      window.removeEventListener('focus', syncDailyCheckIn);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  const unplacedPiecesCount = useMemo(
    () => getAvailableUnplacedPieces(puzzleState),
    [puzzleState]
  );

  const handleSelectPuzzleArtwork = useCallback((artworkId: string) => {
    setPuzzleState((prev) => ({
      ...prev,
      selectedArtworkId: artworkId,
    }));
  }, []);

  const handlePlacePuzzlePiece = useCallback(
    (artworkId: string, targetPieceIndex?: number) => {
      const monthMeta = getArtworkMonthMeta(artworks, artworkId);
      const { nextState, placedPieceIndex } = placePieceOnArtwork(
        puzzleStateRef.current,
        artworkId,
        monthMeta.pieceCount,
        monthMeta.monthNumber,
        targetPieceIndex,
        getLocalDateKey()
      );
      if (placedPieceIndex === null) return;

      puzzleStateRef.current = nextState;
      setPuzzleState(prev => placePieceOnArtwork(
        prev, artworkId, monthMeta.pieceCount, monthMeta.monthNumber,
        targetPieceIndex, getLocalDateKey()
      ).nextState);

      if (pomodoroSettings.soundChimeEnabled) {
        playPiecePlaceChime();
      }

      const totalUnlockedAfter =
        nextState.placedByArtwork[artworkId]?.length || 0;
      if (totalUnlockedAfter >= monthMeta.pieceCount) {
        const targetArt = artworks.find((a) => a.id === artworkId);
        setBannerNotice(
          `Tuyệt vời! Bạn đã ghép hoàn chỉnh trọn vẹn ${monthMeta.pieceCount}/${monthMeta.pieceCount} mảnh bức tranh ${monthMeta.monthLabelVi}${
            targetArt ? ` — "${targetArt.viTitle}"` : ''
          }.`
        );
      }
    },
    [artworks, pomodoroSettings.soundChimeEnabled]
  );

  const handleRecallPuzzlePieces = useCallback((artworkId: string) => {
    setPuzzleState((prev) => recallArtworkPiecesToTray(prev, artworkId));
  }, []);

  const handleTogglePuzzleUnderdrawing = useCallback(() => {
    setPuzzleState((prev) => ({
      ...prev,
      showUnderdrawing: !prev.showUnderdrawing,
    }));
  }, []);

  const handleTogglePuzzleGridLines = useCallback(() => {
    setPuzzleState((prev) => ({
      ...prev,
      showGridLines: !prev.showGridLines,
    }));
  }, []);

  // Sync CSS palette to root HTML attribute (Light/Dark mode on SRS, Vocabulary & Analytics; painting palette on Pomodoro)
  useEffect(() => {
    const artworkPalette: BasePaletteKey =
      activeArtwork?.paletteKey || 'starry_night';
    const isWorkspacePage = activeSection !== 'pomodoro';
    const effectiveTheme = isWorkspacePage
      ? workspaceColorMode === 'light'
        ? 'workspace_light'
        : artworkPalette === 'cafe_terrace'
        ? 'cafe_terrace'
        : 'starry_night'
      : artworkPalette;

    const isDarkTheme =
      effectiveTheme === 'starry_night' || effectiveTheme === 'cafe_terrace';

    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.classList.toggle('dark', isDarkTheme);
  }, [activeArtwork, activeSection, workspaceColorMode]);

  useEffect(() => {
    try {
      workspaceStorage.setItem(
        STORAGE_KEYS.SERVER_DEFAULTS_CACHE,
        JSON.stringify(serverManifest)
      );
    } catch {
      // Persistent write errors are reported by workspaceStorage.
    }
  }, [serverManifest]);

  useEffect(() => {
    if (reviewStorageError) setBannerNotice(reviewStorageError);
  }, [reviewStorageError]);

  useEffect(() => {
    return () => {
      ambientSound.stop();
    };
  }, []);

  // Sync browser Notification permission changes & clear background alert title when user returns to tab
  useEffect(() => {
    const syncPermissionAndVisibility = () => {
      const latestPerm = getBrowserNotificationPermission();
      setNotificationPermission(latestPerm);
      if (latestPerm === 'granted') {
        setNotificationBlockedByFrame(false);
      }
      if (typeof document !== 'undefined' && !document.hidden) {
        setBackgroundCompletionTitle(null);
      }
    };

    window.addEventListener('focus', syncPermissionAndVisibility);
    document.addEventListener('visibilitychange', syncPermissionAndVisibility);

    let permStatus: PermissionStatus | null = null;
    if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      typeof navigator.permissions?.query === 'function'
    ) {
      void navigator.permissions
        .query({ name: 'notifications' })
        .then((status) => {
          permStatus = status;
          status.onchange = syncPermissionAndVisibility;
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('focus', syncPermissionAndVisibility);
      document.removeEventListener(
        'visibilitychange',
        syncPermissionAndVisibility
      );
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  const handleRequestNotificationPermission = useCallback(
    async (options?: { silentNotice?: boolean }) => {
      const outcome = await requestBrowserNotificationPermission();
      setNotificationPermission(outcome.permission);
      setNotificationBlockedByFrame(outcome.blockedByFrame);

      if (outcome.permission === 'granted') {
        setPomodoroSettings((prev) => ({
          ...prev,
          browserNotificationEnabled: true,
        }));
        if (!options?.silentNotice) {
          setBannerNotice(
            'Đã bật thông báo đẩy trình duyệt khi kết thúc phiên Pomodoro.'
          );
        }
      } else if (!options?.silentNotice) {
        if (outcome.blockedByFrame) {
          setBannerNotice(
            'Khung xem trước đang giới hạn hộp thoại cấp quyền. Hãy mở ứng dụng ở tab trình duyệt riêng để bật thông báo đẩy.'
          );
        } else if (outcome.permission === 'denied') {
          setBannerNotice(
            'Quyền thông báo đang bị chặn. Hãy cho phép Thông báo ở biểu tượng ổ khóa trên thanh địa chỉ trình duyệt.'
          );
        }
      }

      return outcome.permission;
    },
    []
  );

  const handleTestBrowserNotification = useCallback(async () => {
    let currentPerm = getBrowserNotificationPermission();
    if (currentPerm !== 'granted') {
      currentPerm = await handleRequestNotificationPermission({
        silentNotice: true,
      });
    }
    if (currentPerm === 'granted') {
      const sent = sendTestBrowserNotification(activeArtwork?.imageSrc);
      if (sent) {
        setBannerNotice(
          'Đã gửi thông báo đẩy thử nghiệm tới màn hình của bạn.'
        );
      }
    } else {
      setBannerNotice(
        'Chưa thể gửi thông báo thử vì trình duyệt chưa cấp quyền Thông báo.'
      );
    }
  }, [activeArtwork?.imageSrc, handleRequestNotificationPermission]);

  // Add & Delete Artwork Handlers
  const handleAddArtworks = async (
    items: Array<{
      viTitle: string;
      quoteVi: string;
      imageSrc: string;
      paletteKey: BasePaletteKey;
    }>
  ) => {
    const now = Date.now();
    const nextIndexBase =
      (serverManifest.replaceBuiltins ? serverManifest.artworks.length : 0) +
      customArtworks.length;

    const created: ArtworkItem[] = items.map((item, idx) => ({
      id: `custom-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      viTitle: item.viTitle,
      originalTitle: 'Bộ sưu tập cá nhân',
      locationYear: new Date(now).toLocaleDateString('vi-VN'),
      medium: 'Ảnh nền mặc định',
      accessionCode: `USR-${String(nextIndexBase + idx + 1).padStart(2, '0')}`,
      quoteVi:
        item.quoteVi ||
        'Mỗi phiên tập trung yên tĩnh là một nét cọ bền bỉ trên hành trình của riêng bạn.',
      quoteSource: 'Bộ sưu tập cá nhân',
      imageSrc: item.imageSrc,
      imageScaleClass: 'scale-100',
      fallbackBgClass:
        'bg-gradient-to-br from-slate-950 via-blue-950 to-amber-500',
      isDark:
        item.paletteKey === 'starry_night' ||
        item.paletteKey === 'cafe_terrace',
      paletteKey: item.paletteKey,
      isCustom: true,
    }));

    for (const art of created) {
      await saveCustomArtworkToDB(art);
    }

    setCustomArtworks((prev) => [...prev, ...created]);
    if (created[0]) {
      setActiveTheme(created[0].id);
    }

    if (serverManifest.writable) {
      const existingDefaults = hydrateArtworksWithIdbData(
        serverManifest.replaceBuiltins
          ? serverManifest.artworks
          : BUILTIN_ARTWORKS,
        customArtworks
      );
      const existingDefaultIds = new Set(existingDefaults.map((a) => a.id));
      const unsyncedExisting = customArtworks.filter(
        (c) => !existingDefaultIds.has(c.id)
      );
      const nextDefaults = [
        ...existingDefaults,
        ...unsyncedExisting,
        ...created,
      ];
      const synced = await syncServerDefaultArtworks({
        artworks: nextDefaults,
        replaceBuiltins: true,
        defaultThemeId:
          serverManifest.defaultThemeId || created[0]?.id || activeTheme,
      });
      if (synced) {
        setServerManifest(synced);
        setBannerNotice(
          created.length === 1
            ? `Đã thêm "${created[0].viTitle}" vào bộ ảnh mặc định của trang web.`
            : `Đã thêm ${created.length} ảnh mới vào bộ ảnh mặc định của trang web.`
        );
        return;
      }
    }

    setBannerNotice(
      created.length === 1
        ? `Đã thêm ảnh nền "${created[0].viTitle}".`
        : `Đã thêm ${created.length} ảnh nền mới.`
    );
  };

  const handleDeleteArtwork = async (id: string) => {
    const target = artworks.find((a) => a.id === id);
    if (!target) return;

    const remaining = artworks.filter((a) => a.id !== id);
    const nextIdbList = customArtworks.filter((a) => a.id !== id);
    await deleteCustomArtworkFromDB(id);
    setCustomArtworks(nextIdbList);

    const isServerDefault = serverManifest.artworks.some((a) => a.id === id);
    if (serverManifest.writable && isServerDefault) {
      const nextServerArtworks = hydrateArtworksWithIdbData(
        serverManifest.artworks.filter((a) => a.id !== id),
        nextIdbList
      );
      const nextDefaultId =
        serverManifest.defaultThemeId === id
          ? nextServerArtworks[0]?.id || ''
          : serverManifest.defaultThemeId;
      const synced = await syncServerDefaultArtworks({
        artworks: nextServerArtworks,
        replaceBuiltins: nextServerArtworks.length > 0,
        defaultThemeId: nextDefaultId,
      });
      if (synced) {
        setServerManifest(synced);
      }
    } else if (!target.isCustom) {
      setDeletedBuiltinIds((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    }

    if (activeTheme === id) {
      setActiveTheme(remaining[0]?.id || '');
    }
    setBannerNotice(`Đã xóa ảnh "${target.viTitle}".`);
  };

  const handleRestoreBuiltins = () => {
    setDeletedBuiltinIds([]);
    if (!activeArtwork && baseDefaultArtworks[0]) {
      setActiveTheme(baseDefaultArtworks[0].id);
    }
    setBannerNotice('Đã khôi phục bộ ảnh mặc định.');
  };

  const handleSetDefaultThemeId = async (id: string) => {
    if (!serverManifest.writable || serverManifest.artworks.length === 0) {
      return;
    }
    const hydrated = hydrateArtworksWithIdbData(
      serverManifest.artworks,
      customArtworks
    );
    const synced = await syncServerDefaultArtworks({
      artworks: hydrated,
      replaceBuiltins: true,
      defaultThemeId: id,
    });
    if (synced) {
      setServerManifest(synced);
      setActiveTheme(id);
      const chosen = synced.artworks.find((a) => a.id === id);
      setBannerNotice(
        chosen
          ? `Đã đặt "${chosen.viTitle}" làm ảnh mở đầu mặc định của trang web.`
          : 'Đã cập nhật ảnh mở đầu mặc định.'
      );
    }
  };

  const totalSecondsForCurrentMode = useMemo(
    () => getDurationForMode(pomoMode, pomodoroSettings),
    [pomoMode, pomodoroSettings]
  );

  const { completedFocusToday, focusedMinutesToday, reviewedTodayCount } =
    useMemo(() => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();

      const todayFocus = pomodoroHistory.filter(
        (s) => s.mode === 'focus' && s.completedAt >= todayMs
      );
      const mins = todayFocus.reduce((acc, s) => acc + s.durationMinutes, 0);
      const revToday = reviewLogs.filter((r) => r.reviewedAt >= todayMs).length;

      return {
        completedFocusToday: todayFocus.length,
        focusedMinutesToday: mins,
        reviewedTodayCount: revToday,
      };
    }, [pomodoroHistory, reviewLogs]);

  const dueCards = useDueCards(cards);

  const completeCurrentPomodoroSession = useCallback(() => {
    setIsRunning(false);
    targetEndMsRef.current = null;

    if (pomodoroSettings.soundChimeEnabled) {
      playSessionChime();
    }

    const durationMins =
      pomoMode === 'focus'
        ? pomodoroSettings.focusMinutes
        : pomoMode === 'short_break'
        ? pomodoroSettings.shortBreakMinutes
        : pomodoroSettings.longBreakMinutes;

    const record: PomodoroSessionRecord = {
      id: `pomo-${Date.now()}`,
      mode: pomoMode,
      durationMinutes: durationMins,
      completedAt: Date.now(),
      intention: intention.trim(),
      paintingTheme: activeArtwork?.id || activeTheme,
    };

    setPomodoroHistory((prev) => [record, ...prev].slice(0, 200));

    if (pomoMode === 'focus') {
      const nextCount = completedFocusToday + 1;
      const shouldLongBreak =
        nextCount % pomodoroSettings.sessionsBeforeLongBreak === 0;
      const nextMode: PomodoroMode = shouldLongBreak
        ? 'long_break'
        : 'short_break';
      const nextMinutes = shouldLongBreak
        ? pomodoroSettings.longBreakMinutes
        : pomodoroSettings.shortBreakMinutes;

      setPomoMode(nextMode);
      setSecondsLeft(getDurationForMode(nextMode, pomodoroSettings));
      setBannerNotice(
        shouldLongBreak
          ? `Hoàn thành ${nextCount} phiên tập trung. Đã chuyển sang Nghỉ dài (${pomodoroSettings.longBreakMinutes} phút).`
          : `Hoàn thành phiên tập trung. Hãy thư giãn ${pomodoroSettings.shortBreakMinutes} phút trước phiên tiếp theo.`
      );

      if (pomodoroSettings.browserNotificationEnabled) {
        sendPomodoroBrowserNotification({
          completedMode: 'focus',
          completedMinutes: durationMins,
          nextMode,
          nextMinutes,
          intention: intention.trim(),
          artworkImageSrc: activeArtwork?.imageSrc,
        });
      }

      if (typeof document !== 'undefined' && document.hidden) {
        setBackgroundCompletionTitle(
          `🔔 Hoàn thành phiên Tập trung! — Enti Atelier`
        );
      }
    } else {
      setPomoMode('focus');
      setSecondsLeft(getDurationForMode('focus', pomodoroSettings));
      setBannerNotice(
        'Thời gian nghỉ đã kết thúc. Sẵn sàng cho phiên tập trung tiếp theo.'
      );

      if (pomodoroSettings.browserNotificationEnabled) {
        sendPomodoroBrowserNotification({
          completedMode: pomoMode,
          completedMinutes: durationMins,
          nextMode: 'focus',
          nextMinutes: pomodoroSettings.focusMinutes,
          intention: intention.trim(),
          artworkImageSrc: activeArtwork?.imageSrc,
        });
      }

      if (typeof document !== 'undefined' && document.hidden) {
        setBackgroundCompletionTitle(
          `🔔 Hết giờ nghỉ · Sẵn sàng tập trung! — Enti Atelier`
        );
      }
    }
  }, [
    activeArtwork?.id,
    activeArtwork?.imageSrc,
    activeTheme,
    completedFocusToday,
    intention,
    pomoMode,
    pomodoroSettings,
  ]);

  const completeSessionRef = useRef(completeCurrentPomodoroSession);
  completeSessionRef.current = completeCurrentPomodoroSession;

  useEffect(() => {
    if (!isRunning) return;

    if (!targetEndMsRef.current) {
      targetEndMsRef.current = Date.now() + secondsLeftRef.current * 1000;
    }

    const stopTicker = startUnthrottledTicker(() => {
      const endMs = targetEndMsRef.current;
      if (!endMs) return;

      const remaining = Math.max(0, Math.round((endMs - Date.now()) / 1000));
      setSecondsLeft((prev) => (prev !== remaining ? remaining : prev));

      if (remaining <= 0) {
        targetEndMsRef.current = null;
        stopTicker();
        completeSessionRef.current();
      }
    }, 250);

    return () => {
      stopTicker();
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) {
      document.title =
        backgroundCompletionTitle ||
        "Enti Atelier";
      return;
    }
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');
    const modeText =
      pomoMode === 'focus'
        ? 'Tập trung'
        : pomoMode === 'short_break'
        ? 'Nghỉ ngắn'
        : 'Nghỉ dài';
    document.title = `${mins}:${secs} · ${modeText} — Enti Atelier`;
  }, [isRunning, secondsLeft, pomoMode, backgroundCompletionTitle]);

  const handleToggleRun = () => {
    setBannerNotice(null);
    setBackgroundCompletionTitle(null);
    if (isRunning) {
      setIsRunning(false);
      targetEndMsRef.current = null;
    } else {
      if (
        pomodoroSettings.browserNotificationEnabled &&
        getBrowserNotificationPermission() === 'default'
      ) {
        void handleRequestNotificationPermission({ silentNotice: true });
      }
      targetEndMsRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
    }
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    targetEndMsRef.current = null;
    setSecondsLeft(getDurationForMode(pomoMode, pomodoroSettings));
  };

  const handleSelectMode = (nextMode: PomodoroMode) => {
    setIsRunning(false);
    targetEndMsRef.current = null;
    setPomoMode(nextMode);
    setSecondsLeft(getDurationForMode(nextMode, pomodoroSettings));
  };

  const handleSkipSession = () => {
    setIsRunning(false);
    targetEndMsRef.current = null;
    if (pomoMode === 'focus') {
      setPomoMode('short_break');
      setSecondsLeft(getDurationForMode('short_break', pomodoroSettings));
    } else {
      setPomoMode('focus');
      setSecondsLeft(getDurationForMode('focus', pomodoroSettings));
    }
  };

  const handleUpdatePomodoroSettings = (next: PomodoroSettings) => {
    setPomodoroSettings(next);
    if (!isRunning) {
      setSecondsLeft(getDurationForMode(pomoMode, next));
    }
  };

  const handleChangeAmbient = useCallback(
    (type: AmbientSoundType) => {
      setAudioPlaybackError(null);
      setAmbientType(type);
      if (type === 'off') {
        ambientSound.stop();
        setShowYoutubeMiniPlayer(false);
        return;
      }
      const selected = soundTracks.find((s) => s.id === type);
      if (selected?.kind === 'builtin_rain') {
        ambientSound.setSound('rain', ambientVolume);
        setShowYoutubeMiniPlayer(false);
      } else if (selected?.kind === 'builtin_wind') {
        ambientSound.setSound('wind', ambientVolume);
        setShowYoutubeMiniPlayer(false);
      } else {
        ambientSound.stop();
        if (selected?.kind !== 'youtube') {
          setShowYoutubeMiniPlayer(false);
        }
      }
    },
    [soundTracks, ambientVolume]
  );

  const handleAddSoundTrack = (track: Omit<SoundTrack, 'id'>) => {
    const newTrack: SoundTrack = {
      ...track,
      id: `snd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setCustomSoundTracks((prev) => [...prev, newTrack]);
    setAudioPlaybackError(null);
    ambientSound.stop();
    setAmbientType(newTrack.id);
  };

  const handleDeleteSoundTrack = (id: string) => {
    if (ambientType === id) {
      setAmbientType('off');
      ambientSound.stop();
      setShowYoutubeMiniPlayer(false);
      setAudioPlaybackError(null);
    }
    const isBuiltin = BUILTIN_SOUND_TRACKS.some((b) => b.id === id);
    if (isBuiltin) {
      setDeletedBuiltinSoundIds((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    } else {
      setCustomSoundTracks((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleRestoreBuiltinSounds = () => {
    setDeletedBuiltinSoundIds([]);
  };

  const handleChangeAmbientVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setAmbientVolume(clamped);
    ambientSound.setVolume(clamped);
  };

  const handleRateCard = async (cardId: string, grade: RecallGrade, practice = false) => {
    const now = Date.now();
    let targetCard: VocabCard | undefined;
    let next: VocabCard | undefined;
    try {
      await workspaceStorage.updateJSON<VocabCard[]>(STORAGE_KEYS.CARDS, cards, latest => {
        targetCard = latest.find(c => c.id === cardId);
        if (!targetCard) return latest;
        next = reviewCard(normalizeSchedule(targetCard), grade, now, practice);
        return practice ? latest : latest.map(c => c.id === cardId ? next! : c);
      });
    } catch { return; }
    if (!targetCard || !next) return;
    const logEntry: ReviewLogRecord = {
      id: `rev-${now}-${Math.random().toString(36).slice(2, 6)}`,
      cardId,
      word: targetCard.word,
      grade,
      reviewedAt: now,
      newInterval: next.interval,
      practice,
      scheduler: 'FSRS-6',
      dueBeforeReview: targetCard.nextReviewAt,
      previousReviewAt: targetCard.lastReviewedAt,
      memoryBefore: targetCard.fsrs,
      memoryAfter: next.fsrs,
    };
    setReviewLogs(prev => [logEntry, ...prev]);
  };

  const handleSaveSingleWord = (data: SingleWordInput, editingId?: string) => {
    const now = Date.now();
    const normalizedPos = normalizePartOfSpeechInput(
      data.partOfSpeech,
      data.word
    );
    const syncedMotif =
      resolveArtworkForPartOfSpeech(artworks, normalizedPos)?.id ||
      data.paintingMotif;

    if (editingId) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                word: data.word,
                phonetic: data.phonetic,
                partOfSpeech: normalizedPos,
                meaning: data.meaning,
                example: data.example,
                notes: data.notes,
                paintingMotif: syncedMotif,
              }
            : c
        )
      );
      setBannerNotice(`Đã cập nhật từ "${data.word}".`);
    } else {
      const newCard: VocabCard = {
        id: `card-${now}-${Math.random().toString(36).slice(2, 7)}`,
        word: data.word,
        phonetic: data.phonetic,
        partOfSpeech: normalizedPos,
        meaning: data.meaning,
        example: data.example,
        notes: data.notes,
        paintingMotif: syncedMotif,
        repetitions: 0,
        easeFactor: 2.5,
        interval: 0,
        nextReviewAt: now,
        lastReviewedAt: null,
        totalReviews: 0,
        lapses: 0,
        createdAt: now,
      };
      setCards((prev) => [newCard, ...prev]);
      setBannerNotice(
        `Đã thêm từ "${data.word}" vào kho từ và sẵn sàng ôn tập ngay.`
      );
    }
  };

  const handleSaveBulkWords = (
    items: Array<{
      word: string;
      meaning: string;
      example: string;
      partOfSpeech: PartOfSpeech;
      paintingMotif: PaintingThemeId;
    }>
  ) => {
    const now = Date.now();
    const created: VocabCard[] = items.map((item, idx) => {
      const normalizedPos = normalizePartOfSpeechInput(
        item.partOfSpeech,
        item.word
      );
      const syncedMotif =
        resolveArtworkForPartOfSpeech(artworks, normalizedPos)?.id ||
        item.paintingMotif;
      return {
        id: `bulk-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        word: item.word,
        phonetic: '',
        partOfSpeech: normalizedPos,
        meaning: item.meaning,
        example: item.example,
        notes: '',
        paintingMotif: syncedMotif,
        repetitions: 0,
        easeFactor: 2.5,
        interval: 0,
        nextReviewAt: now,
        lastReviewedAt: null,
        totalReviews: 0,
        lapses: 0,
        createdAt: now + idx,
      };
    });
    setCards((prev) => [...created, ...prev]);
    setBannerNotice(`Đã thêm ${created.length} từ vựng mới vào bộ sưu tập.`);
  };

  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleResetCardProgress = (cardId: string) => {
    const now = Date.now();
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              fsrs: undefined,
              repetitions: 0,
              easeFactor: 2.5,
              interval: 0,
              nextReviewAt: now,
              lastReviewedAt: null,
              totalReviews: 0,
              lapses: 0,
            }
          : c
      )
    );
    setBannerNotice('Đã đặt lại tiến độ FSRS của thẻ từ về trạng thái từ mới.');
  };

  const handleImportCardsJson = (imported: VocabCard[]) => {
    setCards((prev) => {
      const existingMap = new Map(prev.map((c) => [c.id, c]));
      imported.forEach((item) => {
        existingMap.set(item.id, normalizeSchedule(item));
      });
      return Array.from(existingMap.values());
    });
  };

  const openAddSingleModal = () => {
    setEditingCard(null);
    setWordModalTab('single');
    setIsWordModalOpen(true);
  };

  const openAddBulkModal = () => {
    setEditingCard(null);
    setWordModalTab('bulk');
    setIsWordModalOpen(true);
  };

  const openEditModal = (card: VocabCard) => {
    setEditingCard(card);
    setWordModalTab('single');
    setIsWordModalOpen(true);
  };

  const miniTimerFormatted = `${String(Math.floor(secondsLeft / 60)).padStart(
    2,
    '0'
  )}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {activeSection === 'pomodoro' ? (
        <PomodoroStudio
          artworks={artworks}
          activeArtwork={activeArtwork}
          activeTheme={activeArtwork?.id || activeTheme}
          onSelectTheme={setActiveTheme}
          onOpenAddArtwork={() => setIsArtworkModalOpen(true)}
          onDeleteArtwork={(id) => void handleDeleteArtwork(id)}
          onRestoreBuiltins={handleRestoreBuiltins}
          hasDeletedBuiltins={hasDeletedDefaults}
          onSelectSection={setActiveSection}
          mode={pomoMode}
          secondsLeft={secondsLeft}
          totalSeconds={totalSecondsForCurrentMode}
          isRunning={isRunning}
          completedFocusToday={completedFocusToday}
          focusedMinutesToday={focusedMinutesToday}
          intention={intention}
          onChangeIntention={setIntention}
          onSelectMode={handleSelectMode}
          onToggleRun={handleToggleRun}
          onReset={handleResetTimer}
          onSkip={handleSkipSession}
          settings={pomodoroSettings}
          onUpdateSettings={handleUpdatePomodoroSettings}
          notificationPermission={notificationPermission}
          notificationBlockedByFrame={notificationBlockedByFrame}
          onRequestNotificationPermission={() =>
            void handleRequestNotificationPermission()
          }
          onTestBrowserNotification={() => void handleTestBrowserNotification()}
          ambientType={ambientType}
          onChangeAmbient={handleChangeAmbient}
          soundTracks={soundTracks}
          hasDeletedBuiltinSounds={deletedBuiltinSoundIds.length > 0}
          ambientVolume={ambientVolume}
          onChangeAmbientVolume={handleChangeAmbientVolume}
          onAddSoundTrack={handleAddSoundTrack}
          onDeleteSoundTrack={handleDeleteSoundTrack}
          onRestoreBuiltinSounds={handleRestoreBuiltinSounds}
          showYoutubeMiniPlayer={showYoutubeMiniPlayer}
          onToggleYoutubeMiniPlayer={() =>
            setShowYoutubeMiniPlayer((prev) => !prev)
          }
          audioPlaybackError={audioPlaybackError}
          dueCards={dueCards}
          unplacedPiecesCount={unplacedPiecesCount}
          reviewedTodayCount={reviewedTodayCount}
          onRateCard={handleRateCard}
          onOpenAddWord={openAddSingleModal}
          bannerNotice={bannerNotice}
          onDismissNotice={() => setBannerNotice(null)}
        />
      ) : (
        <div className="relative flex-1 flex flex-col bg-[var(--bg-canvas)] overflow-x-clip">
          {/* Synchronized Top Navigation Row (matches Pomodoro top-left 50% bar position & geometry) */}
          <header className="relative z-20 w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-xs">
            <div className="flex items-start lg:items-center justify-between gap-3 sm:gap-4">
              <WorkspaceNavBar
                activeSection={activeSection}
                dueCount={dueCards.length}
                unplacedPiecesCount={unplacedPiecesCount}
                onSelectSection={setActiveSection}
                variant="surface"
                className="flex-1 lg:flex-none"
              />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <FacebookLink />
                <GitHubLink />
              </div>
            </div>
          </header>

          {/* Secondary Utility Strip: Live Mini Timer & Light/Dark Mode Toggle */}
          <div className="relative z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/75">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-[var(--text-muted)]">
                  Đồng hồ {pomoMode === 'focus' ? 'Tập trung' : 'Nghỉ'}:{' '}
                  <strong className="text-[var(--text-primary)]">
                    {miniTimerFormatted}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleToggleRun}
                  className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Tạm dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Chạy tiếp</span>
                    </>
                  )}
                </button>
                <span className="text-[var(--text-muted)]">·</span>
                <button
                  type="button"
                  onClick={() => setActiveSection('pomodoro')}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                >
                  Mở tranh toàn màn hình
                </button>
              </div>

              <div
                role="group"
                aria-label="Chế độ nền sáng và tối"
                className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setWorkspaceColorMode('light')}
                  aria-pressed={workspaceColorMode === 'light'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workspaceColorMode === 'light'
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Nền sáng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceColorMode('dark')}
                  aria-pressed={workspaceColorMode === 'dark'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workspaceColorMode === 'dark'
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Nền tối</span>
                </button>
              </div>
            </div>
          </div>

          <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10">
            {activeSection === 'srs' && (
              <SpacedRepetitionStudy
                cards={cards}
                artworks={artworks}
                onRateCard={handleRateCard}
                onOpenAddWord={openAddSingleModal}
                reviewedTodayCount={reviewedTodayCount}
              />
            )}

            {activeSection === 'vocabulary' && (
              <>
                <BackupControls cards={cards} reviews={reviewLogs} />
                <VocabularyLibrary
                  cards={cards}
                  artworks={artworks}
                  onOpenAddModal={openAddSingleModal}
                  onOpenBulkModal={openAddBulkModal}
                  onEditCard={openEditModal}
                  onDeleteCard={handleDeleteCard}
                  onResetCardProgress={handleResetCardProgress}
                  onImportCardsJson={handleImportCardsJson}
                />
              </>
            )}

            {activeSection === 'gallery' && (
              <ArtworkVaultView
                artworks={artworks}
                activeTheme={activeArtwork?.id || activeTheme}
                puzzleState={puzzleState}
                onSelectPuzzleArtwork={handleSelectPuzzleArtwork}
                onPlacePiece={handlePlacePuzzlePiece}
                onRecallPieces={handleRecallPuzzlePieces}
                onToggleUnderdrawing={handleTogglePuzzleUnderdrawing}
                onToggleGridLines={handleTogglePuzzleGridLines}
                onApplyAsPomodoroTheme={(artworkId) => {
                  setActiveTheme(artworkId);
                }}
                onOpenAddArtwork={() => setIsArtworkModalOpen(true)}
              />
            )}

            {activeSection === 'analytics' && (
              <AnalyticsView
                cards={cards}
                artworks={artworks}
                pomodoroHistory={pomodoroHistory}
                reviewLogs={reviewLogs}
              />
            )}
          </main>

          <footer className="relative z-10 border-t border-[var(--border-subtle)] py-6 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center text-xs text-[var(--text-muted)]">
              <p>© ENTI 2026</p>
            </div>
          </footer>
          <DonateWidget />
        </div>
      )}

      {/* Vocabulary Modal */}
      <WordModal
        isOpen={isWordModalOpen}
        initialTab={wordModalTab}
        editingCard={editingCard}
        artworks={artworks}
        defaultMotif={activeArtwork?.id || 'starry_night'}
        onClose={() => setIsWordModalOpen(false)}
        onSaveSingle={handleSaveSingleWord}
        onSaveBulk={handleSaveBulkWords}
      />

      {/* Add & Manage Artworks Modal */}
      <AddArtworkModal
        isOpen={isArtworkModalOpen}
        artworks={artworks}
        hasDeletedBuiltins={hasDeletedDefaults}
        defaultThemeId={
          serverManifest.defaultThemeId || baseDefaultArtworks[0]?.id
        }
        canEditServerDefaults={serverManifest.writable}
        onSetDefaultThemeId={(id) => void handleSetDefaultThemeId(id)}
        onClose={() => setIsArtworkModalOpen(false)}
        onAddArtworks={(items) => void handleAddArtworks(items)}
        onDeleteArtwork={(id) => void handleDeleteArtwork(id)}
        onRestoreBuiltins={handleRestoreBuiltins}
      />

      {/* Persistent Background Audio Player (YouTube / MP3 / Studio Sound) */}
      <BackgroundAudioPlayer
        activeTrack={activeSoundTrack}
        volume={ambientVolume}
        showYoutubeMiniPlayer={showYoutubeMiniPlayer}
        onCloseYoutubeMiniPlayer={() => setShowYoutubeMiniPlayer(false)}
        onPlaybackError={setAudioPlaybackError}
      />
    </div>
  );
}
