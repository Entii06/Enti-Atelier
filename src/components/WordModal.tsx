import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, BookOpen, Loader2, Volume2 } from 'lucide-react';
import {
  BUILTIN_ARTWORKS,
  getPartOfSpeechForSlotIndex,
  getPartOfSpeechSlotIndex,
  ORDERED_PARTS_OF_SPEECH,
  resolveArtworkForPartOfSpeech,
} from '../constants/themes';
import { ArtworkItem, PaintingThemeId, PartOfSpeech, VocabCard } from '../types';
import {
  playDictionaryPronunciation,
  PronunciationAccent,
  stopDictionaryPronunciation,
} from '../utils/audio';
import {
  CambridgeSenseItem,
  DictionarySuggestion,
  lookupEnglishDictionary,
  normalizePartOfSpeechInput,
  PART_OF_SPEECH_EN_TAGS,
  PART_OF_SPEECH_LABELS,
  PART_OF_SPEECH_SHORT,
  parseBulkVocabularyText,
} from '../utils/srs';
import { ArtworkImage } from './ArtworkImage';

export interface SingleWordInput {
  word: string;
  phonetic: string;
  partOfSpeech: PartOfSpeech;
  meaning: string;
  example: string;
  notes: string;
  paintingMotif: PaintingThemeId;
}

interface WordModalProps {
  isOpen: boolean;
  initialTab?: 'single' | 'bulk';
  editingCard: VocabCard | null;
  artworks: ArtworkItem[];
  defaultMotif: PaintingThemeId;
  onClose: () => void;
  onSaveSingle: (data: SingleWordInput, editingId?: string) => void;
  onSaveBulk: (
    items: Array<{
      word: string;
      meaning: string;
      example: string;
      partOfSpeech: PartOfSpeech;
      paintingMotif: PaintingThemeId;
    }>
  ) => void;
}

