import { describe, expect, it, vi } from 'vitest';
import {
  buildShareUrl,
  CONFIG_HASH_KEY,
  decodeConfig,
  encodeConfig,
  readConfigFromHash,
  shareConfigLink,
} from '../src/config-link';

const sampleConfig = {
  url: 'https://abcdefghij.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
  household: 'b3a7f2e1-9c4d-4f12-aaaa-1234567890ab',
};

describe('encodeConfig / decodeConfig', () => {
  it('round-trips full config', () => {
    const payload = encodeConfig(sampleConfig);
    expect(decodeConfig(payload)).toEqual(sampleConfig);
  });

  it('round-trips unicode in fields', () => {
    const cfg = { ...sampleConfig, household: 'haus-äöü-ß-🏡' };
    expect(decodeConfig(encodeConfig(cfg))).toEqual(cfg);
  });

  it('produces base64url (no +/= /=)', () => {
    const payload = encodeConfig(sampleConfig);
    expect(payload).not.toMatch(/[+/=]/);
  });

  it('decodes empty string to null', () => {
    expect(decodeConfig('')).toBeNull();
  });

  it('decodes garbage to null', () => {
    expect(decodeConfig('!!!not-base64!!!')).toBeNull();
  });

  it('decodes valid base64 of non-JSON to null', () => {
    expect(decodeConfig(btoa('not json').replace(/=+$/, ''))).toBeNull();
  });

  it('rejects partial config (missing field)', () => {
    const partial = btoa(JSON.stringify({ u: 'x', k: 'y' })).replace(/=+$/, '');
    expect(decodeConfig(partial)).toBeNull();
  });

  it('rejects empty-string fields', () => {
    const empty = encodeConfig({ url: '', anonKey: 'k', household: 'h' });
    expect(decodeConfig(empty)).toBeNull();
  });
});

describe('buildShareUrl', () => {
  it('appends hash with payload', () => {
    const url = buildShareUrl('https://example.com/app/', sampleConfig);
    expect(url).toMatch(new RegExp(`^https://example\\.com/app/#${CONFIG_HASH_KEY}=`));
  });

  it('strips existing hash from baseUrl', () => {
    const url = buildShareUrl('https://example.com/#stale', sampleConfig);
    expect(url.split('#')).toHaveLength(2);
    expect(url).not.toContain('#stale');
  });
});

describe('readConfigFromHash', () => {
  it('parses #cfg=... back to credentials', () => {
    const url = buildShareUrl('https://example.com/', sampleConfig);
    const hash = '#' + url.split('#')[1];
    expect(readConfigFromHash(hash)).toEqual(sampleConfig);
  });

  it('handles hash without #', () => {
    const payload = encodeConfig(sampleConfig);
    expect(readConfigFromHash(`${CONFIG_HASH_KEY}=${payload}`)).toEqual(sampleConfig);
  });

  it('returns null for empty hash', () => {
    expect(readConfigFromHash('')).toBeNull();
  });

  it('returns null when key not present', () => {
    expect(readConfigFromHash('#other=value')).toBeNull();
  });

  it('returns null for malformed payload', () => {
    expect(readConfigFromHash(`#${CONFIG_HASH_KEY}=abc!!!`)).toBeNull();
  });
});

describe('shareConfigLink', () => {
  it('uses navigator.share when available and accepts URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const nav = { share, canShare } as unknown as Navigator;
    const result = await shareConfigLink('https://e.x/#cfg=abc', { navigator: nav });
    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('falls back to clipboard when share is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav = { clipboard: { writeText } } as unknown as Navigator;
    const result = await shareConfigLink('url', { navigator: nav });
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('url');
  });

  it('falls back to prompt when share + clipboard missing', async () => {
    const prompt = vi.fn().mockReturnValue(null);
    const nav = {} as unknown as Navigator;
    const result = await shareConfigLink('url', { navigator: nav, prompt });
    expect(result).toBe('prompted');
    expect(prompt).toHaveBeenCalled();
  });

  it('returns shared on AbortError from navigator.share', async () => {
    const err = new Error('cancel');
    err.name = 'AbortError';
    const nav = {
      share: vi.fn().mockRejectedValue(err),
      canShare: vi.fn().mockReturnValue(true),
    } as unknown as Navigator;
    expect(await shareConfigLink('u', { navigator: nav })).toBe('shared');
  });
});
