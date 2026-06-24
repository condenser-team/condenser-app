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
  test('condenser-manager component has a persistent export', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const hasGlobal = await page.evaluate(() => {
      const comp = (window as any).condenser?.components?.['condenser-manager']?.component;
      return typeof comp?.persistent === 'function';
    });
    expect(hasGlobal).toBe(true);
  });

  test('persistent indicator element is present in the BPM DOM', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    // The Persistent component renders inside BPM's React tree, not SharedJSContext.
    // Reach BPM's document via g_PopupManager (same-origin access).
    const found = await page.evaluate(() => {
      const pm = (globalThis as any).g_PopupManager;
      for (const [, popup] of (pm?.m_mapPopups ?? new Map())) {
        const doc: Document | undefined = popup?.m_popup?.document;
        if (doc?.title === 'Steam Big Picture Mode') {
          return doc.getElementById('condenser-persistent-indicator') !== null;
        }
      }
      // Fallback: desktop BPM has title 'Steam' with an 'SP Desktop_' key
      for (const [key, popup] of (pm?.m_mapPopups ?? new Map())) {
        if (!key.startsWith('SP Desktop_')) continue;
        const doc: Document | undefined = popup?.m_popup?.document;
        if (doc?.title === 'Steam') {
          return doc.getElementById('condenser-persistent-indicator') !== null;
        }
      }
      return false;
    });
    expect(found).toBe(true);
  });

  test('InjectedGlobal registers a forceUpdater for live reload', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const hasUpdater = await page.evaluate(() => {
      const ns = (window as any).condenser?.components?.['condenser-manager'];
      return (ns?.forceUpdaters?.size ?? 0) > 0;
    });
    expect(hasUpdater).toBe(true);
  });
});
