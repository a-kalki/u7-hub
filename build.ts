import { rm, mkdir, readdir, cp, stat, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import MarkdownIt from 'markdown-it';
import mdAttrs from 'markdown-it-attrs';
import mdSpans from 'markdown-it-bracketed-spans';

// --- Определение режима сборки ---
const args = process.argv.slice(2);
const envMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const argMode = args.includes('--prod') ? 'prod' : args.includes('--dev') ? 'dev' : null;

const MODE = argMode || envMode || 'dev';
const isProd = MODE === 'prod';
const isDev = !isProd;

const OUT_DIR = isProd ? 'dist/prod' : 'dist/dev';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})
  .use(mdSpans)
  .use(mdAttrs);

console.log(`🚀 Режим сборки: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📂 Выходная директория: ${OUT_DIR}`);

// --- Конфигурация модулей ---
// outputPath — полный путь от корня dist, например: 'community/index.html'
// assets — глоб паттерны для файлов, которые копируются в папку модуля
const MODULES = {
  community: {
    pages: [
      {
        template: 'packages/community/src/ui/community.template.html',
        contentDir: 'packages/community/src/ui/content',
        outputPath: 'community/index.html',
      }
    ],
    assets: [],  // Нет уникальных ассетов — все общие (common.css, tracker.js и т.д.)
    dependencies: []
  },
  'nur-courses': {
    pages: [
      {
        template: 'packages/nur-course/src/ui/course-landing.template.html',
        contentDir: 'packages/nur-course/src/ui/content',
        contentFiles: ['landing.md'],
        outputPath: 'nur-courses/index.html',
      },
      {
        template: 'packages/nur-course/src/ui/course-details.template.html',
        contentDir: 'packages/nur-course/src/ui/content',
        excludeContent: ['landing.md'],
        outputPath: 'nur-courses/details/index.html',
      }
    ],
    assets: [
      'packages/nur-course/src/ui/**/*.{css,ts,js,svg}',
    ],
    dependencies: []
  }
};

// Общие зависимости (будут в корне dist)
const SHARED_DEPENDENCIES = [
  'packages/core/src/ui/common.css',
  'packages/core/src/ui/tracker.ts',
  'packages/core/src/ui/user-session-manager.ts',
  'packages/core/src/ui/tab-manager.ts'
];

// --- Функции сборки ---

async function cleanAndCreateDir() {
  console.log(`Очистка директории: ${OUT_DIR}`);
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Директория готова.');
}

async function copyFile(source: string, destination: string) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  console.log(`📁 Скопирован: ${source} → ${destination}`);
}

async function findFiles(pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const files = [];
  for await (const file of glob.scan(".")) {
    // Пропускаем тестовые файлы
    if (!file.endsWith('.test.ts') && !file.includes('.test.')) {
      files.push(file);
    }
  }
  return files;
}

async function buildSharedDependencies() {
  console.log('\n--- Сборка общих зависимостей ---');
  const copiedFiles: string[] = [];

  // Собираем не TypeScript зависимости
  const notTsDeps = SHARED_DEPENDENCIES.filter(dep => !dep.endsWith('.ts'));
  for (const fileName of notTsDeps) {
    const name = basename(fileName);
    await copyFile(fileName, join(OUT_DIR, name));
    copiedFiles.push(name);
  }

  // Собираем TypeScript общие зависимости
  const tsDeps = SHARED_DEPENDENCIES.filter(dep => dep.endsWith('.ts'));
  if (tsDeps.length > 0) {
    console.log('Сборка общих TypeScript файлов...');

    const result = await Bun.build({
      entrypoints: tsDeps,
      outdir: OUT_DIR,
      minify: isProd,
      sourcemap: isDev ? 'inline' : 'none',
      target: 'browser',
      format: 'esm',
      splitting: false,
    });

    if (result.success) {
      console.log('✅ Общие зависимости успешно собраны');
      for (const tsDep of tsDeps) {
        const baseName = basename(tsDep, '.ts');
        copiedFiles.push(`${baseName}.js`);
      }

      // УДАЛЯЕМ исходные .ts файлы из выходной директории
      for (const tsDep of tsDeps) {
        const name = basename(tsDep);
        const tsPath = join(OUT_DIR, name);
        try {
          await rm(tsPath);
          console.log(`🗑️  Удален исходный TS файл: ${name}`);
        } catch (error) {
          // Игнорируем ошибки удаления
        }
      }
    } else {
      console.error('❌ Ошибка сборки общих зависимостей:');
      for (const message of result.logs) {
        console.error(message);
      }
      throw new Error('Сборка общих зависимостей завершилась с ошибками');
    }
  }

  return copiedFiles;
}

