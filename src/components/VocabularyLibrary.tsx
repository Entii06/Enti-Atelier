import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Volume2,
  Pencil,
  Trash2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  ORDERED_PARTS_OF_SPEECH,
  resolveArtworkForPartOfSpeech,
} from '../constants/themes';
import { ArtworkItem, PartOfSpeech, VocabCard } from '../types';
import { speakEnglish } from '../utils/audio';
import {
  CardMaturity,
  formatIntervalDays,
  formatRelativeDue,
  getCardMaturity,
  getCardMaturityLabel,
  isCardDue,
  normalizePartOfSpeechInput,
  PART_OF_SPEECH_LABELS,
  PART_OF_SPEECH_SHORT,
} from '../utils/srs';
import { ArtworkImage } from './ArtworkImage';
import {
  CUTOUT_VIVID_CLASS,
  STARRY_CUTOUTS,
  StarryHeaderAccent,
} from './StarryCutoutAccents';

interface VocabularyLibraryProps {
  cards: VocabCard[];
  artworks: ArtworkItem[];
  onOpenAddModal: () => void;
  onOpenBulkModal: () => void;
  onEditCard: (card: VocabCard) => void;
  onDeleteCard: (cardId: string) => void;
  onResetCardProgress: (cardId: string) => void;
  onImportCardsJson: (imported: VocabCard[]) => void;
}

type FilterStatus = 'all' | 'due' | CardMaturity;
type SortKey = 'due_asc' | 'word_asc' | 'newest';

