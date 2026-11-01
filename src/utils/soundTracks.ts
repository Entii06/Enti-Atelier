import { SoundTrack } from '../types';

export const BUILTIN_SOUND_TRACKS: SoundTrack[] = [
  {
    id: 'rain',
    title: 'Mưa đêm Arles',
    kind: 'builtin_rain',
    isBuiltin: true,
  },
  {
    id: 'wind',
    title: 'Gió đồng lúa mì',
    kind: 'builtin_wind',
    isBuiltin: true,
  },
];

export function extractYouTubeVideoId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Support pasting <iframe src="..."> embed snippets
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const candidate = iframeSrcMatch ? iframeSrcMatch[1].trim() : trimmed;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(segments[0])
      ) {
        const id = segments[1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // Fallback regex check if missing protocol
    const regMatch = candidate.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    if (regMatch?.[1]) {
      return regMatch[1];
    }
  }

  return null;
}

export type ParsedAudioInput =
  | {
      ok: true;
      kind: 'youtube' | 'mp3';
      url: string;
      youtubeId?: string;
      fallbackTitle: string;
    }
  | {
      ok: false;
      error: string;
    };

export function parseAudioSourceInput(rawInput: string): ParsedAudioInput {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: 'Vui lòng nhập đường dẫn YouTube hoặc link file MP3.',
    };
  }

  const ytId = extractYouTubeVideoId(trimmed);
  if (ytId) {
    return {
      ok: true,
      kind: 'youtube',
      url: `https://www.youtube.com/watch?v=${ytId}`,
      youtubeId: ytId,
      fallbackTitle: `YouTube · ${ytId}`,
    };
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Đường dẫn không hợp lệ. Hãy dùng link http:// hoặc https://.',
      };
    }

    // Normalize Dropbox share links so HTML5 <audio> can stream directly
    let finalUrl = parsed.toString();
    if (parsed.hostname.includes('dropbox.com')) {
      parsed.searchParams.delete('dl');
      parsed.searchParams.set('raw', '1');
      finalUrl = parsed.toString();
    }

    const lastSegment = decodeURIComponent(
      parsed.pathname.split('/').filter(Boolean).pop() || ''
    );
    const cleanedName = lastSegment
      .replace(/\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();

    return {
      ok: true,
      kind: 'mp3',
      url: finalUrl,
      fallbackTitle:
        cleanedName.length >= 2 ? cleanedName.slice(0, 60) : 'Bản nhạc MP3',
    };
  } catch {
    return {
      ok: false,
      error: 'Đường dẫn không hợp lệ. Hãy kiểm tra lại link YouTube hoặc MP3.',
    };
  }
}

export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    if (typeof data.title === 'string' && data.title.trim()) {
      return data.title.trim().slice(0, 80);
    }
    return null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
