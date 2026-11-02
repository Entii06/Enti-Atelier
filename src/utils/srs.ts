import {
  BUILTIN_ARTWORKS,
  getPartOfSpeechSlotIndex,
} from '../constants/themes';
import {
  PartOfSpeech,
  RecallGrade,
  VocabCard,
} from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
export { previewNextIntervalLabel, isCardDue } from './scheduler';

export function formatIntervalDays(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'Trong phiên';
  const minutes = Math.max(1, Math.round(days * 24 * 60));
  if (minutes < 60) return `${minutes} phút`;
  if (days < 1) return `${Number((minutes / 60).toFixed(1))} giờ`;
  if (days === 1) return '1 ngày';
  if (days < 30) return `${Number(days.toFixed(1))} ngày`;
  if (days < 365) {
    const months = Number((days / 30).toFixed(1));
    return `${months} tháng`;
  }
  const years = Number((days / 365).toFixed(1));
  return `${years} năm`;
}

export type CardMaturity = 'new' | 'learning' | 'review' | 'mastered';

export function getCardMaturity(card: VocabCard): CardMaturity {
  if (card.totalReviews === 0) return 'new';
  if (card.fsrs ? card.fsrs.state !== 2 : card.interval === 0 || card.repetitions <= 1) return 'learning';
  if (card.interval >= 21) return 'mastered';
  return 'review';
}

export function getCardMaturityLabel(card: VocabCard): string {
  const m = getCardMaturity(card);
  switch (m) {
    case 'new':
      return 'Từ mới';
    case 'learning':
      return 'Đang học';
    case 'review':
      return 'Đang ôn tập';
    case 'mastered':
      return 'Đã thuộc lòng';
  }
}

export function formatRelativeDue(nextReviewAt: number, now: number = Date.now()): string {
  const diff = nextReviewAt - now;
  if (diff <= 0) return 'Tới hạn ngay';
  const minutes = Math.ceil(diff / (60 * 1000));
  if (minutes < 60) return `Sau ${minutes} phút`;
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  if (hours < 24) return `Sau ${hours} giờ`;
  const days = Math.ceil(diff / DAY_MS);
  if (days === 1) return 'Ngày mai';
  return `Sau ${days} ngày`;
}

export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  verb: 'Động từ (verb)',
  adjective: 'Tính từ (adj)',
  noun: 'Danh từ (noun)',
  adverb: 'Trạng từ (adv)',
  phrase: 'Cụm từ (phrase)',
  idiom: 'Thành ngữ (idiom)',
  phrasal_verb: 'Cụm động từ (phr. verb)',
  preposition: 'Giới từ (prep)',
  conjunction: 'Liên từ (conj)',
  pronoun: 'Đại từ (pron)',
  determiner: 'Từ hạn định (det)',
  interjection: 'Thán từ (interj)',
};

export const PART_OF_SPEECH_SHORT: Record<PartOfSpeech, string> = {
  verb: 'v.',
  adjective: 'adj.',
  noun: 'n.',
  adverb: 'adv.',
  phrase: 'phr.',
  idiom: 'idiom',
  phrasal_verb: 'phr. v.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  determiner: 'det.',
  interjection: 'interj.',
};

export const PART_OF_SPEECH_EN_TAGS: Record<PartOfSpeech, string> = {
  verb: 'verb',
  adjective: 'adj',
  noun: 'noun',
  adverb: 'adv',
  phrase: 'phrase',
  idiom: 'idiom',
  phrasal_verb: 'phr. verb',
  preposition: 'prep',
  conjunction: 'conj',
  pronoun: 'pron',
  determiner: 'det',
  interjection: 'interj',
};

