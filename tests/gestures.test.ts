import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachPullToRefresh, attachSwipeLeft } from '../src/gestures';

function pe(type: string, init: Partial<PointerEvent> = {}): PointerEvent {
  const evt = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(evt, {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    ...init,
  });
  return evt;
}

describe('attachSwipeLeft', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  it('commits when dx exceeds negative threshold', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    attachSwipeLeft(el, { threshold: 50, onCommit, onCancel });
    el.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientX: 30, clientY: 50 }));
    el.dispatchEvent(pe('pointerup', { clientX: 30, clientY: 50 }));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels when dx below threshold', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    attachSwipeLeft(el, { threshold: 100, onCommit, onCancel });
    el.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientX: 70, clientY: 50 }));
    el.dispatchEvent(pe('pointerup', { clientX: 70, clientY: 50 }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels on vertical scroll', () => {
    const onCancel = vi.fn();
    attachSwipeLeft(el, { onCancel });
    el.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientX: 99, clientY: 100 }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('reports negative dx via onMove', () => {
    const onMove = vi.fn();
    attachSwipeLeft(el, { onMove });
    el.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientX: 60, clientY: 50 }));
    expect(onMove).toHaveBeenLastCalledWith(-40);
  });

  it('detach removes handlers', () => {
    const onMove = vi.fn();
    const detach = attachSwipeLeft(el, { onMove });
    detach();
    el.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientX: 60, clientY: 50 }));
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('attachPullToRefresh', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  it('commits when dy exceeds threshold', () => {
    const onCommit = vi.fn();
    attachPullToRefresh(el, {
      isAtTop: () => true,
      threshold: 50,
      onCommit,
    });
    el.dispatchEvent(pe('pointerdown', { clientY: 10 }));
    el.dispatchEvent(pe('pointermove', { clientY: 80 }));
    el.dispatchEvent(pe('pointerup', { clientY: 80 }));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('does not start when not at top', () => {
    const onMove = vi.fn();
    attachPullToRefresh(el, {
      isAtTop: () => false,
      onMove,
    });
    el.dispatchEvent(pe('pointerdown', { clientY: 10 }));
    el.dispatchEvent(pe('pointermove', { clientY: 100 }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('cancels on upward drag', () => {
    const onCancel = vi.fn();
    attachPullToRefresh(el, {
      isAtTop: () => true,
      onCancel,
    });
    el.dispatchEvent(pe('pointerdown', { clientY: 50 }));
    el.dispatchEvent(pe('pointermove', { clientY: 30 }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('reports ratio capped at 1', () => {
    const onMove = vi.fn();
    attachPullToRefresh(el, {
      isAtTop: () => true,
      threshold: 50,
      onMove,
    });
    el.dispatchEvent(pe('pointerdown', { clientY: 0 }));
    el.dispatchEvent(pe('pointermove', { clientY: 200 }));
    expect(onMove).toHaveBeenLastCalledWith(200, 1);
  });
});
