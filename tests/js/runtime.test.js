import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimePath = path.resolve(process.cwd(), 'assets/frontend/js/runtime.js');
const runtimeSource = readFileSync(runtimePath, 'utf8');

function loadRuntime() {
  window.LegacyPopupsFrontend = { popups: [] };
  window.__LEGACY_POPUPS_TEST__ = true;
  delete window.LegacyPopupsRuntimeTest;
  window.eval(runtimeSource);
  return window.LegacyPopupsRuntimeTest;
}

describe('LegacyPopups frontend runtime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    document.body.innerHTML = '';
    document.cookie = 'legacy-test=; Max-Age=0; path=/';
  });

  it('registers default page-load triggers when a popup has no explicit triggers', () => {
    const runtime = loadRuntime();
    const scheduled = [];
    const engine = runtime.createTriggerEngine({
      schedule(popup) {
        scheduled.push(popup.id);
      },
    });

    engine.register([{ id: 7, title: 'Default trigger popup' }]);

    expect(scheduled).toEqual([7]);
  });

  it('honors time-delay triggers via setTimeout', () => {
    const runtime = loadRuntime();
    const schedule = vi.fn();
    const timeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
      callback();
      return delay;
    });
    const engine = runtime.createTriggerEngine({ schedule });

    engine.register([{ id: 11, triggers: [{ type: 'time_delay', seconds: 2 }] }]);

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
  });

  it('blocks a session-once popup after impression is recorded', () => {
    const runtime = loadRuntime();
    const gate = runtime.createFrequencyGate();
    const payload = {
      id: 15,
      frequency: {
        storage: { session: true, local: true, cookieFallback: false },
        events: {
          impression: { sessionOnce: true, oncePerPeriod: false, periodDays: 0, maxCount: 0 },
        },
      },
    };

    expect(gate.canDisplay(payload)).toBe(true);

    gate.record(payload, 'impression');

    expect(gate.canDisplay(payload)).toBe(false);
  });

  it('enforces maxCount within the configured period', () => {
    const runtime = loadRuntime();
    const gate = runtime.createFrequencyGate();
    const payload = {
      id: 22,
      frequency: {
        storage: { session: true, local: true, cookieFallback: false },
        events: {
          impression: { sessionOnce: false, oncePerPeriod: false, periodDays: 7, maxCount: 2 },
        },
      },
    };

    gate.record(payload, 'impression');
    expect(gate.canDisplay(payload)).toBe(true);

    gate.record(payload, 'impression');

    expect(gate.canDisplay(payload)).toBe(false);
  });
});