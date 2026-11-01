import React from 'react';

export const STARRY_CUTOUTS = {
  swirlRibbon: '/assets/starry-elements/swirl-ribbon.png',
  moonHalo: '/assets/starry-elements/moon-halo.png',
  cypressMoon: '/assets/starry-elements/cypress-moon.png',
  brushBanner: '/assets/starry-elements/brush-banner.png',
  sparkleTrio: '/assets/starry-elements/sparkle-trio.png',
  windEddy: '/assets/starry-elements/wind-eddy.png',
  swirlOrb: '/assets/starry-elements/swirl-orb.png',
  vignettePatch: '/assets/starry-elements/vignette-patch.png',
  starDiamond: '/assets/starry-elements/star-diamond.png',
  starryCloud: '/assets/starry-elements/starry-cloud.png',
  waveCurrent: '/assets/starry-elements/wave-current.png',
  crescentCutout: '/assets/starry-elements/crescent-cutout.png',
} as const;

export const CUTOUT_VIVID_CLASS =
  'saturate-125 contrast-110 drop-shadow-sm';

/**
 * Single, distinct painted Starry Night focal cutout per workspace section header
 * so each view has one clear artistic anchor without visual crowding.
 */
export const StarryHeaderAccent: React.FC<{
  variant: 'srs' | 'vocabulary' | 'gallery' | 'analytics';
  className?: string;
}> = ({ variant, className = 'flex' }) => {
  if (variant === 'gallery') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none items-center shrink-0 ${className}`}
      >
        <img
          src={STARRY_CUTOUTS.moonHalo}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          className={`h-12 sm:h-15 w-auto object-contain opacity-100 ${CUTOUT_VIVID_CLASS}`}
        />
      </div>
    );
  }

  if (variant === 'vocabulary') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none items-center shrink-0 ${className}`}
      >
        <img
          src={STARRY_CUTOUTS.swirlRibbon}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          className={`h-11 sm:h-14 w-auto object-contain opacity-100 ${CUTOUT_VIVID_CLASS}`}
        />
      </div>
    );
  }

  if (variant === 'analytics') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none items-center shrink-0 ${className}`}
      >
        <img
          src={STARRY_CUTOUTS.windEddy}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          className={`h-12 sm:h-16 w-auto object-contain opacity-100 ${CUTOUT_VIVID_CLASS}`}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none items-center shrink-0 ${className}`}
    >
      <img
        src={STARRY_CUTOUTS.brushBanner}
        alt=""
        referrerPolicy="no-referrer"
        decoding="async"
        className={`h-11 sm:h-13 w-auto object-contain opacity-100 ${CUTOUT_VIVID_CLASS}`}
      />
    </div>
  );
};
