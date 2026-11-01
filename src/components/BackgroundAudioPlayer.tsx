import React, { useCallback, useEffect, useRef } from 'react';
import { Minimize2, Tv } from 'lucide-react';
import { SoundTrack } from '../types';
import { ambientSound } from '../utils/audio';

interface BackgroundAudioPlayerProps {
  activeTrack: SoundTrack | undefined;
  volume: number;
  showYoutubeMiniPlayer: boolean;
  onCloseYoutubeMiniPlayer: () => void;
  onPlaybackError: (msg: string | null) => void;
}

export const BackgroundAudioPlayer: React.FC<BackgroundAudioPlayerProps> = ({
  activeTrack,
  volume,
  showYoutubeMiniPlayer,
  onCloseYoutubeMiniPlayer,
  onPlaybackError,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  const postYoutubeCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      const win = ytIframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          JSON.stringify({
            event: 'command',
            func,
            args,
          }),
          '*'
        );
      } catch {
        // Ignore cross-origin frame postMessage errors
      }
    },
    []
  );

  // Sync procedural Web Audio volume & state
  useEffect(() => {
    if (activeTrack?.kind === 'builtin_rain') {
      ambientSound.setSound('rain', volume);
      onPlaybackError(null);
    } else if (activeTrack?.kind === 'builtin_wind') {
      ambientSound.setSound('wind', volume);
      onPlaybackError(null);
    } else {
      ambientSound.stop();
    }
  }, [activeTrack, volume, onPlaybackError]);

  // Sync HTML5 <audio> for MP3 / direct audio links
  useEffect(() => {
    const el = audioRef.current;
    if (!el || activeTrack?.kind !== 'mp3') return;
    el.volume = Math.max(0, Math.min(1, volume));
  }, [activeTrack, volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || activeTrack?.kind !== 'mp3' || !activeTrack.url) return;
    onPlaybackError(null);
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch((err: unknown) => {
      const errName = (err as { name?: string })?.name;
      if (errName === 'NotSupportedError') {
        onPlaybackError(
          'Không thể phát file MP3 từ đường dẫn này. Vui lòng kiểm tra lại link trực tiếp (.mp3).'
        );
      }
    });
  }, [activeTrack?.id, activeTrack?.kind, activeTrack?.url]);

  // Sync YouTube volume via IFrame API postMessage
  useEffect(() => {
    if (activeTrack?.kind !== 'youtube') return;
    postYoutubeCommand('setVolume', [Math.round(volume * 100)]);
    if (volume <= 0.001) {
      postYoutubeCommand('mute');
    } else {
      postYoutubeCommand('unMute');
    }
  }, [activeTrack?.kind, volume, postYoutubeCommand]);

  // Listen to YouTube ENDED state (0) so single songs loop seamlessly
  useEffect(() => {
    if (activeTrack?.kind !== 'youtube') return;

    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('youtube')
      ) {
        return;
      }
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          info?: { playerState?: number };
        };
        if (
          parsed.event === 'infoDelivery' &&
          parsed.info?.playerState === 0
        ) {
          postYoutubeCommand('seekTo', [0, true]);
          postYoutubeCommand('playVideo');
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeTrack?.kind, postYoutubeCommand]);

  const handleYoutubeIframeLoad = () => {
    onPlaybackError(null);
    const win = ytIframeRef.current?.contentWindow;
    if (win) {
      try {
        win.postMessage(JSON.stringify({ event: 'listening' }), '*');
      } catch {
        // Ignore
      }
    }
    postYoutubeCommand('unMute');
    postYoutubeCommand('setVolume', [Math.round(volume * 100)]);
    postYoutubeCommand('playVideo');
  };

  const originParam =
    typeof window !== 'undefined'
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  return (
    <>
      {activeTrack?.kind === 'mp3' && activeTrack.url && (
        <audio
          key={activeTrack.id}
          ref={audioRef}
          src={activeTrack.url}
          loop
          preload="metadata"
          className="hidden"
          onPlaying={() => onPlaybackError(null)}
          onError={() =>
            onPlaybackError(
              'Không thể phát file MP3 từ đường dẫn này. Vui lòng kiểm tra lại link trực tiếp (.mp3).'
            )
          }
        />
      )}

      {activeTrack?.kind === 'youtube' && activeTrack.youtubeId && (
        <div
          className={
            showYoutubeMiniPlayer
              ? 'fixed bottom-20 right-4 sm:right-8 z-40 w-72 sm:w-80 rounded-2xl overflow-hidden bg-stone-950/95 backdrop-blur-xl border border-white/20 shadow-2xl text-white'
              : 'fixed -left-[9999px] bottom-0 w-72 h-40 opacity-0 pointer-events-none overflow-hidden'
          }
        >
          {showYoutubeMiniPlayer && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/15 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium truncate">
                <Tv className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">{activeTrack.title}</span>
              </span>
              <button
                type="button"
                onClick={onCloseYoutubeMiniPlayer}
                title="Ẩn khung hình (nhạc vẫn phát nền)"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-white/85 hover:text-white shrink-0 cursor-pointer"
              >
                <Minimize2 className="w-3 h-3" />
                <span>Ẩn khung</span>
              </button>
            </div>
          )}

          <div className="w-full aspect-video bg-black">
            <iframe
              key={activeTrack.id}
              ref={ytIframeRef}
              src={`https://www.youtube.com/embed/${activeTrack.youtubeId}?autoplay=1&loop=1&playlist=${activeTrack.youtubeId}&enablejsapi=1&playsinline=1&rel=0${originParam}`}
              title={activeTrack.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              onLoad={handleYoutubeIframeLoad}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
};
