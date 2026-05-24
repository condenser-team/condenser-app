/**
 * Verifies the WebSocket RPC layer used by plugin calls.
 *
 * Tests the happy path (successful backend call), error path (unknown plugin),
 * and the disconnected-WebSocket guard in callPlugin.
 */

import { test, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { connectToSteam, findSharedContextPage, isCondenserBooted } from './helpers.js';

let browser: Browser;
let page: Page;
let booted = false;

test.beforeAll(async () => {
  browser = await connectToSteam();
  const p = await findSharedContextPage(browser);
  if (!p) throw new Error('SharedJSContext page not found — is Steam running?');
  page = p;
  booted = await isCondenserBooted(page);
});

test.afterAll(async () => {
  await browser?.close().catch(() => {});
});

test.describe('Plugin RPC', () => {
  test('callPlugin resolves with expected data for a valid action', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(async () => {
      const c = (window as any).__condenser;
      return c.plugins.callPlugin('condenser-system', { action: 'getInfo' });
    });
    expect(result).toMatchObject({
      platform: expect.any(String),
      uptime: expect.any(Number),
      memory: expect.any(Number),
    });
    expect((result as any).platform.length).toBeGreaterThan(0);
    expect((result as any).uptime).toBeGreaterThan(0);
    expect((result as any).memory).toBeGreaterThan(0);
  });

  test('callPlugin rejects for an unknown plugin', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const error = await page.evaluate(async () => {
      const c = (window as any).__condenser;
      return c.plugins
        .callPlugin('no-such-plugin', { action: 'test' })
        .then(() => null)
        .catch((e: Error) => e.message);
    });
    expect(typeof error).toBe('string');
    expect(error).toBeTruthy();
  });

  test('callPlugin rejects immediately when WebSocket is not connected', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const error = await page.evaluate(async () => {
      const c = (window as any).__condenser;
      const saved = c.core.ws;
      c.core.ws = null;
      try {
        return await c.plugins
          .callPlugin('condenser-system', { action: 'getInfo' })
          .then(() => null)
          .catch((e: Error) => e.message);
      } finally {
        c.core.ws = saved;
      }
    });
    expect(typeof error).toBe('string');
    expect(error).toContain('WebSocket');
  });
});