export const WordModal: React.FC<WordModalProps> = ({
  isOpen,
  initialTab = 'single',
  editingCard,
  artworks,
  defaultMotif,
  onClose,
  onSaveSingle,
  onSaveBulk,
}) => {
  const selectableArtworks =
    artworks.length > 0 ? artworks : BUILTIN_ARTWORKS;

  const getMotifForPos = useCallback(
    (pos: PartOfSpeech): PaintingThemeId => {
      return (
        resolveArtworkForPartOfSpeech(selectableArtworks, pos)?.id ||
        selectableArtworks[0]?.id ||
        defaultMotif
      );
    },
    [selectableArtworks, defaultMotif]
  );

  const [tab, setTab] = useState<'single' | 'bulk'>(initialTab);
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>('verb');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [notes, setNotes] = useState('');
  const [paintingMotif, setPaintingMotif] = useState<PaintingThemeId>(() =>
    getMotifForPos('verb')
  );

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [senses, setSenses] = useState<CambridgeSenseItem[]>([]);
  const [selectedSenseIdx, setSelectedSenseIdx] = useState<number>(0);
  const [audioUrls, setAudioUrls] = useState<{ uk: string; us: string }>({
    uk: '',
    us: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [bulkText, setBulkText] = useState('');

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastLookedUpWordRef = useRef('');
  const lastAutoFilledRef = useRef({
    phonetic: '',
    meaning: '',
    example: '',
    notes: '',
  });
  const currentFieldsRef = useRef({
    phonetic: '',
    meaning: '',
    example: '',
    notes: '',
  });

  currentFieldsRef.current = {
    phonetic,
    meaning,
    example,
    notes,
  };

  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort();
      stopDictionaryPronunciation();
      return;
    }
    setFormError(null);
    setLookupStatus(null);
    setSenses([]);
    setSelectedSenseIdx(0);
    setAudioUrls({ uk: '', us: '' });
    lastAutoFilledRef.current = {
      phonetic: '',
      meaning: '',
      example: '',
      notes: '',
    };

    if (editingCard) {
      const normalizedPos = normalizePartOfSpeechInput(
        editingCard.partOfSpeech,
        editingCard.word
      );
      setTab('single');
      setWord(editingCard.word);
      setPhonetic(editingCard.phonetic);
      setPartOfSpeech(normalizedPos);
      setMeaning(editingCard.meaning);
      setExample(editingCard.example);
      setNotes(editingCard.notes);
      lastLookedUpWordRef.current = editingCard.word.trim().toLowerCase();
      setPaintingMotif(getMotifForPos(normalizedPos));
    } else {
      setTab(initialTab);
      setWord('');
      setPhonetic('');
      setPartOfSpeech('verb');
      setMeaning('');
      setExample('');
      setNotes('');
      lastLookedUpWordRef.current = '';
      setPaintingMotif(getMotifForPos('verb'));
      setBulkText('');
    }
  }, [isOpen, editingCard, initialTab, getMotifForPos]);

  const clearPreviousAutoFilledFields = useCallback(() => {
    const cur = currentFieldsRef.current;
    const prevAuto = lastAutoFilledRef.current;
    const nextAuto = { ...prevAuto };

    if (prevAuto.phonetic && cur.phonetic === prevAuto.phonetic) {
      setPhonetic('');
      nextAuto.phonetic = '';
    }
    if (prevAuto.meaning && cur.meaning === prevAuto.meaning) {
      setMeaning('');
      nextAuto.meaning = '';
    }
    if (prevAuto.example && cur.example === prevAuto.example) {
      setExample('');
      nextAuto.example = '';
    }
    if (prevAuto.notes && cur.notes === prevAuto.notes) {
      setNotes('');
      nextAuto.notes = '';
    }

    lastAutoFilledRef.current = nextAuto;
  }, []);

  const applySuggestionFields = useCallback(
    (
      data: {
        phonetic?: string;
        partOfSpeech?: PartOfSpeech;
        meaning?: string;
        example?: string;
        notes?: string;
      },
      forceOverwrite: boolean
    ) => {
      const cur = currentFieldsRef.current;
      const prevAuto = lastAutoFilledRef.current;

      const canReplace = (currentValue: string, previousAutoValue: string) =>
        forceOverwrite ||
        !currentValue.trim() ||
        currentValue === previousAutoValue;

      if (data.partOfSpeech) {
        setPartOfSpeech(data.partOfSpeech);
        setPaintingMotif(getMotifForPos(data.partOfSpeech));
      }

      const nextAuto = { ...prevAuto };
      const nextPhonetic = data.phonetic ?? '';
      const nextMeaning = data.meaning ?? '';
      const nextExample = data.example ?? '';
      const nextNotes = data.notes ?? '';

      if (canReplace(cur.phonetic, prevAuto.phonetic)) {
        setPhonetic(nextPhonetic);
        nextAuto.phonetic = nextPhonetic;
      }

      if (canReplace(cur.meaning, prevAuto.meaning)) {
        setMeaning(nextMeaning);
        nextAuto.meaning = nextMeaning;
        if (nextMeaning.trim()) {
          setFormError(null);
        }
      }

      if (canReplace(cur.example, prevAuto.example)) {
        setExample(nextExample);
        nextAuto.example = nextExample;
      }

      if (canReplace(cur.notes, prevAuto.notes)) {
        setNotes(nextNotes);
        nextAuto.notes = nextNotes;
      }

      lastAutoFilledRef.current = nextAuto;
    },
    [getMotifForPos]
  );

  const performCambridgeLookup = useCallback(
    async (targetWord: string, forceOverwrite: boolean) => {
      const cleaned = targetWord.trim().replace(/\s+/g, ' ');
      if (!cleaned) {
        if (forceOverwrite) {
          setLookupStatus(
            'Vui lòng nhập từ tiếng Anh trước khi tra Cambridge Dictionary.'
          );
        }
        return;
      }

      const isSwitchingWord =
        Boolean(lastLookedUpWordRef.current) &&
        lastLookedUpWordRef.current !== cleaned.toLowerCase();

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const reqId = ++requestIdRef.current;

      setIsLookingUp(true);
      setLookupStatus('Đang lấy dữ liệu từ Cambridge Dictionary...');

      const suggestion: DictionarySuggestion | null =
        await lookupEnglishDictionary(cleaned, controller.signal);

      if (reqId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setIsLookingUp(false);

      if (!suggestion) {
        setSenses([]);
        setAudioUrls({ uk: '', us: '' });
        if (isSwitchingWord) {
          clearPreviousAutoFilledFields();
        }
        lastLookedUpWordRef.current = cleaned.toLowerCase();
        setLookupStatus(
          'Chưa tìm thấy mục từ phù hợp — bạn có thể tự nhập thủ công.'
        );
        return;
      }

      lastLookedUpWordRef.current = cleaned.toLowerCase();
      const returnedSenses = Array.isArray(suggestion.senses)
        ? suggestion.senses
        : [];
      setSenses(returnedSenses);
      setSelectedSenseIdx(0);
      setAudioUrls({
        uk: suggestion.audioUk || '',
        us: suggestion.audioUs || '',
      });

      const fallbackNotes =
        suggestion.notes ||
        (suggestion.englishDefinition
          ? `Cambridge: ${suggestion.englishDefinition}`
          : '');

      applySuggestionFields(
        {
          phonetic: suggestion.phonetic,
          partOfSpeech: suggestion.partOfSpeech,
          meaning: suggestion.meaning,
          example: suggestion.example,
          notes: fallbackNotes,
        },
        forceOverwrite || isSwitchingWord
      );

      setLookupStatus(
        suggestion.source === 'cambridge'
          ? 'Đã tự động điền phiên âm, từ loại, nghĩa tiếng Việt và ví dụ từ Cambridge Dictionary.'
          : 'Đã tự động điền gợi ý từ điển cho từ vựng này.'
      );
    },
    [applySuggestionFields, clearPreviousAutoFilledFields]
  );

  useEffect(() => {
    if (!isOpen || tab !== 'single') return;
    const cleaned = word.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 2) {
      abortControllerRef.current?.abort();
      setIsLookingUp(false);
      setSenses([]);
      setAudioUrls({ uk: '', us: '' });
      setLookupStatus(null);
      if (lastLookedUpWordRef.current) {
        clearPreviousAutoFilledFields();
      }
      lastLookedUpWordRef.current = '';
      return;
    }

    if (cleaned.toLowerCase() === lastLookedUpWordRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void performCambridgeLookup(cleaned, false);
    }, 550);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isOpen,
    tab,
    word,
    performCambridgeLookup,
    clearPreviousAutoFilledFields,
  ]);

  const parsedBulkPreview = useMemo(
    () => parseBulkVocabularyText(bulkText),
    [bulkText]
  );

  if (!isOpen) return null;

  const handleSelectSense = (sense: CambridgeSenseItem, index: number) => {
    setSelectedSenseIdx(index);
    applySuggestionFields(
      {
        phonetic: sense.phonetic || phonetic,
        partOfSpeech: sense.partOfSpeech,
        meaning: sense.meaning,
        example: sense.example,
        notes: sense.notes,
      },
      true
    );
  };

  const handlePlayPronunciation = (accent: PronunciationAccent) => {
    const preferredUrl = accent === 'uk' ? audioUrls.uk : audioUrls.us;
    void playDictionaryPronunciation(word, accent, preferredUrl);
  };

  const handleAutoDictionaryLookup = () => {
    void performCambridgeLookup(word, true);
  };

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      setFormError('Vui lòng nhập đầy đủ Từ tiếng Anh và Nghĩa tiếng Việt.');
      return;
    }
    onSaveSingle(
      {
        word: word.trim(),
        phonetic: phonetic.trim(),
        partOfSpeech,
        meaning: meaning.trim(),
        example: example.trim(),
        notes: notes.trim(),
        paintingMotif,
      },
      editingCard?.id
    );
    onClose();
  };

  const activePreviewArtwork =
    selectableArtworks.find((a) => a.id === paintingMotif) ||
    resolveArtworkForPartOfSpeech(selectableArtworks, partOfSpeech) ||
    selectableArtworks[0];
  const activePosSlotNumber = getPartOfSpeechSlotIndex(partOfSpeech) + 1;

  const handleChangePartOfSpeech = (nextPos: PartOfSpeech) => {
    setPartOfSpeech(nextPos);
    setPaintingMotif(getMotifForPos(nextPos));
  };

  const handleChangeMotif = (selectedId: string) => {
    setPaintingMotif(selectedId);
    const selectedIdx = selectableArtworks.findIndex((a) => a.id === selectedId);
    const pairedPos = getPartOfSpeechForSlotIndex(selectedIdx);
    if (pairedPos) {
      setPartOfSpeech(pairedPos);
    }
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkPreview.length === 0) {
      setFormError(
        'Chưa nhận diện được dòng hợp lệ. Hãy nhập theo mẫu: từ tiếng Anh - nghĩa tiếng Việt - câu ví dụ'
      );
      return;
    }
    onSaveBulk(
      parsedBulkPreview.map((item) => ({
        ...item,
        paintingMotif: getMotifForPos(item.partOfSpeech),
      }))
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="word-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <h2
            id="word-modal-title"
            className="font-serif text-2xl font-semibold text-[var(--text-primary)]"
          >
            {editingCard ? 'Chỉnh sửa thẻ từ vựng' : 'Thêm từ vựng tự học'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!editingCard && (
          <div className="px-6 pt-4">
            <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setTab('single');
                  setFormError(null);
                }}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === 'single'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Thêm từng từ chi tiết
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('bulk');
                  setFormError(null);
                }}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === 'bulk'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Nhập nhanh nhiều dòng
              </button>
            </div>
          </div>
        )}

        {tab === 'single' ? (
          <form onSubmit={handleSubmitSingle} className="p-6 space-y-4">
            {formError && (
              <p className="text-xs font-medium text-[var(--semantic-danger)]">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-7">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="field-word"
                    className="text-xs font-medium text-[var(--text-muted)]"
                  >
                    Từ hoặc cụm từ tiếng Anh *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoDictionaryLookup}
                    disabled={isLookingUp}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isLookingUp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5" />
                    )}
                    <span>Tra từ điển Cambridge</span>
                  </button>
                </div>
                <input
                  id="field-word"
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && word.trim() && !meaning.trim()) {
                      e.preventDefault();
                      void performCambridgeLookup(word, true);
                    }
                  }}
                  placeholder="Ví dụ: beautiful, serene, resilient..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div className="sm:col-span-5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="field-phonetic"
                    className="text-xs font-medium text-[var(--text-muted)]"
                  >
                    Phiên âm IPA (tùy chọn)
                  </label>
                  {word.trim().length > 0 && (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePlayPronunciation('uk')}
                        title="Nghe phát âm Anh - Anh (UK)"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>UK</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePlayPronunciation('us')}
                        title="Nghe phát âm Anh - Mỹ (US)"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>US</span>
                      </button>
                    </div>
                  )}
                </div>
                <input
                  id="field-phonetic"
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder="/ˈbjuː.tɪ.fəl/"
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            {lookupStatus && (
              <p className="text-xs text-[var(--text-muted)]">{lookupStatus}</p>
            )}

            {senses.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Chọn nét nghĩa khác từ Cambridge Dictionary:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {senses.map((sense, idx) => {
                    const isSelected = idx === selectedSenseIdx;
                    return (
                      <button
                        key={`${sense.id}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSense(sense, idx)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs text-left border transition-colors cursor-pointer max-w-full truncate ${
                          isSelected
                            ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text-primary)] font-medium'
                            : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        title={sense.englishDefinition || sense.meaning}
                      >
                        <span className="font-mono text-[11px] text-[var(--accent)] mr-1">
                          {PART_OF_SPEECH_SHORT[sense.partOfSpeech]}
                        </span>
                        <span>
                          {sense.meaning || sense.englishDefinition}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="field-pos"
                    className="block text-xs font-medium text-[var(--text-muted)]"
                  >
                    Từ loại (gắn kết 1–1 với ảnh)
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--accent)]">
                    Ảnh {activePosSlotNumber}
                  </span>
                </div>
                <select
                  id="field-pos"
                  value={partOfSpeech}
                  onChange={(e) =>
                    handleChangePartOfSpeech(e.target.value as PartOfSpeech)
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
                >
                  {ORDERED_PARTS_OF_SPEECH.map((pos, idx) => (
                    <option key={pos} value={pos}>
                      {`Ảnh ${idx + 1} · ${PART_OF_SPEECH_LABELS[pos]}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-7">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="field-motif"
                    className="block text-xs font-medium text-[var(--text-muted)]"
                  >
                    Ảnh / Tranh gắn kết trí nhớ
                  </label>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {PART_OF_SPEECH_EN_TAGS[partOfSpeech]} ↔ Ảnh {activePosSlotNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {activePreviewArtwork && (
                    <div className="w-12 h-10 rounded-xl overflow-hidden border border-[var(--border-subtle)] shrink-0">
                      <ArtworkImage
                        artwork={activePreviewArtwork}
                        alt={activePreviewArtwork.viTitle}
                        className="w-full h-full"
                      />
                    </div>
                  )}
                  <select
                    id="field-motif"
                    value={paintingMotif}
                    onChange={(e) => handleChangeMotif(e.target.value)}
                    className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {selectableArtworks.map((t, idx) => {
                      const posForSlot = getPartOfSpeechForSlotIndex(idx);
                      const prefix = posForSlot
                        ? `Ảnh ${idx + 1} (${PART_OF_SPEECH_EN_TAGS[posForSlot]}) · `
                        : `Ảnh ${idx + 1} · `;
                      return (
                        <option key={t.id} value={t.id}>
                          {prefix}
                          {t.viTitle}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="field-meaning"
                className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
              >
                Nghĩa tiếng Việt *
              </label>
              <input
                id="field-meaning"
                type="text"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="Nhập nghĩa tiếng Việt ngắn gọn, rõ ràng..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="field-example"
                className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
              >
                Câu ví dụ tiếng Anh (giúp nhớ ngữ cảnh lâu hơn)
              </label>
              <textarea
                id="field-example"
                rows={2}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="Ví dụ: Beneath the starry sky, the village remained serene."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="field-notes"
                className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
              >
                Ghi chú cá nhân / Từ đồng nghĩa / Mẹo nhớ
              </label>
              <input
                id="field-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: Đồng nghĩa với peaceful, tranquil..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {editingCard ? 'Lưu thay đổi' : 'Lưu vào kho từ'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitBulk} className="p-6 space-y-4">
            {formError && (
              <p className="text-xs font-medium text-[var(--semantic-danger)]">
                {formError}
              </p>
            )}

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Mỗi dòng một từ theo cấu trúc{' '}
              <span className="font-mono text-[var(--text-primary)]">
                từ tiếng Anh (v/adj/n...) - nghĩa tiếng Việt - câu ví dụ
              </span>
              . Có thể ghi kèm ký hiệu từ loại trong ngoặc đơn để tự động gắn
              đúng bức tranh tương ứng.
            </p>

            <textarea
              rows={7}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`contemplate (v) - chiêm nghiệm sâu sắc - Visitors stood in silence to contemplate the painting.\nluminous (adj) - tỏa sáng lung linh - Van Gogh painted luminous stars above the village.\nresilience (n) - sự kiên cường - Artistic resilience carried him through hardship.`}
              className="w-full px-3.5 py-3 text-sm font-mono rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <span className="font-mono tabular-nums">
                Đã nhận diện: {parsedBulkPreview.length} thẻ hợp lệ
              </span>
              <span className="font-mono">
                Tự động gắn ảnh: verb → Ảnh 1 · adj → Ảnh 2 · noun → Ảnh 3...
              </span>
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Thêm {parsedBulkPreview.length} từ vào kho
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