export function normalizePartOfSpeechInput(
  raw: unknown,
  fallbackWord = ''
): PartOfSpeech {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.+$/g, '');

  if (
    s === 'phrasal_verb' ||
    s === 'phrasal verb' ||
    s === 'phr verb' ||
    s === 'phr. v' ||
    s === 'phr v' ||
    s === 'pv'
  ) {
    return 'phrasal_verb';
  }
  if (s === 'verb' || s === 'v') return 'verb';
  if (s === 'adjective' || s === 'adj' || s === 'a') return 'adjective';
  if (s === 'noun' || s === 'n') return 'noun';
  if (s === 'adverb' || s === 'adv') return 'adverb';
  if (s === 'idiom' || s === 'id' || s === 'proverb') return 'idiom';
  if (s === 'phrase' || s === 'phr' || s === 'collocation') return 'phrase';
  if (s === 'preposition' || s === 'prep') return 'preposition';
  if (s === 'conjunction' || s === 'conj') return 'conjunction';
  if (s === 'pronoun' || s === 'pron') return 'pronoun';
  if (s === 'determiner' || s === 'det' || s === 'article') return 'determiner';
  if (
    s === 'interjection' ||
    s === 'interj' ||
    s === 'exclamation' ||
    s === 'excl'
  ) {
    return 'interjection';
  }

  const cleanWord = fallbackWord.trim();
  if (/^to\s+[a-z]/i.test(cleanWord)) return 'verb';
  const tokens = cleanWord.toLowerCase().split(/\s+/).filter(Boolean);
  if (
    tokens.length >= 2 &&
    tokens.length <= 3 &&
    tokens[0] !== 'be' &&
    /^(up|down|in|out|on|off|away|back|over|through|into|after|apart|aside|along|around|forward|across|ahead)$/.test(
      tokens[tokens.length - 1]
    )
  ) {
    return 'phrasal_verb';
  }
  if (cleanWord.includes(' ')) return 'phrase';
  return 'noun';
}

export interface CambridgeSenseItem {
  id: number;
  partOfSpeech: PartOfSpeech;
  phonetic: string;
  meaning: string;
  englishDefinition: string;
  example: string;
  notes: string;
}

export interface DictionarySuggestion {
  word?: string;
  source?: 'cambridge' | 'dictionary_fallback';
  phonetic: string;
  phoneticUk?: string;
  phoneticUs?: string;
  audioUk?: string;
  audioUs?: string;
  partOfSpeech?: PartOfSpeech;
  meaning?: string;
  example?: string;
  englishDefinition?: string;
  notes?: string;
  senses?: CambridgeSenseItem[];
}

