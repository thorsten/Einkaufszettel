export interface SwipeHandlers {
  onMove?: (dx: number) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  threshold?: number;
}

const VERT_LOCK = 12;

export function attachSwipeLeft(el: HTMLElement, h: SwipeHandlers): () => void {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let active = false;
  let pointerId = -1;
  const threshold = h.threshold ?? 80;

  const cancel = () => {
    if (!active) return;
    active = false;
    h.onCancel?.();
    if (pointerId !== -1 && el.hasPointerCapture?.(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    pointerId = -1;
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    active = true;
    pointerId = e.pointerId;
  };

  const move = (e: PointerEvent) => {
    if (!active || e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    dx = e.clientX - startX;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VERT_LOCK) {
      cancel();
      return;
    }
    if (
      Math.abs(dx) > VERT_LOCK / 2 &&
      el.setPointerCapture &&
      !el.hasPointerCapture?.(pointerId)
    ) {
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    if (dx < 0) h.onMove?.(dx);
    else h.onMove?.(0);
  };

  const up = (e: PointerEvent) => {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    if (dx <= -threshold) {
      h.onCommit?.();
    } else {
      h.onCancel?.();
    }
    if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
    pointerId = -1;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);

  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

export interface PullHandlers {
  isAtTop: () => boolean;
  onMove?: (dy: number, ratio: number) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  threshold?: number;
}

export function attachPullToRefresh(el: HTMLElement, h: PullHandlers): () => void {
  let startY = 0;
  let dy = 0;
  let active = false;
  let pointerId = -1;
  const threshold = h.threshold ?? 70;

  const cancel = () => {
    if (!active) return;
    active = false;
    h.onCancel?.();
    pointerId = -1;
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!h.isAtTop()) return;
    startY = e.clientY;
    dy = 0;
    active = true;
    pointerId = e.pointerId;
  };

  const move = (e: PointerEvent) => {
    if (!active || e.pointerId !== pointerId) return;
    dy = e.clientY - startY;
    if (dy < 0) {
      cancel();
      return;
    }
    h.onMove?.(dy, Math.min(1, dy / threshold));
  };

  const up = (e: PointerEvent) => {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    if (dy >= threshold) {
      h.onCommit?.();
    } else {
      h.onCancel?.();
    }
    pointerId = -1;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);

  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
