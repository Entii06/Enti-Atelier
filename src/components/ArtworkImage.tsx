import React, { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { BUILTIN_ARTWORKS, getBuiltinBackupImageSrc } from '../constants/themes';
import { ArtworkItem } from '../types';

interface ArtworkImageProps {
  artwork?: ArtworkItem;
  themeId?: string;
  className?: string;
  alt?: string;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  artwork,
  themeId,
  className = '',
  alt,
}) => {
  const resolved =
    artwork ||
    (themeId ? BUILTIN_ARTWORKS.find((a) => a.id === themeId) : undefined);

  const primarySrc = resolved?.imageSrc || '';
  const candidateBackup =
    resolved?.backupImageSrc ||
    (resolved && !resolved.isCustom
      ? getBuiltinBackupImageSrc(resolved.id, resolved.viTitle)
      : '');
  const backupSrc =
    candidateBackup && candidateBackup !== primarySrc ? candidateBackup : '';

  const [usingBackup, setUsingBackup] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUsingBackup(false);
    setFailed(false);
  }, [primarySrc, backupSrc]);

  if (!resolved) {
    return (
      <div
        className={`relative overflow-hidden flex items-center justify-center select-none bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900 ${className}`}
        role="img"
        aria-label={alt || 'Không gian phòng vẽ tĩnh lặng'}
      >
        <Palette className="w-5 h-5 text-white/35 shrink-0" />
      </div>
    );
  }

  const activeSrc = usingBackup && backupSrc ? backupSrc : primarySrc;

  if (failed || !activeSrc) {
    return (
      <div
        className={`relative overflow-hidden flex items-center justify-center select-none ${resolved.fallbackBgClass} ${className}`}
        role="img"
        aria-label={alt || resolved.viTitle}
      >
        <Palette className="w-5 h-5 text-white/45 shrink-0" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={activeSrc}
        alt={alt || `Ảnh nền ${resolved.viTitle}`}
        referrerPolicy="no-referrer"
        onError={() => {
          if (!usingBackup && backupSrc) {
            setUsingBackup(true);
          } else {
            setFailed(true);
          }
        }}
        className={`w-full h-full object-cover transition-transform duration-500 ${resolved.imageScaleClass}`}
      />
    </div>
  );
};
