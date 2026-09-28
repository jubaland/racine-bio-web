import { expect, type Page } from '@playwright/test';

/** La page ne déborde pas horizontalement (règle PWA : tout doit tenir à 375 px). */
export async function expectNoOverflow(page: Page, label = '') {
  const r = await page.evaluate(() => {
    const iw = window.innerWidth;
    const offenders = [...document.querySelectorAll('body *')].filter(e => {
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.right <= iw + 2) return false;
      // Toléré : éléments hors écran volontairement (tiroirs fermés) ou dans un conteneur à défilement horizontal
      for (let n: Element | null = e; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || /auto|scroll/.test(cs.overflowX)) return false;
      }
      return true;
    }).slice(0, 5).map(e => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 60)}`);
    return { sw: document.documentElement.scrollWidth, iw, offenders };
  });
  expect(r.offenders, `débordement horizontal ${label}`).toEqual([]);
  expect(r.sw, `largeur de page ${label}`).toBeLessThanOrEqual(r.iw + 1);
}

/** Collecte les erreurs JavaScript de la page (hors bruit du serveur de développement). */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/webpack-hmr|WebSocket|favicon|Failed to load resource|net::ERR|hydrat|service worker|push/i.test(t)) return;
    errors.push(t.slice(0, 300));
  });
  return errors;
}

/** Attend la fin du chargement initial (données Supabase comprises). */
export async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
}
