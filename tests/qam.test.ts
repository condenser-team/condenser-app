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
  test('core.tabPatched is true after tab activation', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const patched = await page.evaluate(() => !!(window as any).condenser?.core?.tabPatched);
    expect(patched).toBe(true);
  });

  test('core.quickAccessMenuRenderer is discovered', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const found = await page.evaluate(
      () => (window as any).condenser?.core?.quickAccessMenuRenderer != null,
    );
    expect(found).toBe(true);
  });

  test('condenser-system component is loaded with tab and panel', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const comp = (window as any).condenser?.components?.['condenser-system']?.component;
      return {
        hasTab: typeof comp?.tab === 'function',
        hasPanel: typeof comp?.panel === 'function',
      };
    });
    expect(result.hasTab).toBe(true);
    expect(result.hasPanel).toBe(true);
  });

  test('loadPlugin calls ns.forceUpdate when registered, enabling live reload', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(async () => {
      const c = (window as any).condenser;
      const ns = (c.components['condenser-system'] ||= {});
      ns.forceUpdaters ??= new Set();
      let called = false;
      const spy = () => { called = true; };
      ns.forceUpdaters.add(spy);
      try {
        const plugins: any[] = await c.plugins.callPlugin('get-plugins');
        const plugin = plugins.find((p: any) => p.id === 'condenser-system');
        if (!plugin) return { error: 'condenser-system not in get-plugins response' };
        await c.plugins.loadPlugin(plugin.id, plugin.url + '?t=' + Date.now());
        return { called };
      } finally {
        ns.forceUpdaters.delete(spy);
      }
    });
    expect((result as any).error, (result as any).error).toBeUndefined();
    expect((result as any).called).toBe(true);
  });
});