/**
 * Оборачивает части HTML в div с чередованием фона.
 * Разделителем служит любой тег с классом .sw-bg-color
 */
function wrapHtmlSections(html: string): string {
  const sections = html.split(/(?=<[^>]*\bclass\s*=\s*["'][^"']*\bsw-bg-color\b[^"']*["'][^>]*>)/g);
  if (sections.length <= 1) return html;

  return sections
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map((section, index) => {
      const bgColorClass = index % 2 === 0 ? 'w3-white' : 'w3-light-grey';
      return `<div class="${bgColorClass} w3-container">${section}</div>`;
    })
    .join('\n');
}

async function buildModule(moduleName: string, config: any) {
  console.log(`\n--- Сборка модуля: ${moduleName} ---`);
  const copiedFiles: string[] = [];

  // 1. Обработка страниц
  for (const page of config.pages) {
    if (page.template && page.contentDir) {
      console.log(`[${moduleName}] Рендеринг страницы: ${page.outputPath}`);
      let html = await readFile(page.template, 'utf-8');

      const mdFiles = await readdir(page.contentDir);
      for (const mdFile of mdFiles) {
        if (!mdFile.endsWith('.md')) continue;
        if (page.contentFiles && !page.contentFiles.includes(mdFile)) continue;
        if (page.excludeContent && page.excludeContent.includes(mdFile)) continue;

        const key = basename(mdFile, '.md');
        const content = await readFile(join(page.contentDir, mdFile), 'utf-8');
        let rendered = md.render(content);

        // Автоматическое оборачивание в секции (кроме лендинга)
        if (mdFile !== 'landing.md') {
          rendered = wrapHtmlSections(rendered);
        }

        const placeholder = `<!-- CONTENT:${key} -->`;
        html = html.replace(new RegExp(placeholder, 'g'), rendered);
      }

      const outPath = join(OUT_DIR, page.outputPath);
      await mkdir(dirname(outPath), { recursive: true });

      // Замена плейсхолдера текущим годом
      html = html.replace(/\{\{CURRENT_YEAR\}\}/g, String(new Date().getFullYear()));

      await writeFile(outPath, html);
      console.log(`✅ [${moduleName}] HTML собран из шаблона: ${page.outputPath}`);
      copiedFiles.push(page.outputPath);
    } else if (page.template) {
      // Просто копия шаблона если нет контента
      const outPath = join(OUT_DIR, page.outputPath);
      await mkdir(dirname(outPath), { recursive: true });

      // Для шаблонов без контента — читаем, заменяем плейсхолдер и пишем
      let tmplHtml = await readFile(page.template, 'utf-8');
      tmplHtml = tmplHtml.replace(/\{\{CURRENT_YEAR\}\}/g, String(new Date().getFullYear()));
      await writeFile(outPath, tmplHtml);
      copiedFiles.push(page.outputPath);
    }
  }

  // 2. Копируем ассеты модуля
  for (const assetPattern of config.assets) {
    const assetFiles = await findFiles(assetPattern);
    for (const assetFile of assetFiles) {
      // Пропускаем HTML и MD файлы и шаблоны
      if (assetFile.endsWith('.html') || assetFile.endsWith('.md') || assetFile.includes('.template.')) continue;

      // Вычисляем относительный путь от корня assetPattern
      // assetPattern: 'packages/nur-course/src/ui/**/*.{css,ts,js,svg}'
      // basePath:     'packages/nur-course/src/ui/'
      // assetFile:    'packages/nur-course/src/ui/course-landing.css'
      // relative:     'course-landing.css'
      const starIndex = assetPattern.indexOf('*');
      const basePath = starIndex >= 0 ? assetPattern.substring(0, starIndex) : assetPattern;
      const moduleRelativePath = relative(basePath, assetFile);

      const destPath = join(OUT_DIR, moduleName, moduleRelativePath);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(assetFile, destPath);
      copiedFiles.push(join(moduleName, moduleRelativePath));
    }
  }

  // 3. Собираем TypeScript/JavaScript файлы из ассетов модуля
  //    (которые уже скопированы как ассеты, теперь компилируем TS → JS)
  const tsFiles = [];
  for (const assetPattern of config.assets) {
    const files = await findFiles(assetPattern);
    for (const file of files) {
      if ((file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.test.ts') && !file.endsWith('.test.js')) {
        tsFiles.push(file);
      }
    }
  }

  // Убираем дубликаты
  const uniqueTsFiles = [...new Set(tsFiles)];

  if (uniqueTsFiles.length > 0) {
    console.log(`[${moduleName}] Сборка TypeScript/JavaScript...`);

    try {
      const result = await Bun.build({
        entrypoints: uniqueTsFiles,
        outdir: join(OUT_DIR, moduleName),
        minify: isProd,
        sourcemap: isDev ? 'inline' : 'none',
        target: 'browser',
        format: 'esm',
        splitting: false,
      });

      if (result.success) {
        console.log(`✅ [${moduleName}] JavaScript/TypeScript успешно собраны.`);

        // Удаляем исходные .ts файлы из выходной директории (оставляем .js)
        for (const entry of uniqueTsFiles) {
          if (!entry.endsWith('.ts')) continue;

          // Находим assetPattern, который подходит для этого entry
          const matchingPattern = config.assets.find((pattern: string) => {
            const starIdx = pattern.indexOf('*');
            const base = starIdx >= 0 ? pattern.substring(0, starIdx) : pattern;
            return entry.startsWith(base);
          });
          if (!matchingPattern) continue;

          const starIdx = matchingPattern.indexOf('*');
          const basePath = starIdx >= 0 ? matchingPattern.substring(0, starIdx) : matchingPattern;
          const moduleRelativePath = relative(basePath, entry);
          const tsPath = join(OUT_DIR, moduleName, moduleRelativePath);
          try {
            await rm(tsPath);
            console.log(`🗑️  Удален исходный TS файл: ${moduleRelativePath}`);
          } catch (error) {
            // Игнорируем если файла уже нет
          }
        }
      } else {
        throw new Error(`Сборка TypeScript для модуля ${moduleName} завершилась с ошибками`);
      }
    } catch (error: any) {
      console.error(`💥 [${moduleName}] Критическая ошибка при сборке TypeScript:`);
      console.error(error.message);
      throw error;
    }
  }

  return {
    moduleName,
    files: copiedFiles
  };
}

// --- Функция для отображения структуры директории ---
async function printDirectoryStructure(dir: string, prefix = ''): Promise<string[]> {
  try {
    const items = await readdir(dir);
    const lines: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemPath = join(dir, item);
      const stats = await stat(itemPath);
      const isLast = i === items.length - 1;

      const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
      lines.push(currentPrefix + item);

      if (stats.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        const subLines = await printDirectoryStructure(itemPath, newPrefix);
        lines.push(...subLines);
      }
    }

    return lines;
  } catch (error) {
    return [`${prefix}❌ Ошибка чтения директории: ${error}`];
  }
}

// --- Запуск процесса сборки ---
async function runBuild() {
  try {
    await cleanAndCreateDir();

    const buildResults = [];

    // 1. Сначала собираем общие зависимости
    const sharedFiles = await buildSharedDependencies();

    // 2. Затем собираем каждый модуль
    for (const [moduleName, config] of Object.entries(MODULES)) {
      try {
        const result = await buildModule(moduleName, config);
        buildResults.push(result);
      } catch (error) {
        console.error(`\n💥 Сборка модуля ${moduleName} завершилась с ошибкой`);
        throw error;
      }
    }

    console.log('\n✅ Сборка завершена успешно!');

    // Выводим динамическую структуру
    console.log('\n📁 Структура выходной директории:');
    try {
      const structureLines = await printDirectoryStructure(OUT_DIR);
      structureLines.forEach(line => console.log(line));
    } catch (error) {
      console.log('❌ Не удалось отобразить структуру директории:', error);
    }

    // Выводим краткую статистику
    console.log('\n📊 Статистика сборки:');
    console.log(`   Общие файлы: ${sharedFiles.length} файлов`);
    for (const result of buildResults) {
      console.log(`   ${result.moduleName}: ${result.files.length} файлов`);
    }

  } catch (error: any) {
    console.error('\n❌ Критическая ошибка в процессе сборки:');
    console.error('Сообщение:', error.message);
    process.exit(1);
  }
}

runBuild();
