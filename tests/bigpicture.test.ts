/**
 * Verifies that the Big Picture Mode (BPM) router is patched and plugin routes are injected.
 *
 * Checks patch state, component registration, and presence of the condenser-bigpicture
 * route in the BPM router's live React fiber tree.
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

test.describe('Big Picture router', () => {
  test('core.bigPicturePatched is true after router patching', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const patched = await page.evaluate(() => !!(window as any).__condenser?.core?.bigPicturePatched);
    expect(patched).toBe(true);
  });

  test('condenser-bigpicture component is loaded with correct target, route, and page', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const result = await page.evaluate(() => {
      const comp = (window as any).__condenser?.components?.['condenser-bigpicture']?.component;
      return {
        target: comp?.target,
        route: comp?.route,
        hasPage: typeof comp?.page === 'function',
      };
    });
    expect(result.target).toBe('big-picture');
    expect(result.route).toBe('/condenser/system');
    expect(result.hasPage).toBe(true);
  });

  test('/condenser/system route is present in BPM router fiber tree', async () => {
    test.skip(!booted, 'Condenser not booted — run: npm run dev');
    const found = await page.evaluate(() => {
      // Walk fiber tree looking for the gamepad router node.
      function findInFiber(node: any, filter: (n: any) => boolean): any {
        if (!node || typeof node !== 'object') return null;
        if (filter(node)) return node;
        return findInFiber(node.child, filter) ?? findInFiber(node.sibling, filter);
      }

      const rootEl = document.getElementById('root');
      if (!rootEl) return { found: false, reason: 'no #root element' };

      const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
      const fiberRoot = containerKey ? (rootEl as any)[containerKey] : null;
      if (!fiberRoot) return { found: false, reason: 'no fiber root' };

      const routerNode = findInFiber(fiberRoot, (n: any) =>
        typeof n?.type === 'function' &&
        typeof n?.pendingProps?.loggedIn === 'undefined' &&
        (n.type.toString() as string).includes('Settings.Root()'),
      );
      if (!routerNode) return { found: false, reason: 'router node not found' };

      // The router's return value is in memoizedState or we can call it safely with empty props.
      // Use pendingProps path from the yc (TopLevelTransition) child fiber instead.
      const ycFiber = findInFiber(routerNode.child, (n: any) =>
        Array.isArray(n?.pendingProps?.children),
      );
      if (!ycFiber) return { found: false, reason: 'yc fiber not found' };

      const routeList: any[] = ycFiber.pendingProps.children;
      const hasRoute = routeList.some((r: any) => r?.props?.path === '/condenser/system');
      return { found: hasRoute, reason: hasRoute ? 'ok' : `routes: ${routeList.map((r: any) => r?.props?.path).join(', ')}` };
    });

    expect(found.found, `Route not found: ${found.reason}`).toBe(true);
  });
});
