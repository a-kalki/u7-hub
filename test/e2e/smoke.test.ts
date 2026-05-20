import { test, expect } from '@playwright/test';

/**
 * Smoke-тесты для проверки базовой доступности страниц.
 *
 * Проверяем что:
 * - каждая страница возвращает HTTP 200
 * - заголовок страницы соответствует ожидаемому
 * - ключевые элементы контента присутствуют в DOM
 * - статические ресурсы (CSS, JS) подгружаются без ошибок
 */

const PAGES = [
  {
    path: '/',
    title: 'Развитие IT сообщества Уральск',
    selector: 'h1',
    expectedText: /IT сообщество/i,
    description: 'главная страница сообщества',
  },
  {
    path: '/community',
    title: 'Развитие IT сообщества Уральск',
    selector: 'h1',
    expectedText: /IT сообщество/i,
    description: 'страница сообщества',
  },
  {
    path: '/community/index.html',
    title: 'Развитие IT сообщества Уральск',
    selector: 'h1',
    expectedText: /IT сообщество/i,
    description: 'страница сообщества (явный путь)',
  },
  {
    path: '/nur-courses',
    title: 'Обучение программированию с ментором',
    selector: 'h1',
    expectedText: /Начни путь в IT/i,
    description: 'лендинг курсов',
  },
  {
    path: '/nur-courses/index.html',
    title: 'Обучение программированию с ментором',
    selector: 'h1',
    expectedText: /Начни путь в IT/i,
    description: 'лендинг курсов (явный путь)',
  },
  {
    path: '/nur-courses/details',
    title: 'Курсы программирования',
    selector: 'h1',
    expectedText: /Добро пожаловать в мир IT/i,
    description: 'детали курсов',
  },
  {
    path: '/nur-courses/details/index.html',
    title: 'Курсы программирования',
    selector: 'h1',
    expectedText: /Добро пожаловать в мир IT/i,
    description: 'детали курсов (явный путь)',
  },
];

for (const page of PAGES) {
  test(`страница ${page.description} загружается (${page.path})`, async ({ page: pageObj }) => {
    const response = await pageObj.goto(page.path);
    expect(response?.status()).toBe(200);

    // Проверяем заголовок страницы
    await expect(pageObj).toHaveTitle(page.title);

    // Проверяем что ключевой элемент видим
    const heading = pageObj.locator(page.selector).first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(page.expectedText);

    // Ждём загрузки DOM и выполнения inline-скриптов
    // Используем load вместо networkidle, так как трекер может держать
    // соединение открытым (long polling, keepalive)
    await pageObj.waitForLoadState('load');
  });
}

/**
 * Проверка что 404 страница корректно возвращает ошибку.
 */
test('несуществующая страница возвращает 404', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
});

/**
 * Проверка загрузки статических ресурсов.
 */
test('статические CSS и JS файлы загружаются', async ({ page }) => {
  const assets = [
    '/common.css',
    '/tracker.js',
    '/user-session-manager.js',
    '/tab-manager.js',
    '/nur-courses/course-landing.css',
  ];

  for (const asset of assets) {
    const response = await page.goto(asset);
    expect(response?.status()).toBe(200);
  }
});
