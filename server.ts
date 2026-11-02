import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';

type BasePaletteKey =
  | 'starry_night'
  | 'sunflowers'
  | 'almond_blossom'
  | 'cafe_terrace';

interface ManifestArtwork {
  id: string;
  viTitle: string;
  originalTitle: string;
  locationYear: string;
  medium: string;
  accessionCode: string;
  quoteVi: string;
  quoteSource: string;
  imageSrc: string;
  imageScaleClass: string;
  fallbackBgClass: string;
  isDark: boolean;
  paletteKey: BasePaletteKey;
  isCustom?: boolean;
}

interface DefaultArtworksManifest {
  replaceBuiltins: boolean;
  artworks: ManifestArtwork[];
  defaultThemeId: string;
  updatedAt: number;
}

const __dirname = process.env.VERCEL ? process.cwd() : path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const publicDefaultDir = path.resolve(__dirname, 'public/default-artworks');
const distDir = path.resolve(__dirname, 'dist');
const distDefaultDir = path.resolve(distDir, 'default-artworks');

const EMPTY_MANIFEST: DefaultArtworksManifest = {
  replaceBuiltins: false,
  artworks: [],
  defaultThemeId: '',
  updatedAt: 0,
};

function readManifestFromDisk(): DefaultArtworksManifest {
  const candidates = [
    path.join(publicDefaultDir, 'manifest.json'),
    path.join(distDefaultDir, 'manifest.json'),
  ];

  let fallbackCandidate: DefaultArtworksManifest | null = null;

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DefaultArtworksManifest>;
        const normalized: DefaultArtworksManifest = {
          replaceBuiltins: Boolean(parsed.replaceBuiltins),
          artworks: Array.isArray(parsed.artworks) ? parsed.artworks : [],
          defaultThemeId:
            typeof parsed.defaultThemeId === 'string'
              ? parsed.defaultThemeId
              : '',
          updatedAt:
            typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
        if (normalized.artworks.length > 0) {
          return normalized;
        }
        if (!fallbackCandidate) {
          fallbackCandidate = normalized;
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return fallbackCandidate || EMPTY_MANIFEST;
}

function doesArtworkAssetExistOnDisk(imageSrc: string): boolean {
  if (!imageSrc || typeof imageSrc !== 'string') return false;
  const trimmed = imageSrc.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return true;
  }

  if (trimmed.startsWith('/default-artworks/')) {
    const fileName = path.basename(trimmed);
    if (!fileName) return false;
    return (
      fs.existsSync(path.join(publicDefaultDir, fileName)) ||
      fs.existsSync(path.join(distDefaultDir, fileName))
    );
  }

  if (trimmed.startsWith('/')) {
    const cleanRel = trimmed.replace(/^\/+/, '');
    return (
      fs.existsSync(path.resolve(__dirname, 'public', cleanRel)) ||
      fs.existsSync(path.resolve(distDir, cleanRel)) ||
      fs.existsSync(path.resolve(__dirname, cleanRel))
    );
  }

  return true;
}

function getMissingArtworkFileIds(artworks: ManifestArtwork[]): string[] {
  return artworks
    .filter((art) => !doesArtworkAssetExistOnDisk(art.imageSrc))
    .map((art) => art.id);
}

function getExtensionFromMimeSubtype(subtype: string): string {
  const normalized = subtype.toLowerCase();
  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  if (normalized === 'gif') return 'gif';
  if (normalized === 'svg+xml') return 'svg';
  return 'jpg';
}

function sanitizeFileStem(id: string, fallbackIndex: number): string {
  const cleaned = String(id || `artwork_${fallbackIndex}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  return cleaned || `artwork_${fallbackIndex}`;
}

function cleanupUnreferencedFiles(
  directory: string,
  referencedFileNames: Set<string>
): void {
  if (!fs.existsSync(directory)) return;
  try {
    const entries = fs.readdirSync(directory);
    for (const entry of entries) {
      if (entry === 'manifest.json') continue;
      if (!referencedFileNames.has(entry)) {
        const fullPath = path.join(directory, entry);
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  } catch {
    // Ignore file cleanup errors
  }
}

type NormalizedPartOfSpeech =
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

interface CambridgeSensePayload {
  id: number;
  partOfSpeech: NormalizedPartOfSpeech;
  phonetic: string;
  meaning: string;
  englishDefinition: string;
  example: string;
  notes: string;
}

interface CambridgeLookupPayload {
  word: string;
  source: 'cambridge' | 'dictionary_fallback';
  phonetic: string;
  phoneticUk: string;
  phoneticUs: string;
  audioUk: string;
  audioUs: string;
  partOfSpeech: NormalizedPartOfSpeech;
  meaning: string;
  englishDefinition: string;
  example: string;
  notes: string;
  senses: CambridgeSensePayload[];
}

interface RawCambridgeApiData {
  word?: string;
  pos?: string[];
  verbs?: Array<{ id?: number; type?: string; text?: string }>;
  pronunciation?: Array<{
    pos?: string;
    lang?: string;
    url?: string;
    pron?: string;
  }>;
  definition?: Array<{
    id?: number;
    pos?: string;
    source?: string;
    text?: string;
    translation?: string;
    example?: Array<{ id?: number; text?: string; translation?: string }>;
  }>;
}

interface GtxTranslateResponse {
  sentences?: Array<{ trans?: string; orig?: string }>;
  dict?: Array<{
    pos?: string;
    terms?: string[];
    entry?: Array<{ word?: string; reverse_translation?: string[] }>;
  }>;
}

interface ParsedTracauEv {
  byPos: Record<string, string[]>;
  allMeanings: Array<{ pos: NormalizedPartOfSpeech; text: string }>;
  englishDefinitions: Array<{
    pos: NormalizedPartOfSpeech;
    text: string;
    example: string;
  }>;
  examples: string[];
  phonetic: string;
  synonyms: string[];
  seeAlsoTarget: string;
  isIdiom: boolean;
}

const CAMBRIDGE_CACHE_TTL_MS = 30 * 60 * 1000;
const cambridgeLookupCache = new Map<
  string,
  { data: CambridgeLookupPayload; expiresAt: number }
>();

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');
}

function normalizeComparablePhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,;:'"“”!?.\-()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PHRASAL_PARTICLES = new Set([
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'away',
  'back',
  'over',
  'through',
  'into',
  'after',
  'for',
  'with',
  'about',
  'around',
  'along',
  'apart',
  'aside',
  'by',
  'forward',
  'across',
  'ahead',
]);

function isLikelyPhrasalVerbQuery(rawWord: string): boolean {
  const tokens = rawWord
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2 || tokens.length > 3) return false;
  if (tokens[0] === 'to' || tokens[0] === 'be') return false;
  return PHRASAL_PARTICLES.has(tokens[tokens.length - 1]);
}

function normalizePos(
  rawPos: string | undefined,
  rawWord: string
): NormalizedPartOfSpeech {
  const lower = String(rawPos || '')
    .trim()
    .toLowerCase();
  if (
    lower.includes('idiom') ||
    lower.includes('proverb') ||
    lower.includes('saying')
  ) {
    return 'idiom';
  }
  if (lower.includes('phrasal')) return 'phrasal_verb';
  if (lower.includes('preposition') || lower === 'prep' || lower === 'prep.') {
    return 'preposition';
  }
  if (lower.includes('conjunction') || lower === 'conj' || lower === 'conj.') {
    return 'conjunction';
  }
  if (lower.includes('pronoun') || lower === 'pron' || lower === 'pron.') {
    return 'pronoun';
  }
  if (
    lower.includes('determiner') ||
    lower.includes('article') ||
    lower === 'det' ||
    lower === 'det.'
  ) {
    return 'determiner';
  }
  if (
    lower.includes('interjection') ||
    lower.includes('exclamation') ||
    lower === 'interj' ||
    lower === 'interj.'
  ) {
    return 'interjection';
  }
  if (lower.includes('phrase') || lower.includes('collocation')) {
    return 'phrase';
  }
  if (lower === 'noun' || lower.startsWith('noun')) return 'noun';
  if (
    lower === 'verb' ||
    lower.startsWith('verb') ||
    lower.includes('modal verb') ||
    lower.includes('auxiliary verb')
  ) {
    if (isLikelyPhrasalVerbQuery(rawWord)) {
      return 'phrasal_verb';
    }
    return 'verb';
  }
  if (lower === 'adjective' || lower.startsWith('adj')) return 'adjective';
  if (lower === 'adverb' || lower.startsWith('adv')) return 'adverb';
  if (isLikelyPhrasalVerbQuery(rawWord)) return 'phrasal_verb';
  if (rawWord.trim().includes(' ')) return 'phrase';
  return 'noun';
}

function pickBestExampleSentence(
  examples: Array<{ text?: string }> | undefined
): string {
  if (!Array.isArray(examples) || examples.length === 0) return '';
  const cleaned = examples
    .map((e) =>
      String(e?.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .normalize('NFC')
    )
    .filter((t) => t.length > 0);
  if (cleaned.length === 0) return '';

  const fullSentence = cleaned.find(
    (t) => /[.!?]["'”]?$/.test(t) && t.split(' ').length >= 4
  );
  if (fullSentence) return fullSentence;

  const capitalizedClause = cleaned.find(
    (t) => /^[A-Z]/.test(t) && t.split(' ').length >= 4
  );
  return capitalizedClause || cleaned[0];
}

function parseTracauFulltext(fulltext: string, queryWord: string): ParsedTracauEv {
  const parsed: ParsedTracauEv = {
    byPos: {},
    allMeanings: [],
    englishDefinitions: [],
    examples: [],
    phonetic: '',
    synonyms: [],
    seeAlsoTarget: '',
    isIdiom: false,
  };
  if (!fulltext) return parsed;

  const normalizedQuery = normalizeComparablePhrase(queryWord);

  const synMatch = fulltext.match(/var\s+tcGT\s*=\s*(\{[\s\S]*?\});/i);
  if (synMatch?.[1]) {
    try {
      const synJson = JSON.parse(synMatch[1]) as {
        children?: Array<{
          children?: Array<{ name?: string; type?: number }>;
          name?: string;
          type?: number;
        }>;
      };
      const collected: string[] = [];
      for (const group of synJson.children || []) {
        if (group?.type === 2 && typeof group.name === 'string') {
          const directCand = group.name.trim();
          if (
            directCand &&
            /^[a-z][a-z\s'-]{1,28}$/i.test(directCand) &&
            directCand.toLowerCase() !== queryWord.toLowerCase() &&
            !collected.includes(directCand)
          ) {
            collected.push(directCand);
          }
        }
        for (const item of group.children || []) {
          const candidate = String(item?.name || '').trim();
          if (
            item?.type === 2 &&
            candidate &&
            /^[a-z][a-z\s-]{1,24}$/.test(candidate) &&
            candidate.toLowerCase() !== queryWord.toLowerCase() &&
            !collected.includes(candidate)
          ) {
            collected.push(candidate);
          }
          if (collected.length >= 4) break;
        }
        if (collected.length >= 4) break;
      }
      parsed.synonyms = collected;
    } catch {
      // Ignore malformed synonym script
    }
  }

  const evMatch = fulltext.match(/<article id="dict_ev"[\s\S]*?<\/article>/i);
  if (evMatch) {
    const block = evMatch[0];
    const rows = block.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    let currentPos: NormalizedPartOfSpeech = queryWord.includes(' ')
      ? 'phrase'
      : 'noun';

    for (const row of rows) {
      const idMatch = row.match(/<tr[^>]*\bid="([^"]+)"/i);
      const rowId = (idMatch?.[1] || '').toLowerCase();
      const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || [])
        .map(stripHtmlTags)
        .filter(Boolean);
      const lastText = cells[cells.length - 1] || '';
      if (!lastText) continue;

      if (
        (rowId === 'pa' || rowId === 'pak') &&
        !parsed.phonetic &&
        lastText.startsWith('[')
      ) {
        const inner = lastText.replace(/^\[|\]$/g, '').trim();
        if (
          inner &&
          inner.toLowerCase() !== queryWord.toLowerCase() &&
          normalizeComparablePhrase(inner) !== normalizedQuery
        ) {
          parsed.phonetic = `/${inner}/`;
        }
      } else if (rowId === 'tl' || rowId === 'tl_ss') {
        const lower = lastText.replace(/^\*\s*/, '').toLowerCase();
        if (
          lower.includes('thành ngữ') ||
          lower.includes('tục ngữ') ||
          lower.includes('ngạn ngữ') ||
          lower.includes('idiom') ||
          lower.includes('proverb') ||
          lower.includes('saying')
        ) {
          currentPos = 'idiom';
          parsed.isIdiom = true;
        } else if (
          lower.includes('cụm động từ') ||
          lower.includes('phrasal verb')
        ) {
          currentPos = 'phrasal_verb';
        } else if (lower.includes('giới từ') || lower.startsWith('prep')) {
          currentPos = 'preposition';
        } else if (lower.includes('liên từ') || lower.startsWith('conj')) {
          currentPos = 'conjunction';
        } else if (lower.includes('đại từ') || lower.startsWith('pron')) {
          currentPos = 'pronoun';
        } else if (
          lower.includes('mạo từ') ||
          lower.includes('từ hạn định') ||
          lower.startsWith('det')
        ) {
          currentPos = 'determiner';
        } else if (
          lower.includes('thán từ') ||
          lower.includes('cảm thán') ||
          lower.startsWith('interj') ||
          lower.startsWith('excl')
        ) {
          currentPos = 'interjection';
        } else if (lower.includes('danh từ') || lower === 'noun') {
          currentPos = 'noun';
        } else if (lower.includes('động từ') || lower === 'verb') {
          currentPos = isLikelyPhrasalVerbQuery(queryWord)
            ? 'phrasal_verb'
            : 'verb';
        } else if (lower.includes('tính từ') || lower.startsWith('adj')) {
          currentPos = 'adjective';
        } else if (
          lower.includes('phó từ') ||
          lower.includes('trạng từ') ||
          lower.startsWith('adv')
        ) {
          currentPos = 'adverb';
        } else {
          currentPos = 'phrase';
        }
      } else if (rowId === 'mn' || rowId === 'tn_n') {
        const cleaned = lastText.replace(/^[■•\-*]+\s*/, '').trim();
        const seeMatch = cleaned.match(/^\(See\s+([^)]+)\)$/i);
        if (seeMatch?.[1] && !parsed.seeAlsoTarget) {
          parsed.seeAlsoTarget = seeMatch[1].trim();
          continue;
        }
        if (cleaned) {
          const targetPos: NormalizedPartOfSpeech =
            rowId === 'tn_n' ? 'idiom' : currentPos;
          if (targetPos === 'idiom') {
            parsed.isIdiom = true;
          }
          if (!parsed.byPos[targetPos]) parsed.byPos[targetPos] = [];
          parsed.byPos[targetPos].push(cleaned);
          parsed.allMeanings.push({ pos: targetPos, text: cleaned });
        }
      } else if (rowId === 'mn_ss') {
        const cleaned = lastText.replace(/^[■•\-*]+\s*/, '').trim();
        const seeMatch = cleaned.match(/^\(See\s+([^)]+)\)$/i);
        if (seeMatch?.[1]) {
          if (!parsed.seeAlsoTarget) {
            parsed.seeAlsoTarget = seeMatch[1].trim();
          }
          continue;
        }
        if (cleaned) {
          parsed.englishDefinitions.push({
            pos: currentPos,
            text: cleaned,
            example: '',
          });
        }
      } else if (rowId === 'mh' || rowId === 'tn_mh' || rowId === 'mh_ss') {
        const cleaned = lastText.replace(/^[⁃\-•]+\s*/, '').trim();
        if (cleaned) {
          if (!parsed.examples.includes(cleaned)) {
            parsed.examples.push(cleaned);
          }
          if (rowId === 'mh_ss' && parsed.englishDefinitions.length > 0) {
            const lastDef =
              parsed.englishDefinitions[parsed.englishDefinitions.length - 1];
            if (!lastDef.example) {
              lastDef.example = cleaned;
            }
          }
        }
      }
    }
  }

  const idiomArticleMatch = fulltext.match(
    /<article id="dict_id"[\s\S]*?<\/article>/i
  );
  if (idiomArticleMatch) {
    parsed.isIdiom = true;
    const idiomBlock = idiomArticleMatch[0];
    const exMatches = idiomBlock.match(/<ex>([\s\S]*?)<\/ex>/gi) || [];
    for (const rawEx of exMatches) {
      const cleanEx = stripHtmlTags(rawEx)
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .trim();
      if (cleanEx && !parsed.examples.includes(cleanEx)) {
        parsed.examples.push(cleanEx);
      }
      if (parsed.examples.length >= 3) break;
    }

    if (parsed.englishDefinitions.length === 0) {
      const dtrnMatch = idiomBlock.match(/<dtrn>([\s\S]*?)<\/dtrn>/i);
      if (dtrnMatch?.[1]) {
        const dtrnInner = dtrnMatch[1];
        const beforeBlock = stripHtmlTags(
          dtrnInner.split(/<br\s*\/?>|<blockquote/i)[0] || ''
        )
          .replace(/^[0-9]+\.\s*[•·\-]*\s*/g, '')
          .trim();

        let gloss = '';
        if (
          beforeBlock &&
          beforeBlock.toLowerCase() !== queryWord.toLowerCase() &&
          !beforeBlock.toLowerCase().startsWith(queryWord.toLowerCase() + ' (')
        ) {
          gloss = beforeBlock;
        } else {
          const blockquotes =
            dtrnInner.match(/<blockquote>([\s\S]*?)<\/blockquote>/gi) || [];
          for (const bq of blockquotes) {
            if (/<ex>/i.test(bq)) continue;
            const candidate = stripHtmlTags(bq).trim();
            if (candidate) {
              gloss = candidate;
              break;
            }
          }
        }

        if (gloss) {
          parsed.englishDefinitions.push({
            pos: 'idiom',
            text: gloss,
            example: parsed.examples[0] || '',
          });
        }
      }
    }
  }

  return parsed;
}

function tokenizeVietnamese(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[(),.;:!?/"'“”[\]]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function buildAlignedVietnameseMeaning(params: {
  senseIndex: number;
  pos: NormalizedPartOfSpeech;
  defVi: string;
  primaryWordVi: string;
  gtxPosTerms: string[];
  evPosMeanings: string[];
  queryWord: string;
}): string {
  const {
    senseIndex,
    defVi,
    primaryWordVi,
    gtxPosTerms,
    evPosMeanings,
    queryWord,
  } = params;

  const cleanDefVi = defVi
    .replace(/^[;:,.\-\s]+|[;:,.\-\s]+$/g, '')
    .trim()
    .normalize('NFC');
  const cleanPrimary =
    primaryWordVi.toLowerCase() !== queryWord.toLowerCase()
      ? primaryWordVi.trim().normalize('NFC')
      : '';

  // Find best overlapping entry in Anh-Viet dictionary for this exact Cambridge sense
  let bestEv = '';
  let bestOverlap = 0;
  if (evPosMeanings.length > 0 && cleanDefVi) {
    const defTokens = new Set(tokenizeVietnamese(cleanDefVi));
    for (const candidate of evPosMeanings) {
      const candClean = candidate.replace(/^\([^)]+\)\s*/, '').trim();
      const candTokens = tokenizeVietnamese(candClean);
      const overlap = candTokens.filter((t) => defTokens.has(t)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestEv = candClean;
      }
    }
  }

  if (!bestEv && evPosMeanings.length > 0 && evPosMeanings.length <= 2) {
    const candidate = (evPosMeanings[senseIndex] || evPosMeanings[0] || '')
      .replace(/^\([^)]+\)\s*/, '')
      .trim();
    bestEv = candidate;
  }

  const shortHeadTerms: string[] = [];
  if (params.pos === 'idiom' && evPosMeanings.length > 0) {
    if (bestEv && bestEv.length <= 65) {
      shortHeadTerms.push(bestEv);
    }
    for (const rawEv of evPosMeanings) {
      const cleanedEv = rawEv.replace(/^\([^)]+\)\s*/, '').trim();
      if (
        cleanedEv &&
        cleanedEv.length <= 65 &&
        !shortHeadTerms.some((x) => x.toLowerCase() === cleanedEv.toLowerCase())
      ) {
        shortHeadTerms.push(cleanedEv);
      }
      if (shortHeadTerms.length >= 2) break;
    }
  } else {
    const maxPrimaryLen = params.pos === 'idiom' ? 48 : 28;
    if (
      senseIndex === 0 &&
      cleanPrimary &&
      cleanPrimary.length <= maxPrimaryLen
    ) {
      shortHeadTerms.push(cleanPrimary);
    }
    if (bestEv && bestEv.length <= 65) {
      const lowerExisting = shortHeadTerms.map((x) => x.toLowerCase());
      if (!lowerExisting.includes(bestEv.toLowerCase())) {
        shortHeadTerms.push(bestEv);
      }
    } else if (
      senseIndex === 0 &&
      gtxPosTerms.length > 0 &&
      !bestEv &&
      evPosMeanings.length <= 2
    ) {
      for (const term of gtxPosTerms.slice(0, 2)) {
        const norm = term.trim().normalize('NFC');
        if (
          norm &&
          !shortHeadTerms.some((x) => x.toLowerCase() === norm.toLowerCase())
        ) {
          shortHeadTerms.push(norm);
        }
      }
    }
  }

  const headJoined = shortHeadTerms.join('; ').trim();

  if (headJoined && cleanDefVi) {
    if (params.pos === 'idiom') {
      return headJoined;
    }
    if (
      headJoined.toLowerCase().includes(cleanDefVi.toLowerCase()) ||
      cleanDefVi.length > 65
    ) {
      return bestOverlap > 0 || evPosMeanings.length <= 2
        ? headJoined
        : cleanDefVi;
    }
    return `${headJoined} (${cleanDefVi})`;
  }

  return headJoined || cleanDefVi || cleanPrimary || bestEv;
}

const OUTBOUND_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 5500
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': OUTBOUND_USER_AGENT,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function translateViaFallbackProviders(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const encoded = encodeURIComponent(trimmed);

  // Fallback 1: Google Chrome dictionary extension endpoint (separate quota pool from client=gtx)
  const clients5 = await fetchJsonWithTimeout<unknown>(
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=${encoded}`,
    4500
  );
  if (Array.isArray(clients5) && clients5.length > 0) {
    const first = clients5[0];
    if (typeof first === 'string' && first.trim()) {
      return first.trim().normalize('NFC');
    }
    if (Array.isArray(first) && typeof first[0] === 'string' && first[0].trim()) {
      return first[0].trim().normalize('NFC');
    }
  } else if (
    clients5 &&
    typeof clients5 === 'object' &&
    Array.isArray((clients5 as { sentences?: Array<{ trans?: string }> }).sentences)
  ) {
    const joined = (clients5 as { sentences: Array<{ trans?: string }> }).sentences
      .map((s) => s.trans || '')
      .join('')
      .trim()
      .normalize('NFC');
    if (joined) return joined;
  }

  // Fallback 2: MyMemory public translation API (only suitable for short strings <= 450 chars)
  if (trimmed.length <= 450) {
    const myMemory = await fetchJsonWithTimeout<{
      responseData?: { translatedText?: string };
    }>(
      `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|vi`,
      4500
    );
    const mmText = String(myMemory?.responseData?.translatedText || '')
      .trim()
      .normalize('NFC');
    if (
      mmText &&
      !mmText.toUpperCase().includes('MYMEMORY WARNING') &&
      mmText.toLowerCase() !== trimmed.toLowerCase()
    ) {
      return mmText;
    }
  }

  return '';
}

function findPunctuatedHeadwordFromSentences(
  sentences: Array<{ fields?: { en?: string } }> | undefined,
  queryLower: string
): string {
  if (!Array.isArray(sentences) || sentences.length === 0) return '';
  const targetComparable = normalizeComparablePhrase(queryLower);
  if (!targetComparable) return '';

  for (const item of sentences) {
    const stripped = stripHtmlTags(String(item?.fields?.en || ''))
      .replace(/\([^)]*\)/g, '')
      .replace(/[.!?]+$/g, '')
      .replace(/,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!stripped) continue;
    if (
      normalizeComparablePhrase(stripped) === targetComparable &&
      stripped !== queryLower
    ) {
      return stripped;
    }
  }
  return '';
}