export const VocabularyLibrary: React.FC<VocabularyLibraryProps> = ({
  cards,
  artworks,
  onOpenAddModal,
  onOpenBulkModal,
  onEditCard,
  onDeleteCard,
  onResetCardProgress,
  onImportCardsJson,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [posFilter, setPosFilter] = useState<'all' | PartOfSpeech>('all');
  const [sortKey, setSortKey] = useState<SortKey>('due_asc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const now = Date.now();

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards
      .filter((c) => {
        if (filter === 'due' && !isCardDue(c, now)) return false;
        if (
          filter !== 'all' &&
          filter !== 'due' &&
          getCardMaturity(c) !== filter
        ) {
          return false;
        }
        if (posFilter !== 'all') {
          const cardPos = normalizePartOfSpeechInput(c.partOfSpeech, c.word);
          if (cardPos !== posFilter) return false;
        }
        if (!q) return true;
        return (
          c.word.toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q) ||
          c.example.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortKey === 'due_asc') return a.nextReviewAt - b.nextReviewAt;
        if (sortKey === 'word_asc') return a.word.localeCompare(b.word);
        return b.createdAt - a.createdAt;
      });
  }, [cards, searchQuery, filter, posFilter, sortKey, now]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          setImportNotice('Tệp JSON không hợp lệ: cần một mảng danh sách từ.');
          return;
        }
        const valid: VocabCard[] = parsed
          .filter(
            (item) =>
              item &&
              typeof item.word === 'string' &&
              typeof item.meaning === 'string'
          )
          .map((item, idx) => {
            const cleanWord = String(item.word).trim();
            const normalizedPos = normalizePartOfSpeechInput(
              item.partOfSpeech,
              cleanWord
            );
            const syncedMotif =
              resolveArtworkForPartOfSpeech(artworks, normalizedPos)?.id ||
              artworks[0]?.id ||
              '';
            return {
              id:
                typeof item.id === 'string' && item.id
                  ? item.id
                  : `imp-${Date.now()}-${idx}`,
              word: cleanWord,
              phonetic: typeof item.phonetic === 'string' ? item.phonetic : '',
              partOfSpeech: normalizedPos,
              meaning: String(item.meaning).trim(),
              example: typeof item.example === 'string' ? item.example : '',
              notes: typeof item.notes === 'string' ? item.notes : '',
              paintingMotif: syncedMotif,
              fsrs: item.fsrs,
              repetitions:
                typeof item.repetitions === 'number' ? item.repetitions : 0,
              easeFactor:
                typeof item.easeFactor === 'number' ? item.easeFactor : 2.5,
              interval: typeof item.interval === 'number' ? item.interval : 0,
              nextReviewAt:
                typeof item.nextReviewAt === 'number'
                  ? item.nextReviewAt
                  : Date.now(),
              lastReviewedAt:
                typeof item.lastReviewedAt === 'number'
                  ? item.lastReviewedAt
                  : null,
              totalReviews:
                typeof item.totalReviews === 'number' ? item.totalReviews : 0,
              lapses: typeof item.lapses === 'number' ? item.lapses : 0,
              createdAt:
                typeof item.createdAt === 'number'
                  ? item.createdAt
                  : Date.now(),
            };
          });

        onImportCardsJson(valid);
        setImportNotice(`Đã nhập thành công ${valid.length} thẻ từ vựng.`);
      } catch {
        setImportNotice('Không thể đọc tệp JSON. Vui lòng kiểm tra định dạng.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-6 flex-1 min-w-0 flex-wrap">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
              Kho từ vựng cá nhân
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-2xl">
              Tự xây dựng danh mục từ tiếng Anh của riêng bạn, chỉnh sửa ngữ cảnh
              và theo dõi chu kỳ nhớ FSRS.
            </p>
          </div>

          <StarryHeaderAccent variant="vocabulary" className="flex" />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm từ mới</span>
          </button>

          <button
            type="button"
            onClick={onOpenBulkModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nhập nhanh nhiều từ
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nhập JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {importNotice && (
        <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] flex items-center justify-between gap-4 text-sm text-[var(--text-primary)]">
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm từ tiếng Anh, nghĩa tiếng Việt, câu ví dụ..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-x-auto">
            {(
              [
                ['all', 'Tất cả'],
                ['due', 'Tới hạn'],
                ['new', 'Từ mới'],
                ['learning', 'Đang học'],
                ['mastered', 'Đã thuộc'],
              ] as Array<[FilterStatus, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === key
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            aria-label="Lọc theo từ loại"
            value={posFilter}
            onChange={(e) =>
              setPosFilter(e.target.value as 'all' | PartOfSpeech)
            }
            className="px-3 py-2 text-xs font-medium rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] cursor-pointer"
          >
            <option value="all">Từ loại: Tất cả</option>
            {ORDERED_PARTS_OF_SPEECH.map((pos) => (
              <option key={pos} value={pos}>
                {PART_OF_SPEECH_LABELS[pos]}
              </option>
            ))}
          </select>

          <select
            aria-label="Sắp xếp danh sách từ"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] cursor-pointer"
          >
            <option value="due_asc">Sắp xếp: Tới hạn sớm nhất</option>
            <option value="newest">Sắp xếp: Mới thêm gần đây</option>
            <option value="word_asc">Sắp xếp: Bảng chữ cái A–Z</option>
          </select>
        </div>
      </div>

      <div className="relative rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] overflow-hidden">
        {filteredCards.length === 0 ? (
          <div className="p-12 text-center">
            <img
              src={STARRY_CUTOUTS.starryCloud}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              decoding="async"
              className={`h-24 w-auto mx-auto mb-4 object-contain opacity-100 pointer-events-none select-none ${CUTOUT_VIVID_CLASS}`}
            />
            <p className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
              Không tìm thấy thẻ từ phù hợp
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1.5">
              Hãy thử đổi bộ lọc hoặc thêm từ tiếng Anh mới vào bộ sưu tập của
              bạn.
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm từ mới</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredCards.map((card) => {
              const dueNow = isCardDue(card, now);
              const cardPos = normalizePartOfSpeechInput(
                card.partOfSpeech,
                card.word
              );
              const linkedArtwork = resolveArtworkForPartOfSpeech(
                artworks,
                cardPos
              );
              return (
                <div
                  key={card.id}
                  className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-[var(--bg-elevated)]/45 transition-colors"
                >
                  <div className="flex items-start gap-5 sm:gap-6 min-w-0 flex-1">
                    {linkedArtwork && (
                      <div className="hidden sm:block relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shrink-0 mt-0.5">
                        <ArtworkImage
                          artwork={linkedArtwork}
                          className="w-full h-full"
                        />
                      </div>
                    )}

                    <div className="space-y-2.5 min-w-0 flex-1">
                      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1.5">
                        <button
                          type="button"
                          onClick={() => speakEnglish(card.word)}
                          title="Nghe phát âm"
                          className="inline-flex items-center gap-2 text-left group cursor-pointer"
                        >
                          <span className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                            {card.word}
                          </span>
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0" />
                        </button>

                        <span className="text-sm sm:text-base text-[var(--text-muted)] font-mono">
                          {PART_OF_SPEECH_SHORT[cardPos]}
                          {card.phonetic ? ` · ${card.phonetic}` : ''}
                        </span>
                      </div>

                      <p className="text-lg sm:text-xl font-medium text-[var(--text-primary)] leading-snug">
                        {card.meaning}
                      </p>

                      {card.example && (
                        <p className="font-serif italic text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                          “{card.example}”
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-6 shrink-0">
                    <div className="text-sm font-mono tabular-nums text-[var(--text-muted)] lg:text-right space-y-1">
                      <p>
                        {getCardMaturityLabel(card)} · Chu kỳ{' '}
                        {formatIntervalDays(card.interval)}
                      </p>
                      <p
                        className={
                          dueNow
                            ? 'text-[var(--accent)] font-semibold'
                            : 'text-[var(--text-muted)]'
                        }
                      >
                        {formatRelativeDue(card.nextReviewAt, now)} · FSRS{card.fsrs ? ` · Độ bền nhớ ${card.fsrs.stability.toFixed(1)} ngày` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditCard(card)}
                        aria-label={`Chỉnh sửa từ ${card.word}`}
                        title="Chỉnh sửa"
                        className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onResetCardProgress(card.id)}
                        aria-label={`Đặt lại tiến độ học từ ${card.word}`}
                        title="Đặt lại tiến độ FSRS"
                        className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      {confirmDeleteId === card.id ? (
                        <div className="inline-flex items-center gap-1.5 pl-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCard(card.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-[var(--semantic-danger)] text-white whitespace-nowrap cursor-pointer"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(card.id)}
                          aria-label={`Xóa từ ${card.word}`}
                          title="Xóa thẻ từ"
                          className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--semantic-danger)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
