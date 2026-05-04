export const CONFIG_HASH_KEY = 'cfg';

export interface CloudCredentials {
  url: string;
  anonKey: string;
  household: string;
}

interface Compact {
  u: string;
  k: string;
  h: string;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const padded = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeConfig(c: CloudCredentials): string {
  const compact: Compact = { u: c.url, k: c.anonKey, h: c.household };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeConfig(payload: string): CloudCredentials | null {
  if (!payload) return null;
  try {
    const json = fromBase64Url(payload);
    const parsed = JSON.parse(json) as Partial<Compact>;
    if (
      typeof parsed.u !== 'string' ||
      typeof parsed.k !== 'string' ||
      typeof parsed.h !== 'string'
    ) {
      return null;
    }
    if (!parsed.u || !parsed.k || !parsed.h) return null;
    return { url: parsed.u, anonKey: parsed.k, household: parsed.h };
  } catch {
    return null;
  }
}

export function buildShareUrl(baseUrl: string, c: CloudCredentials): string {
  const noHash = baseUrl.split('#')[0];
  return `${noHash}#${CONFIG_HASH_KEY}=${encodeConfig(c)}`;
}

export function readConfigFromHash(hash: string): CloudCredentials | null {
  if (!hash) return null;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const payload = params.get(CONFIG_HASH_KEY);
  if (!payload) return null;
  return decodeConfig(payload);
}

export interface ShareLinkDeps {
  navigator?: Pick<Navigator, 'share' | 'canShare' | 'clipboard'> & Partial<Navigator>;
  prompt?: (msg: string, val: string) => string | null;
}

export type ShareLinkResult = 'shared' | 'copied' | 'prompted' | 'failed';

export async function shareConfigLink(
  url: string,
  deps: ShareLinkDeps = {},
): Promise<ShareLinkResult> {
  const nav = deps.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  if (nav && typeof nav.share === 'function') {
    try {
      const data = { url };
      if (typeof nav.canShare !== 'function' || nav.canShare(data)) {
        await nav.share(data);
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(url);
      return 'copied';
    } catch {
      // fall through
    }
  }
  const promptFn =
    deps.prompt ?? (typeof window !== 'undefined' ? window.prompt.bind(window) : null);
  if (promptFn) {
    promptFn('Copy config link:', url);
    return 'prompted';
  }
  return 'failed';
}