function extractTracauSentenceMeanings(
  sentences: Array<{ fields?: { en?: string; vi?: string } }> | undefined,
  queryLower: string
): string[] {
  if (!Array.isArray(sentences) || sentences.length === 0) return [];
  const targetComparable = normalizeComparablePhrase(queryLower);
  const collected: string[] = [];
  for (const item of sentences) {
    const rawEn = stripHtmlTags(String(item?.fields?.en || ''))
      .replace(/\([^)]*\)/g, '')
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (
      rawEn !== queryLower &&
      normalizeComparablePhrase(rawEn) !== targetComparable
    ) {
      continue;
    }

    const rawVi = stripHtmlTags(String(item?.fields?.vi || ''))
      .split(/(?:\s*-\s*){2,}/)[0]
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFC');
    if (
      rawVi &&
      rawVi.length <= 60 &&
      rawVi.toLowerCase() !== queryLower &&
      normalizeComparablePhrase(rawVi) !== targetComparable &&
      !collected.some((x) => x.toLowerCase() === rawVi.toLowerCase())
    ) {
      collected.push(rawVi);
    }
    if (collected.length >= 2) break;
  }
  return collected;
}

function extractInnerIpaSegment(rawPron: string | undefined): string {
  if (!rawPron) return '';
  const slashMatch = rawPron.match(/\/([^/]+)\//);
  const core = (slashMatch ? slashMatch[1] : rawPron)
    .replace(/^\/+|\/+$/g, '')
    .trim();
  return core;
}

const singleWordPronCache = new Map<string, { uk: string; us: string }>();

async function lookupSingleWordPronSegments(
  word: string
): Promise<{ uk: string; us: string }> {
  const cached = singleWordPronCache.get(word);
  if (cached) return cached;

  const entry = await fetchJsonWithTimeout<RawCambridgeApiData>(
    `https://dictionary-api.eliaschen.dev/api/dictionary/uk/${encodeURIComponent(
      word
    )}`,
    4500
  );
  const prons = Array.isArray(entry?.pronunciation) ? entry!.pronunciation! : [];
  const ukRaw =
    prons.find((p) => p.lang === 'uk' && p.pron)?.pron ||
    prons.find((p) => p.pron)?.pron;
  const usRaw =
    prons.find((p) => p.lang === 'us' && p.pron)?.pron ||
    prons.find((p) => p.pron)?.pron;

  let ukSeg = extractInnerIpaSegment(ukRaw);
  let usSeg = extractInnerIpaSegment(usRaw);

  if (!ukSeg && !usSeg) {
    const freeEntry = await fetchJsonWithTimeout<
      Array<{ phonetic?: string; phonetics?: Array<{ text?: string }> }>
    >(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`,
      3500
    );
    const fbRaw =
      freeEntry?.[0]?.phonetic ||
      freeEntry?.[0]?.phonetics?.find((p) => p.text?.trim())?.text;
    const fbSeg = extractInnerIpaSegment(fbRaw);
    ukSeg = fbSeg;
    usSeg = fbSeg;
  }

  const resolved = {
    uk: ukSeg || usSeg,
    us: usSeg || ukSeg,
  };
  if (resolved.uk || resolved.us) {
    if (singleWordPronCache.size > 1000) {
      const oldest = singleWordPronCache.keys().next().value;
      if (oldest) singleWordPronCache.delete(oldest);
    }
    singleWordPronCache.set(word, resolved);
  }
  return resolved;
}

async function synthesizePhrasePhonetics(
  phraseQuery: string
): Promise<{ uk: string; us: string }> {
  const words = phraseQuery
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z]+|[^a-z]+$/gi, ''))
    .filter((w) => w.length > 0);

  if (words.length < 2 || words.length > 8) {
    return { uk: '', us: '' };
  }

  const uniqueWords = Array.from(new Set(words));
  const resolvedPairs = await Promise.all(
    uniqueWords.map(
      async (w) => [w, await lookupSingleWordPronSegments(w)] as const
    )
  );
  const segByWord = new Map(resolvedPairs);

  const ukParts: string[] = [];
  const usParts: string[] = [];

  for (const w of words) {
    const seg = segByWord.get(w);
    if (!seg || (!seg.uk && !seg.us)) {
      return { uk: '', us: '' };
    }
    ukParts.push(seg.uk || seg.us);
    usParts.push(seg.us || seg.uk);
  }

  return {
    uk: ukParts.length > 0 ? `/${ukParts.join(' ')}/` : '',
    us: usParts.length > 0 ? `/${usParts.join(' ')}/` : '',
  };
}

async function lookupCambridgeDictionaryEntry(
  rawQuery: string
): Promise<CambridgeLookupPayload | null> {
  const cleanedQuery = rawQuery.trim().replace(/\s+/g, ' ');
  if (!cleanedQuery) return null;

  const cacheKey = cleanedQuery.toLowerCase();
  const cached = cambridgeLookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.data.meaning.trim()) {
    return cached.data;
  }

  const encoded = encodeURIComponent(cacheKey);

  const [cambUk, gtxWord, tracauInitial] = await Promise.all([
    fetchJsonWithTimeout<RawCambridgeApiData>(
      `https://dictionary-api.eliaschen.dev/api/dictionary/uk/${encoded}`
    ),
    fetchJsonWithTimeout<GtxTranslateResponse>(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&dj=1&q=${encoded}`
    ),
    fetchJsonWithTimeout<{
      sentences?: Array<{ fields?: { en?: string; vi?: string } }>;
      tratu?: Array<{ fields?: { fulltext?: string } }>;
    }>(`https://api.tracau.vn/WBBcwnwQpV89/s/${encoded}/en`),
  ]);

  let cambData = cambUk;
  if (!cambData?.definition || cambData.definition.length === 0) {
    const slugEncoded = cacheKey.includes(' ')
      ? encodeURIComponent(cacheKey.replace(/\s+/g, '-'))
      : encoded;
    const cambUs = await fetchJsonWithTimeout<RawCambridgeApiData>(
      `https://dictionary-api.eliaschen.dev/api/dictionary/uk/${slugEncoded}`
    );
    if (cambUs?.definition && cambUs.definition.length > 0) {
      cambData = cambUs;
    } else {
      const cambEn = await fetchJsonWithTimeout<RawCambridgeApiData>(
        `https://dictionary-api.eliaschen.dev/api/dictionary/en/${slugEncoded}`
      );
      if (cambEn?.definition && cambEn.definition.length > 0) {
        cambData = cambEn;
      }
    }
  }

  let initialFulltext = tracauInitial?.tratu?.[0]?.fields?.fulltext || '';
  if (!initialFulltext && cacheKey.includes(' ')) {
    const punctuatedHeadword = findPunctuatedHeadwordFromSentences(
      tracauInitial?.sentences,
      cacheKey
    );
    if (punctuatedHeadword) {
      const punctuatedTracau = await fetchJsonWithTimeout<{
        tratu?: Array<{ fields?: { fulltext?: string } }>;
      }>(
        `https://api.tracau.vn/WBBcwnwQpV89/s/${encodeURIComponent(
          punctuatedHeadword
        )}/en`,
        4500
      );
      initialFulltext = punctuatedTracau?.tratu?.[0]?.fields?.fulltext || '';
    }
  }

  let evParsed = parseTracauFulltext(initialFulltext, cacheKey);
  if (evParsed.allMeanings.length === 0 && evParsed.seeAlsoTarget) {
    const redirected = await fetchJsonWithTimeout<{
      tratu?: Array<{ fields?: { fulltext?: string } }>;
    }>(
      `https://api.tracau.vn/WBBcwnwQpV89/s/${encodeURIComponent(
        evParsed.seeAlsoTarget.toLowerCase()
      )}/en`
    );
    if (redirected) {
      evParsed = parseTracauFulltext(
        redirected?.tratu?.[0]?.fields?.fulltext || '',
        evParsed.seeAlsoTarget
      );
    }
  }

  // Extract exact headword/phrase/idiom meanings from Tracau sentence memory
  if (evParsed.allMeanings.length === 0) {
    const sentenceMeanings = extractTracauSentenceMeanings(
      tracauInitial?.sentences,
      cacheKey
    );
    const hasCambridgeDefs = Boolean(cambData?.definition?.length);
    const defaultPos: NormalizedPartOfSpeech = hasCambridgeDefs
      ? normalizePos(cambData?.pos?.[0], cacheKey)
      : evParsed.isIdiom || cacheKey.split(/\s+/).length >= 3
        ? 'idiom'
        : isLikelyPhrasalVerbQuery(cacheKey)
          ? 'phrasal_verb'
          : cacheKey.includes(' ')
            ? 'phrase'
            : 'noun';
    for (const sm of sentenceMeanings) {
      if (!evParsed.byPos[defaultPos]) evParsed.byPos[defaultPos] = [];
      evParsed.byPos[defaultPos].push(sm);
      evParsed.allMeanings.push({ pos: defaultPos, text: sm });
    }
  }

  let primaryWordVi = (
    gtxWord?.sentences?.map((s) => s.trans || '').join('') || ''
  )
    .trim()
    .normalize('NFC');

  if (!primaryWordVi || primaryWordVi.toLowerCase() === cacheKey) {
    const fallbackWordVi = await translateViaFallbackProviders(cleanedQuery);
    if (fallbackWordVi && fallbackWordVi.toLowerCase() !== cacheKey) {
      primaryWordVi = fallbackWordVi;
    }
  }

  // Collect synonyms per POS from Google dictionary reverse_translation, fallback to Tracau synonyms
  const synonymsByPos: Record<string, string[]> = {};
  for (const dictEntry of gtxWord?.dict || []) {
    const mappedPos = normalizePos(dictEntry.pos, cacheKey);
    const collected: string[] = [];
    for (const ent of dictEntry.entry || []) {
      for (const rev of ent.reverse_translation || []) {
        const cleanRev = String(rev || '').trim();
        if (
          cleanRev &&
          cleanRev.toLowerCase() !== cacheKey &&
          !collected.includes(cleanRev)
        ) {
          collected.push(cleanRev);
        }
        if (collected.length >= 4) break;
      }
      if (collected.length >= 4) break;
    }
    if (collected.length > 0) {
      synonymsByPos[mappedPos] = collected;
    }
  }

  // Extract word forms from Cambridge (e.g. comparative/superlative or irregular verb forms)
  const formLabels: string[] = [];
  if (Array.isArray(cambData?.verbs)) {
    for (const v of cambData.verbs) {
      const formText = String(v?.text || '').trim();
      const formType = String(v?.type || '').trim();
      if (
        formText &&
        formText.toLowerCase() !== cacheKey &&
        !formLabels.includes(formText)
      ) {
        formLabels.push(formType ? `${formText} (${formType})` : formText);
      }
      if (formLabels.length >= 3) break;
    }
  }

  const prons = Array.isArray(cambData?.pronunciation)
    ? cambData.pronunciation
    : [];
  const findPron = (lang: 'uk' | 'us', targetPos?: string) => {
    if (targetPos) {
      const exact = prons.find(
        (p) =>
          p.lang === lang &&
          p.pron &&
          normalizePos(p.pos, cacheKey) === targetPos
      );
      if (exact) return exact;
    }
    return prons.find((p) => p.lang === lang && p.pron);
  };

  // Deduplicate top Cambridge definitions
  const rawDefs = Array.isArray(cambData?.definition) ? cambData.definition : [];
  const defaultCambPos = normalizePos(cambData?.pos?.[0], cacheKey);
  const dedupedDefs: Array<{
    pos: NormalizedPartOfSpeech;
    englishDefinition: string;
    example: string;
  }> = [];
  const seenKeys = new Set<string>();

  for (const d of rawDefs) {
    const cleanEn = String(d?.text || '')
      .replace(/:\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFC');
    if (!cleanEn) continue;
    const mappedPos = d?.pos
      ? normalizePos(d.pos, cacheKey)
      : defaultCambPos;
    const dedupKey = `${mappedPos}::${cleanEn.toLowerCase()}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const bestExample =
      pickBestExampleSentence(d?.example) || evParsed.examples[0] || '';
    dedupedDefs.push({
      pos: mappedPos,
      englishDefinition: cleanEn,
      example: bestExample,
    });
    if (dedupedDefs.length >= 4) break;
  }

  let source: 'cambridge' | 'dictionary_fallback' = 'cambridge';
  let fallbackPhonetic = '';

  // Fallback to Free Dictionary API if Cambridge had no entry (e.g. certain idioms)
  if (dedupedDefs.length === 0) {
    source = 'dictionary_fallback';
    const freeDict = await fetchJsonWithTimeout<
      Array<{
        phonetic?: string;
        phonetics?: Array<{ text?: string; audio?: string }>;
        meanings?: Array<{
          partOfSpeech?: string;
          definitions?: Array<{ definition?: string; example?: string }>;
        }>;
      }>
    >(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`);

    if (Array.isArray(freeDict) && freeDict.length > 0) {
      const entry = freeDict[0];
      fallbackPhonetic =
        entry.phonetic ||
        entry.phonetics?.find((p) => p.text?.trim())?.text?.trim() ||
        '';

      // Sort meanings so common learner POS (adjective/verb/noun) come in sensible order
      const meanings = [...(entry.meanings || [])];
      for (const m of meanings) {
        const mappedPos: NormalizedPartOfSpeech =
          evParsed.isIdiom || cacheKey.split(/\s+/).length >= 3
            ? 'idiom'
            : normalizePos(m.partOfSpeech, cacheKey);
        for (const defItem of m.definitions || []) {
          const cleanEn = String(defItem.definition || '').trim();
          if (!cleanEn) continue;
          const dedupKey = `${mappedPos}::${cleanEn.toLowerCase()}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);
          dedupedDefs.push({
            pos: mappedPos,
            englishDefinition: cleanEn,
            example: String(defItem.example || '').trim() || evParsed.examples[0] || '',
          });
          if (dedupedDefs.length >= 3) break;
        }
        if (dedupedDefs.length >= 3) break;
      }
    }

    if (dedupedDefs.length === 0 && evParsed.englishDefinitions.length > 0) {
      for (const ed of evParsed.englishDefinitions) {
        const cleanEn = ed.text.trim();
        if (!cleanEn) continue;
        const mappedPos: NormalizedPartOfSpeech = evParsed.isIdiom
          ? 'idiom'
          : ed.pos;
        const dedupKey = `${mappedPos}::${cleanEn.toLowerCase()}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        dedupedDefs.push({
          pos: mappedPos,
          englishDefinition: cleanEn,
          example: ed.example || evParsed.examples[0] || '',
        });
        if (dedupedDefs.length >= 3) break;
      }
    }
  }

  // Synthesize word-by-word Cambridge IPA when looking up multi-word phrases/collocations like "good at"
  const hasAnyDirectPron =
    prons.some((p) => Boolean(p.pron?.trim())) ||
    Boolean(evParsed.phonetic.trim()) ||
    Boolean(fallbackPhonetic.trim());
  const synthesizedPhraseIpa =
    !hasAnyDirectPron && cacheKey.includes(' ')
      ? await synthesizePhrasePhonetics(cleanedQuery)
      : { uk: '', us: '' };

  // Batch-translate the English definitions into Vietnamese in a single request (with fallback providers)
  let translatedDefsVi: string[] = [];
  if (dedupedDefs.length > 0) {
    const joinedDefs = dedupedDefs
      .map((d) => d.englishDefinition)
      .join('\n');
    const gtxDefs = await fetchJsonWithTimeout<GtxTranslateResponse>(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dj=1&q=${encodeURIComponent(
        joinedDefs
      )}`
    );
    let fullTrans = (
      gtxDefs?.sentences?.map((s) => s.trans || '').join('') || ''
    )
      .trim()
      .normalize('NFC');

    if (!fullTrans) {
      fullTrans = await translateViaFallbackProviders(joinedDefs);
    }

    if (fullTrans) {
      translatedDefsVi = fullTrans.split('\n').map((line) => line.trim());
    }
  }

  const senses: CambridgeSensePayload[] = dedupedDefs.map((def, idx) => {
    const ukForSense = findPron('uk', def.pos);
    const usForSense = findPron('us', def.pos);
    const sensePhonetic =
      ukForSense?.pron ||
      usForSense?.pron ||
      evParsed.phonetic ||
      fallbackPhonetic ||
      synthesizedPhraseIpa.uk ||
      synthesizedPhraseIpa.us ||
      '';

    const gtxDictMatch = gtxWord?.dict?.find(
      (x) => normalizePos(x.pos, cacheKey) === def.pos
    );
    const gtxPosTerms = (gtxDictMatch?.terms || []).map((t) =>
      t.normalize('NFC')
    );
    const evPosMeanings = evParsed.byPos[def.pos] || [];

    const meaningVi = buildAlignedVietnameseMeaning({
      senseIndex: idx,
      pos: def.pos,
      defVi: translatedDefsVi[idx] || '',
      primaryWordVi,
      gtxPosTerms,
      evPosMeanings,
      queryWord: cacheKey,
    });

    const noteParts: string[] = [];
    if (def.englishDefinition) {
      noteParts.push(
        `${source === 'cambridge' ? 'Cambridge' : 'Định nghĩa'}: ${def.englishDefinition}`
      );
    }
    if (idx === 0 && formLabels.length > 0) {
      noteParts.push(`Từ hình: ${formLabels.join(', ')}`);
    }
    const syns =
      synonymsByPos[def.pos] ||
      (evParsed.synonyms.length > 0 ? evParsed.synonyms : []);
    if (syns.length > 0) {
      noteParts.push(`Đồng nghĩa: ${syns.slice(0, 4).join(', ')}`);
    }

    return {
      id: idx,
      partOfSpeech: def.pos,
      phonetic: sensePhonetic,
      meaning: meaningVi,
      englishDefinition: def.englishDefinition,
      example: def.example,
      notes: noteParts.join(' · '),
    };
  });

  // Even if neither Cambridge nor FreeDict had English definitions (e.g. multi-word idiom only in Anh-Viet/GTX)
  if (senses.length === 0 && (evParsed.allMeanings.length > 0 || primaryWordVi)) {
    const firstEv = evParsed.allMeanings[0];
    const fallbackPos: NormalizedPartOfSpeech =
      firstEv?.pos ||
      (isLikelyPhrasalVerbQuery(cacheKey)
        ? 'phrasal_verb'
        : cacheKey.includes(' ')
          ? 'idiom'
          : 'noun');
    const fallbackMeaning =
      firstEv?.text ||
      (primaryWordVi.toLowerCase() !== cacheKey ? primaryWordVi : '');
    if (fallbackMeaning) {
      senses.push({
        id: 0,
        partOfSpeech: fallbackPos,
        phonetic:
          evParsed.phonetic ||
          synthesizedPhraseIpa.uk ||
          synthesizedPhraseIpa.us ||
          '',
        meaning: fallbackMeaning,
        englishDefinition: '',
        example: evParsed.examples[0] || '',
        notes:
          evParsed.synonyms.length > 0
            ? `Đồng nghĩa: ${evParsed.synonyms.join(', ')}`
            : '',
      });
    }
  }

  if (senses.length === 0) return null;

  const primarySense = senses[0];
  const topUk = findPron('uk', primarySense.partOfSpeech) || findPron('uk');
  const topUs = findPron('us', primarySense.partOfSpeech) || findPron('us');

  const resolvedHeadword = (cambData?.word || cleanedQuery).trim();
  const hasPlaceholderOrTruncatedPhrase =
    (cleanedQuery.includes(' ') && !resolvedHeadword.includes(' ')) ||
    (/[\/]/.test(resolvedHeadword) && !/[\/]/.test(cleanedQuery)) ||
    (/\b(?:something|somebody|someone|somewhere|oneself)\b/i.test(
      resolvedHeadword
    ) &&
      !/\b(?:something|somebody|someone|somewhere|oneself)\b/i.test(
        cleanedQuery
      ));
  const audioTargetWord = hasPlaceholderOrTruncatedPhrase
    ? cleanedQuery
    : resolvedHeadword;
  const encodedAudioWord = encodeURIComponent(audioTargetWord);

  const payload: CambridgeLookupPayload = {
    word: resolvedHeadword,
    source,
    phonetic:
      primarySense.phonetic ||
      topUk?.pron ||
      topUs?.pron ||
      evParsed.phonetic ||
      fallbackPhonetic ||
      synthesizedPhraseIpa.uk ||
      synthesizedPhraseIpa.us ||
      '',
    phoneticUk: topUk?.pron || synthesizedPhraseIpa.uk || '',
    phoneticUs: topUs?.pron || synthesizedPhraseIpa.us || '',
    audioUk: `/api/dictionary/audio?word=${encodedAudioWord}&accent=uk`,
    audioUs: `/api/dictionary/audio?word=${encodedAudioWord}&accent=us`,
    partOfSpeech: primarySense.partOfSpeech,
    meaning: primarySense.meaning,
    englishDefinition: primarySense.englishDefinition,
    example: primarySense.example,
    notes: primarySense.notes,
    senses,
  };

  if (payload.meaning.trim()) {
    if (cambridgeLookupCache.size > 500) {
      const firstKey = cambridgeLookupCache.keys().next().value;
      if (firstKey) cambridgeLookupCache.delete(firstKey);
    }
    cambridgeLookupCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + CAMBRIDGE_CACHE_TTL_MS,
    });
  }

  return payload;
}

const DICTIONARY_AUDIO_CACHE_TTL_MS = 60 * 60 * 1000;
const dictionaryAudioCache = new Map<
  string,
  { buffer: Buffer; contentType: string; expiresAt: number }
>();

function looksLikeAudioBuffer(buf: Buffer, contentType: string): boolean {
  if (buf.byteLength < 256) return false;
  const lowerType = contentType.toLowerCase();
  if (lowerType.includes('text/html') || lowerType.includes('application/json')) {
    return false;
  }
  if (lowerType.includes('audio/') || lowerType.includes('application/octet-stream')) {
    return true;
  }
  // Check ID3 tag or MPEG frame sync
  const isId3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
  const isMpegSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  return isId3 || isMpegSync;
}

async function fetchDictionaryAudioBuffer(
  rawWord: string,
  accent: 'uk' | 'us'
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const cleaned = rawWord.trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!cleaned) return null;

  const cacheKey = `${accent}::${cleaned.toLowerCase()}`;
  const cached = dictionaryAudioCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { buffer: cached.buffer, contentType: cached.contentType };
  }

  const encoded = encodeURIComponent(cleaned);
  const candidateUrls: string[] = [];

  if (cleaned.length <= 45) {
    const youdaoType = accent === 'uk' ? '1' : '2';
    candidateUrls.push(
      `https://dict.youdao.com/dictvoice?audio=${encoded}&type=${youdaoType}`
    );
  }
  const ttsLang = accent === 'uk' ? 'en-GB' : 'en-US';
  candidateUrls.push(
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encoded}`
  );

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5500),
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
        },
      });
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (!looksLikeAudioBuffer(buffer, contentType)) {
        continue;
      }

      const normalizedType = contentType.toLowerCase().includes('audio/')
        ? contentType
        : 'audio/mpeg';

      if (dictionaryAudioCache.size > 300) {
        const oldestKey = dictionaryAudioCache.keys().next().value;
        if (oldestKey) dictionaryAudioCache.delete(oldestKey);
      }
      dictionaryAudioCache.set(cacheKey, {
        buffer,
        contentType: normalizedType,
        expiresAt: Date.now() + DICTIONARY_AUDIO_CACHE_TTL_MS,
      });

      return { buffer, contentType: normalizedType };
    } catch {
      // Try next provider
    }
  }

  return null;
}

export async function createApp({
  production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
  serveFrontend = true,
} = {}) {
  const isProduction = production;
  const app = express();
  app.disable('x-powered-by');

  if (!isProduction) {
    fs.mkdirSync(publicDefaultDir, { recursive: true });
  }

  // Reject writes before parsing bodies on the public deployment.
  if (isProduction) {
    app.post('/api/default-artworks/sync', (_req, res) => {
      res.status(403).json({ error: 'Default artworks are read-only in production.' });
    });
  }
  app.use(express.json({ limit: isProduction ? '16kb' : '100mb' }));

  if (fs.existsSync(publicDefaultDir)) {
    app.use('/default-artworks', express.static(publicDefaultDir));
  }
  if (fs.existsSync(distDefaultDir)) {
    app.use('/default-artworks', express.static(distDefaultDir));
  }
  app.use('/default-artworks', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).end();
  });

  app.get('/api/dictionary/cambridge', async (req: Request, res: Response) => {
    const wordParam = typeof req.query.word === 'string' ? req.query.word : '';
    if (wordParam.length > 160) {
      res.status(400).json({ error: 'Word query must not exceed 160 characters.' });
      return;
    }
    if (!wordParam.trim()) {
      res.status(400).json({ error: 'Missing word query parameter.' });
      return;
    }

    try {
      const entry = await lookupCambridgeDictionaryEntry(wordParam);
      if (!entry) {
        res.status(404).json({ error: 'Word not found in dictionary.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json(entry);
    } catch (error) {
      console.error('Cambridge dictionary lookup failed:', error);
      res.status(500).json({ error: 'Dictionary lookup failed.' });
    }
  });

  app.get('/api/dictionary/audio', async (req: Request, res: Response) => {
    const wordParam = typeof req.query.word === 'string' ? req.query.word : '';
    if (wordParam.length > 160) {
      res.status(400).json({ error: 'Word query must not exceed 160 characters.' });
      return;
    }
    const accentParam =
      req.query.accent === 'uk' ? 'uk' : ('us' as 'uk' | 'us');

    if (!wordParam.trim()) {
      res.status(400).json({ error: 'Missing word query parameter.' });
      return;
    }

    try {
      const audioResult = await fetchDictionaryAudioBuffer(
        wordParam,
        accentParam
      );
      if (!audioResult) {
        res.status(404).json({ error: 'Pronunciation audio unavailable.' });
        return;
      }

      res.setHeader('Content-Type', audioResult.contentType);
      res.setHeader('Content-Length', String(audioResult.buffer.byteLength));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(audioResult.buffer);
    } catch (error) {
      console.error('Dictionary audio proxy failed:', error);
      res.status(500).json({ error: 'Audio lookup failed.' });
    }
  });

  app.get('/api/default-artworks', (_req: Request, res: Response) => {
    const manifest = readManifestFromDisk();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ...manifest,
      writable: !isProduction,
      missingFileIds: getMissingArtworkFileIds(manifest.artworks),
    });
  });

  app.post('/api/default-artworks/sync', (req: Request, res: Response) => {
    if (isProduction) {
      res
        .status(403)
        .json({ error: 'Default artworks are read-only in production.' });
      return;
    }

    try {
      fs.mkdirSync(publicDefaultDir, { recursive: true });
      const mirrorToDist = fs.existsSync(distDir);
      if (mirrorToDist) {
        fs.mkdirSync(distDefaultDir, { recursive: true });
      }

      const body = (req.body || {}) as {
        artworks?: ManifestArtwork[];
        replaceBuiltins?: boolean;
        defaultThemeId?: string;
      };

      const incoming = Array.isArray(body.artworks) ? body.artworks : [];
      const referencedFiles = new Set<string>();
      const savedArtworks: ManifestArtwork[] = [];

      incoming.forEach((art, index) => {
        if (!art || typeof art.imageSrc !== 'string' || !art.imageSrc.trim()) {
          return;
        }

        const safeStem = sanitizeFileStem(art.id, index);
        let finalImageSrc = art.imageSrc.trim();

        if (finalImageSrc.startsWith('data:image/')) {
          const match = finalImageSrc.match(
            /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/
          );
          if (!match) return;

          const ext = getExtensionFromMimeSubtype(match[1]);
          const buffer = Buffer.from(match[2], 'base64');
          const fileName = `${safeStem}.${ext}`;

          fs.writeFileSync(path.join(publicDefaultDir, fileName), buffer);
          if (mirrorToDist) {
            fs.writeFileSync(path.join(distDefaultDir, fileName), buffer);
          }

          referencedFiles.add(fileName);
          finalImageSrc = `/default-artworks/${fileName}`;
        } else if (finalImageSrc.startsWith('/default-artworks/')) {
          const existingFileName = path.basename(finalImageSrc);
          referencedFiles.add(existingFileName);
        }

        savedArtworks.push({
          id: art.id || safeStem,
          viTitle: art.viTitle || `Tranh mặc định ${index + 1}`,
          originalTitle: art.originalTitle || 'Bộ sưu tập mặc định',
          locationYear: art.locationYear || '',
          medium: art.medium || 'Ảnh nền mặc định',
          accessionCode:
            art.accessionCode ||
            `DEF-${String(index + 1).padStart(2, '0')}`,
          quoteVi:
            art.quoteVi ||
            'Mỗi phiên tập trung yên tĩnh là một nét cọ bền bỉ trên hành trình của riêng bạn.',
          quoteSource: art.quoteSource || "Enti Atelier",
          imageSrc: finalImageSrc,
          imageScaleClass: art.imageScaleClass || 'scale-100',
          fallbackBgClass:
            art.fallbackBgClass ||
            'bg-gradient-to-br from-slate-950 via-blue-950 to-amber-500',
          isDark: typeof art.isDark === 'boolean' ? art.isDark : true,
          paletteKey: art.paletteKey || 'starry_night',
          isCustom: false,
        });
      });

      cleanupUnreferencedFiles(publicDefaultDir, referencedFiles);
      if (mirrorToDist) {
        cleanupUnreferencedFiles(distDefaultDir, referencedFiles);
      }

      const nextReplaceBuiltins =
        savedArtworks.length > 0
          ? Boolean(body.replaceBuiltins ?? true)
          : false;

      const requestedDefaultId =
        typeof body.defaultThemeId === 'string' ? body.defaultThemeId : '';
      const validDefaultThemeId =
        requestedDefaultId &&
        savedArtworks.some((a) => a.id === requestedDefaultId)
          ? requestedDefaultId
          : savedArtworks[0]?.id || '';

      const nextManifest: DefaultArtworksManifest = {
        replaceBuiltins: nextReplaceBuiltins,
        artworks: savedArtworks,
        defaultThemeId: validDefaultThemeId,
        updatedAt: Date.now(),
      };

      const serialized = `${JSON.stringify(nextManifest, null, 2)}\n`;
      fs.writeFileSync(
        path.join(publicDefaultDir, 'manifest.json'),
        serialized,
        'utf-8'
      );
      if (mirrorToDist) {
        fs.writeFileSync(
          path.join(distDefaultDir, 'manifest.json'),
          serialized,
          'utf-8'
        );
      }

      res.json({
        ...nextManifest,
        writable: true,
        missingFileIds: getMissingArtworkFileIds(savedArtworks),
      });
    } catch (error) {
      console.error('Failed to sync default artworks:', error);
      res.status(500).json({ error: 'Failed to persist default artworks.' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (serveFrontend && !isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (serveFrontend) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

// Importing this module from a Vercel Function never opens a listening socket.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void createApp({ production: process.argv.includes('--production') ? true : undefined })
    .then(app => app.listen(PORT, '0.0.0.0', () => {
      console.log(`Enti Atelier server running on http://0.0.0.0:${PORT}`);
    }));
}
