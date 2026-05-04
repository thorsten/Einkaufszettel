import { describe, expect, it, vi } from 'vitest';
import { isVoiceSupported, startVoice, type SpeechRecognitionLike } from '../src/voice';

function makeRecognition(): SpeechRecognitionLike {
  return {
    lang: '',
    interimResults: false,
    continuous: false,
    maxAlternatives: 0,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  };
}

describe('isVoiceSupported', () => {
  it('false when no global', () => {
    expect(isVoiceSupported(undefined)).toBe(false);
  });

  it('true when SpeechRecognition present', () => {
    const w = { SpeechRecognition: function () {} } as unknown as Window;
    expect(isVoiceSupported(w)).toBe(true);
  });
});

describe('startVoice', () => {
  it('returns null and reports error when factory yields nothing', () => {
    const onError = vi.fn();
    const result = startVoice({ onResult: vi.fn(), onError, factory: () => null });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith('not-supported');
  });

  it('starts recognition, surfaces transcripts via onResult', () => {
    const rec = makeRecognition();
    const onResult = vi.fn();
    const handle = startVoice({ onResult, factory: () => rec, lang: 'de-DE' });
    expect(handle).not.toBeNull();
    expect(rec.lang).toBe('de-DE');
    expect(rec.start).toHaveBeenCalledOnce();

    rec.onresult?.({
      results: [[{ transcript: '  Milch  ' }]] as unknown as ArrayLike<
        ArrayLike<{ transcript: string }>
      >,
    });
    expect(onResult).toHaveBeenCalledWith({ transcript: 'Milch' });
  });

  it('forwards errors and end', () => {
    const rec = makeRecognition();
    const onError = vi.fn();
    const onEnd = vi.fn();
    startVoice({ onResult: vi.fn(), onError, onEnd, factory: () => rec });
    rec.onerror?.({ error: 'no-speech' });
    rec.onend?.();
    expect(onError).toHaveBeenCalledWith('no-speech');
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('stop() forwards to recognition', () => {
    const rec = makeRecognition();
    const handle = startVoice({ onResult: vi.fn(), factory: () => rec });
    handle?.stop();
    expect(rec.stop).toHaveBeenCalledOnce();
  });
});
