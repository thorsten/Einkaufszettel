export interface VoiceResult {
  transcript: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface VoiceWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export function isVoiceSupported(
  w: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): boolean {
  if (!w) return false;
  const v = w as unknown as VoiceWindow;
  return Boolean(v.SpeechRecognition || v.webkitSpeechRecognition);
}

export interface VoiceListenOptions {
  lang?: string;
  onResult: (r: VoiceResult) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
  factory?: () => SpeechRecognitionLike | null;
}

export function startVoice(opts: VoiceListenOptions): { stop: () => void } | null {
  const make =
    opts.factory ??
    (() => {
      if (typeof window === 'undefined') return null;
      const v = window as unknown as VoiceWindow;
      const Ctor = v.SpeechRecognition ?? v.webkitSpeechRecognition;
      return Ctor ? new Ctor() : null;
    });

  const rec = make();
  if (!rec) {
    opts.onError?.('not-supported');
    return null;
  }

  rec.lang = opts.lang ?? 'de-DE';
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    const first = e.results?.[0]?.[0];
    const transcript = first?.transcript?.trim();
    if (transcript) opts.onResult({ transcript });
  };
  rec.onerror = (e) => opts.onError?.(e.error ?? 'unknown');
  rec.onend = () => opts.onEnd?.();

  rec.start();
  return { stop: () => rec.stop() };
}
