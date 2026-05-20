import { Db } from '@u7-hub/core';
import { handleCourseRoutes } from '@u7-hub/nur-course';
import { join } from 'node:path';

try {
  // --- Конфигурация ---
  const PORT = process.env.PORT || 3000;
  const DB_PATH = process.env.DB_PATH || './course.sqlite';
  const IS_PROD = process.env.NODE_ENV === 'production';

  console.log(`SERVER: Starting in ${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

  // Инициализация БД
  const appDb = new Db(DB_PATH);
  try {
    appDb.connect();
    await appDb.runMigrations('packages/core/src/migrations');
  } catch (error: any) {
    console.error(`Ошибка БД: ${error.message}`);
    process.exit(1);
  }

  // Rate Limiting
  const rateLimitStore = new Map<string, { count: number; startTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;
  const MAX_REQUESTS_PER_WINDOW = 10;

  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.set(ip, { count: 1, startTime: now });
      return false;
    }

    record.count++;
    return record.count > MAX_REQUESTS_PER_WINDOW;
  }

  // --- Определение путей к статическим файлам ---
  const getStaticDir = () => {
    const baseDir = IS_PROD ? 'dist/prod' : 'dist/dev';
    return join(import.meta.dir, '..', baseDir);
  };

  // --- Функция для обслуживания статических файлов ---
  const CONTENT_TYPES: Record<string, string> = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.md': 'text/markdown',
  };

  const serveStaticFile = async (urlPath: string): Promise<Response | null> => {
    // На проде статику раздаёт nginx
    if (IS_PROD) return null;

    const staticDir = getStaticDir();
    let cleanPath = urlPath;

    // Убираем trailing slash для корневых запросов
    if (cleanPath.endsWith('/') && cleanPath !== '/') {
      cleanPath = cleanPath.slice(0, -1);
    }

    console.log(`STATIC: Обработка пути: ${cleanPath}`);

    // Try-files логика: перебираем кандидаты в порядке приоритета
    const candidates = [
      cleanPath,
      cleanPath === '/' ? '/index.html' : null,
      cleanPath === '/' ? '/community/index.html' : null,
      !cleanPath.includes('.') ? `${cleanPath}/index.html` : null,
      !cleanPath.includes('.') ? `${cleanPath}.html` : null,
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const fullPath = join(staticDir, candidate);
      const file = Bun.file(fullPath);

      if (await file.exists()) {
        console.log(`STATIC: Обслуживается файл: ${fullPath}`);
        const response = new Response(file);

        // Определяем Content-Type по расширению
        const ext = Object.keys(CONTENT_TYPES).find(e => candidate.endsWith(e));
        if (ext) {
          response.headers.set('Content-Type', CONTENT_TYPES[ext]);
        }

        return response;
      }
    }

    console.log(`STATIC: Файл не найден: ${cleanPath}`);
    return null;
  };

  // --- Запуск сервера ---
  console.log('SERVER: Starting Bun.serve...');
  const server = Bun.serve({
    hostname: IS_PROD ? "127.0.0.1" : "0.0.0.0",
    port: PORT,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const pathname = url.pathname;

      console.log(`REQUEST: ${request.method} ${pathname}`);

      // Rate Limiting для всех POST запросов
      if (request.method === 'POST') {
        const ip = server.requestIP(request)?.address || 'unknown';
        if (isRateLimited(ip)) {
          console.warn(`RATE LIMIT: IP ${ip} заблокирован.`);
          return new Response('Слишком много запросов, попробуйте позже.', { status: 429 });
        }
      }

      // --- Обработка API роутов ---
      let response: Response | null = null;

      // Роуты курсов
      response = await handleCourseRoutes(request, appDb.connect());
      if (response) return response;

      // --- Раздача статических файлов ---
      response = await serveStaticFile(pathname);
      if (response) return response;

      // Если ничего не найдено
      console.log(`NOT FOUND: ${pathname}`);
      return new Response('Не найдено', { status: 404 });
    },
  });

  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Локальный URL: http://localhost:${PORT}`);
  console.log(`\nДоступные маршруты:`);
  console.log(`- Сообщество: http://localhost:${PORT}/community`);
  console.log(`- Курсы: http://localhost:${PORT}/nur-courses`);
  console.log(`- Детали курса: http://localhost:${PORT}/nur-courses/details`);

  if (IS_PROD) {
    console.log(`\nProduction:`);
    console.log(`- Статика: ${getStaticDir()}`);
  }

} catch (error: any) {
  console.error('SERVER: Критическая ошибка при запуске сервера:', error);
  process.exit(1);
}