export async function lookupEnglishDictionary(
  rawWord: string,
  signal?: AbortSignal
): Promise<DictionarySuggestion | null> {
  const clean = rawWord.trim().replace(/\s+/g, ' ');
  if (!clean) return null;

  try {
    const cambridgeRes = await fetch(
      `/api/dictionary/cambridge?word=${encodeURIComponent(clean)}`,
      { signal }
    );
    if (cambridgeRes.ok) {
      const payload = (await cambridgeRes.json()) as DictionarySuggestion;
      if (payload && (payload.meaning || payload.phonetic || payload.example)) {
        const resolvedWord = (payload.word || clean).trim();
        const encodedWord = encodeURIComponent(resolvedWord);
        return {
          ...payload,
          audioUk:
            payload.audioUk && payload.audioUk.startsWith('/api/dictionary/audio')
              ? payload.audioUk
              : `/api/dictionary/audio?word=${encodedWord}&accent=uk`,
          audioUs:
            payload.audioUs && payload.audioUs.startsWith('/api/dictionary/audio')
              ? payload.audioUs
              : `/api/dictionary/audio?word=${encodedWord}&accent=us`,
        };
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return null;
    }
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        clean.toLowerCase()
      )}`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    let phonetic: string = entry.phonetic || '';
    if (!phonetic && Array.isArray(entry.phonetics)) {
      const found = entry.phonetics.find(
        (p: { text?: string }) =>
          typeof p?.text === 'string' && p.text.trim().length > 0
      );
      if (found) phonetic = found.text;
    }

    let partOfSpeech: PartOfSpeech | undefined;
    let example: string | undefined;
    let englishDefinition: string | undefined;

    if (Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        const rawPos = String(m.partOfSpeech || '').toLowerCase();
        if (!partOfSpeech && rawPos) {
          partOfSpeech = normalizePartOfSpeechInput(rawPos, clean);
        }
        if (Array.isArray(m.definitions)) {
          for (const d of m.definitions) {
            if (!englishDefinition && typeof d.definition === 'string') {
              englishDefinition = d.definition;
            }
            if (!example && typeof d.example === 'string' && d.example.trim()) {
              example = d.example.trim();
            }
          }
        }
      }
    }

    const encodedFallbackWord = encodeURIComponent(clean);
    return {
      source: 'dictionary_fallback',
      phonetic,
      audioUk: `/api/dictionary/audio?word=${encodedFallbackWord}&accent=uk`,
      audioUs: `/api/dictionary/audio?word=${encodedFallbackWord}&accent=us`,
      partOfSpeech,
      example,
      englishDefinition,
      notes: englishDefinition ? `Định nghĩa: ${englishDefinition}` : undefined,
    };
  } catch {
    return null;
  }
}

export interface ParsedBulkItem {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: PartOfSpeech;
}

export function parseBulkVocabularyText(text: string): ParsedBulkItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedBulkItem[] = [];
  for (const line of lines) {
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim());
    } else if (line.includes('|')) {
      parts = line.split('|').map((p) => p.trim());
    } else if (line.includes(' - ')) {
      parts = line.split(' - ').map((p) => p.trim());
    } else if (line.includes(':')) {
      parts = line.split(':').map((p) => p.trim());
    }

    if (parts.length >= 2 && parts[0] && parts[1]) {
      let cleanWord = parts[0];
      let detectedPos: PartOfSpeech | null = null;

      const posSuffixMatch = cleanWord.match(
        /^(.+?)\s*\(([a-zA-Z.\s_]+)\)\s*$/
      );
      if (posSuffixMatch?.[1] && posSuffixMatch?.[2]) {
        cleanWord = posSuffixMatch[1].trim();
        detectedPos = normalizePartOfSpeechInput(posSuffixMatch[2], cleanWord);
      }

      items.push({
        word: cleanWord,
        meaning: parts[1],
        example: parts[2] || '',
        partOfSpeech:
          detectedPos || normalizePartOfSpeechInput('', cleanWord),
      });
    }
  }
  return items;
}

export function createStarterDeck(now: number = Date.now()): VocabCard[] {

  const seeds: Array<{
    word: string;
    phonetic: string;
    partOfSpeech: PartOfSpeech;
    meaning: string;
    example: string;
    notes: string;
    dueOffsetDays: number;
    repetitions: number;
    interval: number;
    easeFactor: number;
    totalReviews: number;
  }> = [
    {
      word: 'luminous',
      phonetic: '/ˈluː.mɪ.nəs/',
      partOfSpeech: 'adjective',
      meaning: 'tỏa sáng rực rỡ, lung linh trong bóng tối',
      example:
        'Van Gogh painted luminous stars swirling above the quiet village of Saint-Rémy.',
      notes: 'Gốc Latin "lumen" (ánh sáng). Liên tưởng bầu trời Đêm Đầy Sao.',
      dueOffsetDays: -0.2,
      repetitions: 1,
      interval: 1,
      easeFactor: 2.5,
      totalReviews: 1,
    },
    {
      word: 'ephemeral',
      phonetic: '/ɪˈfem.ər.əl/',
      partOfSpeech: 'adjective',
      meaning: 'mong manh, chóng tàn, chỉ kéo dài trong chốc lát',
      example:
        'Spring almond blossoms are ephemeral, blooming brightly for only a few weeks.',
      notes: 'Trái nghĩa: enduring, eternal. Gợi nhớ cánh hoa hạnh nhân đầu xuân.',
      dueOffsetDays: -0.1,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      totalReviews: 0,
    },
    {
      word: 'resilience',
      phonetic: '/rɪˈzɪl.jəns/',
      partOfSpeech: 'noun',
      meaning: 'sự kiên cường, khả năng phục hồi sau nghịch cảnh',
      example:
        'Through his letters to Theo, we witness extraordinary artistic resilience.',
      notes: 'Collocation: build / show resilience.',
      dueOffsetDays: 0,
      repetitions: 2,
      interval: 6,
      easeFactor: 2.6,
      totalReviews: 3,
    },
    {
      word: 'contemplate',
      phonetic: '/ˈkɒn.təm.pleɪt/',
      partOfSpeech: 'verb',
      meaning: 'chiêm nghiệm, ngắm nhìn và suy ngẫm sâu sắc',
      example:
        'Visitors stood in silence to contemplate the thick brushstrokes on the canvas.',
      notes: 'Danh từ: contemplation (sự chiêm nghiệm).',
      dueOffsetDays: 0,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      totalReviews: 0,
    },
    {
      word: 'vivid',
      phonetic: '/ˈvɪv.ɪd/',
      partOfSpeech: 'adjective',
      meaning: 'sống động, sắc nét, rực rỡ (màu sắc hoặc ký ức)',
      example:
        'The vivid chrome yellow of the sunflowers captures the warmth of southern France.',
      notes: 'Vivid memory (ký ức sống động) · vivid imagination.',
      dueOffsetDays: 0,
      repetitions: 1,
      interval: 1,
      easeFactor: 2.5,
      totalReviews: 1,
    },
    {
      word: 'serene',
      phonetic: '/səˈriːn/',
      partOfSpeech: 'adjective',
      meaning: 'thanh bình, tĩnh lặng, thư thái',
      example:
        'Beneath the swirling sky, the distant hills appear remarkably serene.',
      notes: 'Danh từ: serenity (sự thanh tịnh).',
      dueOffsetDays: 1,
      repetitions: 2,
      interval: 6,
      easeFactor: 2.55,
      totalReviews: 2,
    },
    {
      word: 'immerse',
      phonetic: '/ɪˈmɜːs/',
      partOfSpeech: 'verb',
      meaning: 'đắm chìm, tập trung hoàn toàn vào việc gì',
      example:
        'She decided to immerse herself in English literature for twenty-five minutes.',
      notes: 'Cấu trúc: immerse oneself in something.',
      dueOffsetDays: 3,
      repetitions: 3,
      interval: 15,
      easeFactor: 2.65,
      totalReviews: 4,
    },
    {
      word: 'masterpiece',
      phonetic: '/ˈmɑː.stə.piːs/',
      partOfSpeech: 'noun',
      meaning: 'kiệt tác, tác phẩm xuất sắc nhất',
      example:
        'Every daily study session is a small brushstroke toward your own masterpiece.',
      notes: 'Từ ghép: master + piece.',
      dueOffsetDays: 5,
      repetitions: 4,
      interval: 24,
      easeFactor: 2.7,
      totalReviews: 5,
    },
  ];

  return seeds.map((s, idx) => ({
    id: `seed-${idx + 1}`,
    word: s.word,
    phonetic: s.phonetic,
    partOfSpeech: s.partOfSpeech,
    meaning: s.meaning,
    example: s.example,
    notes: s.notes,
    paintingMotif:
      BUILTIN_ARTWORKS[getPartOfSpeechSlotIndex(s.partOfSpeech)]?.id ||
      BUILTIN_ARTWORKS[0]?.id ||
      '',
    repetitions: s.repetitions,
    easeFactor: s.easeFactor,
    interval: s.interval,
    nextReviewAt: now + Math.round(s.dueOffsetDays * DAY_MS),
    lastReviewedAt: s.totalReviews > 0 ? now - 2 * DAY_MS : null,
    totalReviews: s.totalReviews,
    lapses: 0,
    createdAt: now - (seeds.length - idx) * DAY_MS,
  }));
}
