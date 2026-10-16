import { describe, expect, test } from 'vitest';
import { createModeController } from './mode-controller';

describe('mode selection through the background boundary', () => {
  test('applies and persists a requested mode', async () => {
    let stored: unknown = 'system';
    let active: unknown = 'system';
    const controller = createModeController({
      read: async () => stored,
      write: async (mode) => { stored = mode; },
      apply: async (mode) => { active = mode; },
    });

    await controller.ready;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct' })).resolves.toEqual({ mode: 'direct' });
    expect(stored).toBe('direct');
    expect(active).toBe('direct');
  });

  test('restores the saved mode after the background restarts', async () => {
    let active: unknown;
    const controller = createModeController({
      read: async () => 'direct',
      write: async () => {},
      apply: async (mode) => { active = mode; },
    });
    await controller.ready;
    expect(active).toBe('direct');
    await expect(controller.handle({ type: 'get-mode' })).resolves.toEqual({ mode: 'direct' });
  });

  test('rolls back the active mode when saving fails and allows retry', async () => {
    let active: unknown = 'system';
    let fail = true;
    const controller = createModeController({
      read: async () => 'system',
      write: async () => { if (fail) throw new Error('disk full'); },
      apply: async (mode) => { active = mode; },
    });
    await controller.ready;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct' })).rejects.toThrow('save-failed');
    expect(active).toBe('system');
    await expect(controller.handle({ type: 'get-mode' })).resolves.toEqual({ mode: 'system' });
    fail = false;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct' })).resolves.toEqual({ mode: 'direct' });
  });

  test.each([null, {}, { type: 'set-mode', mode: 'pac_script' }])('rejects invalid requests without changing the mode: %j', async (message) => {
    let active: unknown;
    const controller = createModeController({
      read: async () => 'system', write: async () => {},
      apply: async (mode) => { active = mode; },
    });
    await controller.ready;
    await expect(controller.handle(message)).rejects.toThrow('invalid-request');
    expect(active).toBe('system');
  });

  test('does not overwrite unsupported stored configuration', async () => {
    const applied: string[] = [];
    const controller = createModeController({
      read: async () => ({ old: 'config' }), write: async () => {},
      apply: async (mode) => { applied.push(mode); },
    });
    await expect(controller.ready).rejects.toThrow('invalid-config');
    expect(applied).toEqual([]);
  });

  test('retries initialization after proxy control becomes available', async () => {
    let blocked = true;
    const controller = createModeController({
      read: async () => 'system', write: async () => {},
      apply: async () => { if (blocked) throw new Error('proxy-unavailable'); },
    });
    await expect(controller.ready).rejects.toThrow('proxy-unavailable');
    blocked = false;
    await expect(controller.handle({ type: 'get-mode' })).resolves.toEqual({ mode: 'system' });
  });
});
