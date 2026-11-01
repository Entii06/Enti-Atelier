export type BuiltinNoiseType = 'off' | 'rain' | 'wind';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playSessionChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Warm major-9th harp-bell arpeggio (C5, E5, G5, D6)
  const frequencies = [523.25, 659.25, 783.99, 1174.66];

  frequencies.forEach((freq, idx) => {
    const start = now + idx * 0.14;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14 / (idx * 0.35 + 1), start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 2.2);
  });
}

export function playPiecePlaceChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [587.33, 783.99, 1046.5];

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.065;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09 / (idx * 0.3 + 1), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.5);
  });
}

class AmbientStudioSound {
  private sourceNode: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private currentType: BuiltinNoiseType = 'off';
  private volume: number = 0.5;

  public setSound(type: BuiltinNoiseType, volume: number = this.volume): void {
    this.volume = volume;
    if (type === this.currentType) {
      if (this.gainNode && sharedAudioCtx) {
        this.gainNode.gain.setTargetAtTime(
          type === 'off' ? 0 : this.volume * 0.22,
          sharedAudioCtx.currentTime,
          0.15
        );
      }
      return;
    }

    this.stop();
    this.currentType = type;
    if (type === 'off') return;

    const ctx = getAudioContext();
    if (!ctx) return;

    // Create 4-second pink/brownian noise buffer
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.2;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    if (type === 'rain') {
      // Soft evening rain in Arles
      filter.type = 'bandpass';
      filter.frequency.value = 920;
      filter.Q.value = 0.55;
    } else {
      // Gentle Provençal wheatfield breeze
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      filter.Q.value = 0.9;

      // Subtle slow breeze modulation
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.lfoOsc = lfo;
      this.lfoGain = lfoGain;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.22, ctx.currentTime + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    this.sourceNode = noise;
    this.filterNode = filter;
    this.gainNode = gain;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && sharedAudioCtx && this.currentType !== 'off') {
      this.gainNode.gain.setTargetAtTime(
        this.volume * 0.22,
        sharedAudioCtx.currentTime,
        0.1
      );
    }
  }

  public stop(): void {
    try {
      if (this.sourceNode) {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      }
      if (this.lfoOsc) {
        this.lfoOsc.stop();
        this.lfoOsc.disconnect();
      }
      if (this.lfoGain) this.lfoGain.disconnect();
      if (this.filterNode) this.filterNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
    } catch {
      // Ignore already stopped audio nodes
    }
    this.sourceNode = null;
    this.lfoOsc = null;
    this.lfoGain = null;
    this.filterNode = null;
    this.gainNode = null;
    this.currentType = 'off';
  }
}

export const ambientSound = new AmbientStudioSound();

export type PronunciationAccent = 'uk' | 'us';

let activePronunciationAudio: HTMLAudioElement | null = null;
let activePronunciationObjectUrl: string | null = null;
let activePronunciationAbort: AbortController | null = null;

export function stopDictionaryPronunciation(): void {
  activePronunciationAbort?.abort();
  activePronunciationAbort = null;

  if (activePronunciationAudio) {
    try {
      activePronunciationAudio.onended = null;
      activePronunciationAudio.onerror = null;
      activePronunciationAudio.pause();
    } catch {
      // Ignore cleanup errors
    }
    activePronunciationAudio = null;
  }

  if (activePronunciationObjectUrl) {
    try {
      URL.revokeObjectURL(activePronunciationObjectUrl);
    } catch {
      // Ignore revoke errors
    }
    activePronunciationObjectUrl = null;
  }
}

export function speakEnglish(
  text: string,
  rate: number = 0.94,
  accent: PronunciationAccent = 'us'
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
    utterance.lang = targetLang;
    utterance.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const matchingAccentVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(targetLang.toLowerCase()) &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Daniel') ||
            v.name.includes('Samantha'))
      ) ||
      voices.find((v) =>
        v.lang.toLowerCase().startsWith(targetLang.toLowerCase())
      );

    const fallbackEnglishVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel'))
      ) || voices.find((v) => v.lang.startsWith('en'));

    const chosenVoice = matchingAccentVoice || fallbackEnglishVoice;
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speechSynthesis runtime errors
  }
}

export async function playDictionaryPronunciation(
  word: string,
  accent: PronunciationAccent = 'us',
  preferredUrl?: string
): Promise<void> {
  const cleanedWord = word.trim().replace(/\s+/g, ' ');
  if (!cleanedWord) return;

  stopDictionaryPronunciation();

  const controller = new AbortController();
  activePronunciationAbort = controller;

  const safeEndpoint =
    preferredUrl && preferredUrl.startsWith('/api/dictionary/audio')
      ? preferredUrl
      : `/api/dictionary/audio?word=${encodeURIComponent(
          cleanedWord
        )}&accent=${accent}`;

  try {
    const res = await fetch(safeEndpoint, { signal: controller.signal });
    if (controller.signal.aborted) return;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('audio')) {
      speakEnglish(cleanedWord, 0.94, accent);
      return;
    }

    const rawBlob = await res.blob();
    if (controller.signal.aborted) return;

    if (rawBlob.size < 256) {
      speakEnglish(cleanedWord, 0.94, accent);
      return;
    }

    const audioBlob = rawBlob.type.includes('audio')
      ? rawBlob
      : new Blob([rawBlob], { type: 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(audioBlob);
    activePronunciationObjectUrl = objectUrl;

    const player = new Audio();
    player.preload = 'auto';
    player.src = objectUrl;
    activePronunciationAudio = player;

    const cleanupCurrent = () => {
      if (activePronunciationObjectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        activePronunciationObjectUrl = null;
      }
      if (activePronunciationAudio === player) {
        activePronunciationAudio = null;
      }
    };

    player.onended = cleanupCurrent;
    player.onerror = () => {
      cleanupCurrent();
      speakEnglish(cleanedWord, 0.94, accent);
    };

    await player.play();
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return;
    }
    speakEnglish(cleanedWord, 0.94, accent);
  }
}
