/**
 * Verifies Condenser's namespace and core state after boot.
 *
 * Requires the dev server to be running (`npm run dev`) so that Condenser
 * is injected into Steam's SharedJSContext before the tests execute.
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

test.describe('Condenser boot', () => {
  test('window.__condenser namespace exists', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const exists = await page.evaluate(() => typeof (window as any).__condenser === 'object');
    expect(exists).toBe(true);
  });

  test('core.React and core.ReactDOM are resolved from webpack', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const c = (window as any).__condenser;
      return {
        hasReact: typeof c?.core?.React?.createElement === 'function',
        hasReactDOM: typeof c?.core?.ReactDOM?.createRoot === 'function',
      };
    });
    expect(result.hasReact).toBe(true);
    expect(result.hasReactDOM).toBe(true);
  });

  test('plugins API surface is complete', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const p = (window as any).__condenser?.plugins;
      return {
        callPlugin: typeof p?.callPlugin === 'function',
        loadPlugin: typeof p?.loadPlugin === 'function',
        initPluginLoader: typeof p?.initPluginLoader === 'function',
        onMessage: typeof p?.onMessage === 'function',
      };
    });
    expect(result.callPlugin).toBe(true);
    expect(result.loadPlugin).toBe(true);
    expect(result.initPluginLoader).toBe(true);
    expect(result.onMessage).toBe(true);
  });

  test('page API surface is complete', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const p = (window as any).__condenser?.page;
      return {
        renderComponent: typeof p?.renderComponent === 'function',
        activatePage: typeof p?.activatePage === 'function',
        showPage: typeof p?.showPage === 'function',
        closePage: typeof p?.closePage === 'function',
      };
    });
    expect(result.renderComponent).toBe(true);
    expect(result.activatePage).toBe(true);
    expect(result.showPage).toBe(true);
    expect(result.closePage).toBe(true);
  });

  test('WebSocket connection to backend is open', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const wsOpen = await page.evaluate(
      () => (window as any).__condenser?.core?.ws?.readyState === WebSocket.OPEN,
    );
    expect(wsOpen).toBe(true);
  });
});
