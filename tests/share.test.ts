import { describe, expect, it, vi } from 'vitest';
import { shareMarkdown } from '../src/share';

describe('shareMarkdown', () => {
  it('uses navigator.share when canShare returns true', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const nav = { share, canShare } as unknown as Navigator;
    const result = await shareMarkdown('list.md', '# ALDI\n', { navigator: nav });
    expect(result).toBe('shared');
    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
  });

  it('returns shared on AbortError', async () => {
    const err = new Error('user cancelled');
    err.name = 'AbortError';
    const nav = {
      canShare: vi.fn().mockReturnValue(true),
      share: vi.fn().mockRejectedValue(err),
    } as unknown as Navigator;
    const result = await shareMarkdown('list.md', '# X\n', { navigator: nav });
    expect(result).toBe('shared');
  });

  it('falls back to download when canShare returns false', async () => {
    const click = vi.fn();
    const a = { click, set href(_v: string) {}, set download(_v: string) {} };
    const doc = {
      createElement: vi.fn().mockReturnValue(a),
    } as unknown as Document;
    const nav = {
      canShare: vi.fn().mockReturnValue(false),
      share: vi.fn(),
    } as unknown as Navigator;
    const result = await shareMarkdown('list.md', '# X\n', {
      navigator: nav,
      document: doc,
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => {},
    });
    expect(result).toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
  });

  it('falls back when navigator missing', async () => {
    const click = vi.fn();
    const a = { click, set href(_v: string) {}, set download(_v: string) {} };
    const doc = { createElement: vi.fn().mockReturnValue(a) } as unknown as Document;
    const result = await shareMarkdown('list.md', '# X\n', {
      navigator: undefined,
      document: doc,
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => {},
    });
    expect(result).toBe('downloaded');
  });
});
