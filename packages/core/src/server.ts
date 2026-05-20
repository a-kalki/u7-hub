import { Db } from '@app/db';
import { handleCourseRoutes } from '@course/api/routes';
import { join } from 'path';

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
    await appDb.runMigrations('./packages/core/src/migrations');
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
    return join(process.cwd(), baseDir);
  };

  // --- Функция для обслуживания статических файлов ---
  const serveStaticFile = async (urlPath: string): Promise<Response | null> => {
    const staticDir = getStaticDir();
    let filePath = urlPath;

    // Убираем trailing slash для корневых запросов
    if (filePath.endsWith('/')) {
      filePath = filePath.slice(0, -1);
    }

    console.log(`STATIC: Обработка пути: ${filePath}`);

    // Определяем тип запроса: общий файл, курс или сообщество
    let fileCategory: 'shared' | 'course' | 'community' = 'shared';
    let relativePath = filePath;

    if (filePath.startsWith('/course')) {
      fileCategory = 'course';
      relativePath = filePath.replace('/course', '') || '/';
    } else if (filePath.startsWith('/community')) {
      fileCategory = 'community';
      relativePath = filePath.replace('/community', '') || '/';
    } else if (filePath === '' || filePath === '/') {
      fileCategory = 'community';
      relativePath = '/';
    }

    // Строим путь к файлу в зависимости от категории
    if (fileCategory === 'shared') {
      // Общие файлы лежат прямо в корне dist
      filePath = join(staticDir, relativePath.substring(1));
    } else {
      // Файлы модулей лежат в соответствующих поддиректориях
      const moduleDir = fileCategory;
      
      // Специальные маршруты для HTML страниц
      if (relativePath === '/' || relativePath === '') {
        // Главная страница модуля
        const mainPage = moduleDir === 'course' ? 'course-landing.html' : 'community.html';
        filePath = join(staticDir, moduleDir, mainPage);
      } else if (moduleDir === 'course') {
        // Специфичные маршруты для курсов
        const routeMap: { [key: string]: string } = {
          '/details': 'course-details.html',
          '/form': 'form.html'
        };
        filePath = join(staticDir, moduleDir, routeMap[relativePath] || relativePath.substring(1));
      } else {
        // Для сообщества и остальных случаев
        filePath = join(staticDir, moduleDir, relativePath.substring(1));
      }
    }

    // Пробуем найти файл
    let file = Bun.file(filePath);
    
    // Если файл не найден, пробуем добавить расширения
    if (!(await file.exists())) {
      // Для HTML страниц пробуем добавить .html
      if (!filePath.includes('.') && (fileCategory === 'course' || fileCategory === 'community')) {
        const htmlPath = `${filePath}.html`;
        const htmlFile = Bun.file(htmlPath);
        if (await htmlFile.exists()) {
          filePath = htmlPath;
          file = htmlFile;
        }
      }
      
      // Для JS файлов пробуем добавить .js (на случай если в HTML указан путь без расширения)
      if (!(await file.exists()) && filePath.endsWith('/js')) {
        const jsPath = `${filePath}.js`;
        const jsFile = Bun.file(jsPath);
        if (await jsFile.exists()) {
          filePath = jsPath;
          file = jsFile;
        }
      }
    }

    // Если файл найден, возвращаем его
    if (await file.exists()) {
      console.log(`STATIC: Обслуживается файл: ${filePath}`);
      const response = new Response(file);
      
      // Автоматически определяем Content-Type по расширению
      if (filePath.endsWith('.css')) {
        response.headers.set('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        response.headers.set('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.html')) {
        response.headers.set('Content-Type', 'text/html');
      } else if (filePath.endsWith('.md')) {
        response.headers.set('Content-Type', 'text/markdown');
      }
      // Можно добавить другие MIME types по необходимости
      
      return response;
    }

    console.log(`STATIC: Файл не найден: ${filePath}`);
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

      // Роуты сообщества (когда появятся)
      // response = await handleCommunityRoutes(request, appDb.connect());
      // if (response) return response;

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
  console.log(`- Курсы: http://localhost:${PORT}/course`);
  console.log(`- Детали курса: http://localhost:${PORT}/course/details`);
  console.log(`- Форма: http://localhost:${PORT}/course/form`);

  if (IS_PROD) {
    console.log(`\nProduction домены:`);
    console.log(`- Сообщество: https://community.gis-expert.kz`);
    console.log(`- Курсы: https://course.gis-expert.kz`);
    console.log(`- Детали курса: https://course.gis-expert.kz/details`);
  }

} catch (error: any) {
  console.error('SERVER: Критическая ошибка при запуске сервера:', error);
  process.exit(1);
}
