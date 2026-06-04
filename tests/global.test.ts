/**
 * Verifies that Global Components are injected into the BPM router's React tree
 * and live-reload correctly.
 *
 * Global components are rendered as siblings to the router's route list (same fiber
 * tree, no route guard) so they appear on every BPM page simultaneously.
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

test.describe('Global Components', () => {
  test('condenser-system component has a persistent export', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const hasGlobal = await page.evaluate(() => {
      const comp = (window as any).condenser?.components?.['condenser-system']?.component;
      return typeof comp?.persistent === 'function';
    });
    expect(hasGlobal).toBe(true);
  });

  test('persistent indicator element is present in the DOM', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const found = await page.evaluate(() =>
      document.getElementById('condenser-persistent-indicator') !== null,
    );
    expect(found).toBe(true);
  });

  test('InjectedGlobal registers a forceUpdater for live reload', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const hasUpdater = await page.evaluate(() => {
      const ns = (window as any).condenser?.components?.['condenser-system'];
      return (ns?.forceUpdaters?.size ?? 0) > 0;
    });
    expect(hasUpdater).toBe(true);
  });
});
