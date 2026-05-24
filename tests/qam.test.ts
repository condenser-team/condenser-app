/**
 * Verifies that the Quick Access Menu (QAM) injection is working correctly.
 *
 * Checks patch state, renderer discovery, component registration, and that
 * InjectedTabPanel's forceUpdate hook is registered (enabling live reload).
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

test.describe('QAM injection', () => {
  test('core.patched is true after QAM activation', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const patched = await page.evaluate(() => !!(window as any).__condenser?.core?.patched);
    expect(patched).toBe(true);
  });

  test('core.quickAccessMenuRenderer is discovered', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const found = await page.evaluate(
      () => (window as any).__condenser?.core?.quickAccessMenuRenderer != null,
    );
    expect(found).toBe(true);
  });

  test('condenser-tab component is loaded with correct target, tab, and panel', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const comp = (window as any).__condenser?.components?.['condenser-tab']?.component;
      return {
        target: comp?.target,
        hasTab: typeof comp?.tab === 'function',
        hasPanel: typeof comp?.panel === 'function',
      };
    });
    expect(result.target).toBe('quick-access-menu');
    expect(result.hasTab).toBe(true);
    expect(result.hasPanel).toBe(true);
  });

  test('loadPlugin calls ns.forceUpdate when registered, enabling live reload', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(async () => {
      const c = (window as any).__condenser;
      const ns = (c.components['condenser-tab'] ||= {});
      const saved = ns.forceUpdate;
      let called = false;
      ns.forceUpdate = () => { called = true; };
      try {
        const plugins: any[] = await c.plugins.callPlugin('get-plugins');
        const plugin = plugins.find((p: any) => p.id === 'condenser-tab');
        if (!plugin) return { error: 'condenser-tab not in get-plugins response' };
        await c.plugins.loadPlugin(plugin.id, plugin.url + '?t=' + Date.now());
        return { called };
      } finally {
        ns.forceUpdate = saved;
      }
    });
    expect((result as any).error, (result as any).error).toBeUndefined();
    expect((result as any).called).toBe(true);
  });
});
