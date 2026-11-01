import { ArtworkItem } from '../types';

export interface ServerDefaultArtworksManifest {
  replaceBuiltins: boolean;
  artworks: ArtworkItem[];
  defaultThemeId: string;
  updatedAt: number;
  writable: boolean;
  missingFileIds: string[];
}

export const EMPTY_SERVER_MANIFEST: ServerDefaultArtworksManifest = {
  replaceBuiltins: false,
  artworks: [],
  defaultThemeId: '',
  updatedAt: 0,
  writable: false,
  missingFileIds: [],
};

function normalizeManifest(
  raw: Partial<ServerDefaultArtworksManifest> | null | undefined,
  defaultWritable: boolean
): ServerDefaultArtworksManifest {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_SERVER_MANIFEST, writable: defaultWritable };
  }
  return {
    replaceBuiltins: Boolean(raw.replaceBuiltins),
    artworks: Array.isArray(raw.artworks)
      ? raw.artworks.map((a) => ({ ...a, isCustom: false }))
      : [],
    defaultThemeId:
      typeof raw.defaultThemeId === 'string' ? raw.defaultThemeId : '',
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    writable:
      typeof raw.writable === 'boolean' ? raw.writable : defaultWritable,
    missingFileIds: Array.isArray(raw.missingFileIds)
      ? raw.missingFileIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export async function fetchServerDefaultArtworks(): Promise<ServerDefaultArtworksManifest> {
  try {
    const apiRes = await fetch('/api/default-artworks', { cache: 'no-store' });
    const contentType = apiRes.headers.get('content-type') || '';
    if (apiRes.ok && contentType.includes('application/json')) {
      const data =
        (await apiRes.json()) as Partial<ServerDefaultArtworksManifest>;
      return normalizeManifest(data, false);
    }
  } catch {
    // Fall back to static manifest file
  }

  try {
    const staticRes = await fetch('/default-artworks/manifest.json', {
      cache: 'no-store',
    });
    const contentType = staticRes.headers.get('content-type') || '';
    if (staticRes.ok && contentType.includes('application/json')) {
      const data =
        (await staticRes.json()) as Partial<ServerDefaultArtworksManifest>;
      return normalizeManifest(data, false);
    }
  } catch {
    // Ignore offline / missing manifest errors
  }

  return EMPTY_SERVER_MANIFEST;
}

export async function syncServerDefaultArtworks(payload: {
  artworks: ArtworkItem[];
  replaceBuiltins?: boolean;
  defaultThemeId?: string;
}): Promise<ServerDefaultArtworksManifest | null> {
  try {
    const res = await fetch('/api/default-artworks/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ServerDefaultArtworksManifest>;
    return normalizeManifest(data, true);
  } catch {
    return null;
  }
}
