import { describe, expect, test } from 'vitest';
import { createRequestMonitor } from './request-monitor';

describe('request monitoring', () => {
  test('reports a domain without retaining URL secrets and recovers a timeout', () => {
    const monitor = createRequestMonitor();
    monitor.start({ tabId: 1, requestId: 'a', url: 'https://example.com/?token=secret', type: 'main_frame', timeStamp: 0 });
    expect(monitor.read(1, 30_001)).toEqual({ pending: 0, completed: 0, failed: 0, timeout: 1, domains: ['example.com'] });
    monitor.finish(1, 'a');
    expect(monitor.read(1, 30_002)).toEqual({ pending: 0, completed: 1, failed: 0, timeout: 0, domains: [] });
  });
  test('bounds records and resets navigation, closed tabs, and new background sessions', () => {
    const monitor = createRequestMonitor();
    for (let i = 0; i < 1002; i++) monitor.start({ tabId: 1, requestId: String(i), url: 'https://example.com/', type: 'image', timeStamp: 0 });
    expect(monitor.read(1, 0).pending).toBe(1000);
    monitor.start({ tabId: 1, requestId: 'navigation', url: 'https://next.example/', type: 'main_frame', timeStamp: 0 });
    expect(monitor.read(1, 0).pending).toBe(1);
    monitor.remove(1);
    expect(monitor.read(1, 0).pending).toBe(0);
    expect(createRequestMonitor().read(1, 0).pending).toBe(0);
  });
  test.each(['net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CLIENT', 'NS_BINDING_ABORTED', 'NS_ERROR_TRACKING_URI'])('does not call cancellation or blocking a failure: %s', error => {
    const monitor = createRequestMonitor();
    monitor.start({ tabId: 1, requestId: 'a', url: 'https://example.com/', type: 'image', timeStamp: 0 });
    monitor.finish(1, 'a', error);
    expect(monitor.read(1, 100_000)).toEqual({ pending: 0, completed: 0, failed: 0, timeout: 0, domains: [] });
  });
  test('reports network failures without claiming their cause', () => {
    const monitor = createRequestMonitor();
    monitor.start({ tabId: 1, requestId: 'a', url: 'https://example.com/', type: 'image', timeStamp: 0 });
    monitor.finish(1, 'a', 'net::ERR_CONNECTION_REFUSED');
    expect(monitor.read(1, 0).failed).toBe(1);
    expect(monitor.read(1, 0).domains).toEqual(['example.com']);
  });
  test('preserves a network history navigation but clears a restored cached page', () => {
    const monitor = createRequestMonitor();
    monitor.start({ tabId: 1, requestId: 'document', url: 'https://example.com/', type: 'main_frame', timeStamp: 0 });
    monitor.commit(1, true);
    expect(monitor.read(1, 1).pending).toBe(1);
    monitor.finish(1, 'document');
    monitor.commit(1, true);
    expect(monitor.read(1, 2).completed).toBe(0);
  });
});
