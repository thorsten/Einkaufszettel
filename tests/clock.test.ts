import { describe, expect, it } from 'vitest';
import { Lamport } from '../src/clock';

describe('Lamport', () => {
  it('starts at zero by default', () => {
    expect(new Lamport().current()).toBe(0);
  });

  it('starts at given initial', () => {
    expect(new Lamport(7).current()).toBe(7);
  });

  it('tick increments and returns new value', () => {
    const c = new Lamport(2);
    expect(c.tick()).toBe(3);
    expect(c.current()).toBe(3);
  });

  it('observe takes max', () => {
    const c = new Lamport(5);
    c.observe(3);
    expect(c.current()).toBe(5);
    c.observe(10);
    expect(c.current()).toBe(10);
  });

  it('observe ignores non-finite', () => {
    const c = new Lamport(5);
    c.observe(Number.NaN);
    c.observe(Number.POSITIVE_INFINITY);
    expect(c.current()).toBe(5);
  });

  it('tick after observe yields strictly larger value', () => {
    const c = new Lamport(0);
    c.observe(8);
    expect(c.tick()).toBe(9);
  });
});
