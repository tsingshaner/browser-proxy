import { describe, expect, test } from 'vitest';
import { parseConfig } from '@browser-proxy/core';
import { createModeController } from './mode-controller';

describe('mode selection through the background boundary', () => {
  test('applies and persists a requested mode', async () => {
    let stored: unknown = 'system';
    let active: unknown = 'system';
    const controller = createModeController({
      read: async () => stored,
      write: async (mode) => { stored = mode; },
      apply: async (mode) => { active = mode.mode; },
    });

    await controller.ready;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct', revision: 0 })).resolves.toMatchObject({ mode: 'direct' });
    expect(stored).toMatchObject({ mode: 'direct', revision: 1 });
    expect(active).toBe('direct');
  });

  test('restores the saved mode after the background restarts', async () => {
    let active: unknown;
    const controller = createModeController({
      read: async () => 'direct',
      write: async () => {},
      apply: async (mode) => { active = mode.mode; },
    });
    await controller.ready;
    expect(active).toBe('direct');
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'direct' });
  });

  test('rolls back the active mode when saving fails and allows retry', async () => {
    let active: unknown = 'system';
    let fail = true;
    const controller = createModeController({
      read: async () => 'system',
      write: async () => { if (fail) throw new Error('disk full'); },
      apply: async (mode) => { active = mode.mode; },
    });
    await controller.ready;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct', revision: 0 })).rejects.toThrow('save-failed');
    expect(active).toBe('system');
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'system' });
    fail = false;
    await expect(controller.handle({ type: 'set-mode', mode: 'direct', revision: 0 })).resolves.toMatchObject({ mode: 'direct' });
  });

  test.each([null, {}, { type: 'set-mode', mode: 'pac_script', revision: 0 }])('rejects invalid requests without changing the mode: %j', async (message) => {
    let active: unknown;
    const controller = createModeController({
      read: async () => 'system', write: async () => {},
      apply: async (mode) => { active = mode.mode; },
    });
    await controller.ready;
    await expect(controller.handle(message)).rejects.toThrow('invalid-request');
    expect(active).toBe('system');
  });

  test('does not overwrite unsupported stored configuration', async () => {
    const applied: string[] = [];
    const controller = createModeController({
      read: async () => ({ old: 'config' }), write: async () => {},
      apply: async (mode) => { applied.push(mode.mode); },
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
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'system' });
  });
});


describe('fixed profiles through the background boundary', () => {
  const profile = { id: 'office', name: 'Office', scheme: 'http', host: 'localhost', port: 8080 };
  test('creates, selects, edits, and deletes profiles after switching away', async () => {
    let stored: unknown;
    let active = parseConfig(undefined);
    const controller = createModeController({ read: async () => stored,
      write: async config => { stored = config; }, apply: async config => { active = config; } });
    await controller.handle({ type: 'save-profile', profile, revision: 0 });
    await controller.handle({ type: 'set-mode', mode: 'office', revision: 1 });
    expect(active).toMatchObject({ mode: 'office', profiles: [profile] });
    await controller.handle({ type: 'save-profile', profile: { ...profile, port: 9000 }, revision: 2 });
    expect(active.profiles[0]?.port).toBe(9000);
    await expect(controller.handle({ type: 'delete-profile', id: 'office', revision: 3 })).rejects.toThrow('active-profile');
    await controller.handle({ type: 'set-mode', mode: 'system', revision: 3 });
    await controller.handle({ type: 'delete-profile', id: 'office', revision: 4 });
    expect(stored).toMatchObject({ mode: 'system', profiles: [], revision: 5 });
  });
  test('rejects a stale page without overwriting a newer save', async () => {
    let stored: unknown;
    const controller = createModeController({ read: async () => stored,
      write: async config => { stored = config; }, apply: async () => {} });
    await controller.handle({ type: 'save-profile', profile, revision: 0 });
    await expect(controller.handle({ type: 'save-profile', profile: { ...profile, name: 'Stale' }, revision: 0 })).rejects.toThrow('conflict');
    expect(stored).toMatchObject({ revision: 1, profiles: [profile] });
  });
});

test('saves domain rules, applies automatic routing, and protects referenced profiles', async () => {
  let stored: unknown;
  let active = parseConfig(undefined);
  const controller = createModeController({ read: async () => stored,
    write: async config => { stored = config; }, apply: async config => { active = config; } });
  await controller.handle({ type: 'save-profile', revision: 0, profile: { id: 'office', name: 'Office', scheme: 'http', host: 'localhost', port: 8080 } });
  await controller.handle({ type: 'save-rules', revision: 1, rules: [{ domain: 'EXAMPLE.COM.', target: 'office' }], defaultTarget: 'direct' });
  await controller.handle({ type: 'set-mode', revision: 2, mode: 'auto' });
  expect(active).toMatchObject({ mode: 'auto', rules: [{ domain: 'example.com', target: 'office' }], defaultTarget: 'direct' });
  await expect(controller.handle({ type: 'delete-profile', revision: 3, id: 'office' })).rejects.toThrow('referenced-profile');
  await expect(controller.handle({ type: 'save-rules', revision: 3, rules: [{ domain: 'bad/path', target: 'office' }], defaultTarget: 'direct' })).rejects.toThrow('invalid-rule');
  await expect(controller.handle({ type: 'save-rules', revision: 3 })).rejects.toThrow('invalid-rule');
  expect(stored).toMatchObject({ revision: 3 });
});
