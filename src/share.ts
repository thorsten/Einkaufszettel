export interface ShareDeps {
  navigator?: Pick<Navigator, 'canShare' | 'share'> & Partial<Navigator>;
  document?: Document;
  createObjectURL?: (b: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export type ShareResult = 'shared' | 'downloaded';

export async function shareMarkdown(
  filename: string,
  md: string,
  deps: ShareDeps = {},
): Promise<ShareResult> {
  const nav = deps.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const doc = deps.document ?? (typeof document !== 'undefined' ? document : undefined);
  const blob = new Blob([md], { type: 'text/markdown' });

  if (nav && typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'text/markdown' });
      const data = { files: [file], title: filename };
      if (nav.canShare(data)) {
        await nav.share(data);
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }

  if (doc) {
    const createUrl = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
    const revokeUrl = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
    const url = createUrl(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    revokeUrl(url);
    return 'downloaded';
  }

  return 'downloaded';
}
