import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { isSteamSharedContextTab } from '../shared/runtime.js';

export const STEAM_DEBUG_URL = 'http://localhost:8080';

export async function connectToSteam(): Promise<Browser> {
  return chromium.connectOverCDP(STEAM_DEBUG_URL);
}

export async function findSharedContextPage(browser: Browser): Promise<Page | null> {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const title = await page.title().catch(() => '');
      if (isSteamSharedContextTab(title, page.url())) return page;
    }
  }
  return null;
}

export async function isCondenserBooted(page: Page): Promise<boolean> {
  return page
    .evaluate(() => !!(window as any).condenser?.core?.booted)
    .catch(() => false);
}
