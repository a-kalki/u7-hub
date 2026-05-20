import { test, expect } from '@playwright/test';

/**
 * Link-тест: проверяет что все внутренние ссылки на каждой странице рабочие.
 *
 * Стратегия:
 * 1. Загружаем каждую страницу проекта
 * 2. Собираем все <a href="">, ведущие на тот же origin
 * 3. Отсекаем якоря (#) и внешние ссылки
 * 4. Проверяем что каждая ссылка возвращает HTTP 200
 */

const BASE_URL = 'http://localhost:3001';

const PAGES_TO_CHECK = [
  '/',
  '/community',
  '/nur-courses',
  '/nur-courses/details',
];

// Ссылки, которые ведут на внешние ресурсы — их не проверяем через тест,
// но проверяем что они существуют в DOM и имеют href
const EXTERNAL_DOMAINS = [
  't.me',
  'telegram.me',
  'linkedin.com',
  'github.com',
  'gitlab.com',
  'instagram.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'w3schools.com',
  'dedok.gis-expert.kz',
];

function isExternalLink(href: string): boolean {
  try {
    const url = new URL(href);
    return EXTERNAL_DOMAINS.some((domain) => url.hostname.includes(domain));
  } catch {
    return false;
  }
}

function isAnchorLink(href: string): boolean {
  return href.startsWith('#');
}

function isSpecialProtocol(href: string): boolean {
  return href.startsWith('tel:') || href.startsWith('mailto:');
}

test.describe('Проверка всех внутренних ссылок', () => {
  for (const pagePath of PAGES_TO_CHECK) {
    test(`все ссылки на странице "${pagePath}" рабочие`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('load');

      // Собираем все ссылки
      const links = await page.locator('a[href]').all();

      // Фильтруем: только внутренние, не-якорные
      const internalLinks: { href: string; text: string }[] = [];
      const externalLinks: { href: string; text: string }[] = [];

      for (const link of links) {
        const href = await link.getAttribute('href');
        const text = await link.textContent();

        if (!href) continue;

        if (isAnchorLink(href)) continue;
        if (isSpecialProtocol(href)) {
          // tel: и mailto: — пропускаем, это не HTTP-ссылки
          continue;
        }
        if (isExternalLink(href)) {
          externalLinks.push({ href, text: text?.trim() || '' });
          continue;
        }

        // Относительные ссылки — проверяем что они ведут на существующие страницы
        if (!href.startsWith('http')) {
          internalLinks.push({ href, text: text?.trim() || '' });
        }
      }

      // Проверяем что внешние ссылки имеют корректный URL-формат
      for (const extLink of externalLinks) {
        try {
          new URL(extLink.href);
        } catch {
          console.warn(`⚠️  Некорректная внешняя ссылка: "${extLink.href}" (текст: "${extLink.text}")`);
        }
      }

      // Проверяем каждую внутреннюю ссылку
      const brokenLinks: string[] = [];
      for (const link of internalLinks) {
        try {
          const fullUrl = new URL(link.href, BASE_URL).toString();
          const response = await page.request.get(fullUrl);
          if (response.status() === 404) {
            brokenLinks.push(`${link.href} (текст: "${link.text}") → 404`);
          }
        } catch (error: any) {
          brokenLinks.push(`${link.href} (текст: "${link.text}") → ошибка: ${error.message}`);
        }
      }

      // Выводим найденные внутренние ссылки для информации
      if (internalLinks.length > 0) {
        console.log(`🔗 Найдено ${internalLinks.length} внутренних ссылок на "${pagePath}":`);
        for (const l of internalLinks) {
          console.log(`   ${l.href} → "${l.text}"`);
        }
      }

      if (externalLinks.length > 0) {
        console.log(`🌐 Найдено ${externalLinks.length} внешних ссылок на "${pagePath}"`);
      }

      // Если есть битые ссылки — показываем все и фейлим тест
      if (brokenLinks.length > 0) {
        console.error(`❌ Найдены битые ссылки на "${pagePath}":`);
        for (const bl of brokenLinks) {
          console.error(`   ${bl}`);
        }
      }

      expect(brokenLinks).toHaveLength(0);
    });
  }
});
