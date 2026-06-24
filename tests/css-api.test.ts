/**
 * Verifies the condenser.css API surface — Target constants, Window enum,
 * and the inject/toggle/vars function signatures.
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

test.describe('CSS API', () => {
  test('condenser.css functions are present', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const css = (window as any).condenser?.css;
      return {
        inject:            typeof css?.inject === 'function',
        createStyleToggle: typeof css?.createStyleToggle === 'function',
        createStyleVars:   typeof css?.createStyleVars === 'function',
      };
    });
    expect(result.inject).toBe(true);
    expect(result.createStyleToggle).toBe(true);
    expect(result.createStyleVars).toBe(true);
  });

  test('condenser.css.Window enum has all expected values', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const W = (window as any).condenser?.css?.Window;
      return {
        BigPicture:     W?.BigPicture,
        QuickAccess:    W?.QuickAccess,
        MainMenu:       W?.MainMenu,
        Keyboard:       W?.Keyboard,
        OverlayBrowser: W?.OverlayBrowser,
        Store:          W?.Store,
      };
    });
    expect(result.BigPicture).toBe('big-picture');
    expect(result.QuickAccess).toBe('quick-access');
    expect(result.MainMenu).toBe('main-menu');
    expect(result.Keyboard).toBe('keyboard');
    expect(result.OverlayBrowser).toBe('overlay-browser');
    expect(result.Store).toBe('store');
  });

  test('condenser.css.Target has all expected keys', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const T = (window as any).condenser?.css?.Target;
      const keys = [
        'Global', 'Header', 'QuickAccess', 'MainMenu', 'Keyboard', 'OverlayBrowser',
        'Background', 'GameDetail', 'LockScreen', 'Media', 'Settings',
        'Downloads', 'Friends', 'Home', 'Library',
      ];
      return keys.reduce((acc, k) => {
        const entry = T?.[k];
        acc[k] = Array.isArray(entry?.windows) && typeof entry?.scope === 'string';
        return acc;
      }, {} as Record<string, boolean>);
    });
    for (const [key, valid] of Object.entries(result)) {
      expect(valid, `Target.${key} should have windows[] and scope`).toBe(true);
    }
  });

  test('condenser.css.Target entries reference valid Window values', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const T = (window as any).condenser?.css?.Target;
      const validWindows = new Set(Object.values((window as any).condenser?.css?.Window ?? {}));
      const badEntries: string[] = [];
      for (const [name, entry] of Object.entries(T ?? {})) {
        const def = entry as { windows: string[]; scope: string };
        for (const w of def.windows ?? []) {
          if (!validWindows.has(w)) badEntries.push(`${name}.windows includes unknown "${w}"`);
        }
        if (!def.scope) badEntries.push(`${name}.scope is empty`);
      }
      return badEntries;
    });
    expect(result).toEqual([]);
  });
});
