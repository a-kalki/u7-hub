import { rm, mkdir, readdir, cp, stat, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import MarkdownIt from 'markdown-it';
import mdAttrs from 'markdown-it-attrs';
import mdSpans from 'markdown-it-bracketed-spans';

// --- Определение режима сборки (Единый источник истины) ---
const args = process.argv.slice(2);
const envMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const argMode = args.includes('--prod') ? 'prod' : args.includes('--dev') ? 'dev' : null;

const MODE = argMode || envMode || 'dev';
const isProd = MODE === 'prod';
const isDev = !isProd;

const OUT_DIR = isProd ? 'dist/prod' : 'dist/dev';

const md = new MarkdownIt({
  html: true, // Позволяем HTML внутри MD (для таблиц)
  linkify: true,
  typographer: true
})
  .use(mdSpans)
  .use(mdAttrs);

console.log(`🚀 Режим сборки: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`📂 Выходная директория: ${OUT_DIR}`);

// --- Конфигурация модулей ---
const MODULES = {
  // ... (остальной конфиг без изменений)
  community: {
    pages: [
      {
        template: 'src/community/ui/community.template.html',
        contentDir: 'src/community/ui/content',
        outputName: 'community.html',
      }
    ],
    assets: ['src/course/ui/**/*.{css,ts,js,svg}'],
    dependencies: []
  },
  course: {
    pages: [
      {
        template: 'src/course/ui/course-landing.template.html',
        contentDir: 'src/course/ui/content',
        contentFiles: ['landing.md'], // Только один файл для лендинга
        outputName: 'course-landing.html',
      },
      {
        template: 'src/course/ui/course-details.template.html',
        contentDir: 'src/course/ui/content',
        excludeContent: ['landing.md'], // Все кроме лендинга
        outputName: 'course-details.html',
      },
      {
        template: 'src/course/ui/form.html', // Просто копия
        outputName: 'form.html'
      }
    ],
    assets: [
      'src/course/ui/**/*.{css,ts,js,svg}',
    ],
    dependencies: []
  }
};

// Общие зависимости (будут в корне dist)
const SHARED_DEPENDENCIES = [
  'src/app/ui/common.css',
  'src/app/ui/tracker.ts',
  'src/app/ui/user-session-manager.ts',
  'src/app/ui/tab-manager.ts'
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
  }

  // Собираем TypeScript общие зависимости
  const tsDeps = SHARED_DEPENDENCIES.filter(dep => dep.endsWith('.ts'));
  if (tsDeps.length > 0) {
    console.log('Сборка общих TypeScript файлов...');

    // Компилируем TS в JS
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
      // Добавляем скомпилированные JS файлы в список
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

// --- Вспомогательные функции для рендеринга ---

/**
 * Оборачивает части HTML в div.w3-container с чередованием фона.
 * Разделителем служит любой тег с классом .sw-bg-color
 */
function wrapHtmlSections(html: string): string {
  // Ищем теги с классом sw-bg-color (используем regex для поиска начала секций)
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
  const moduleOutDir = join(OUT_DIR, moduleName);
  await mkdir(moduleOutDir, { recursive: true });

  const copiedFiles: string[] = [];

  // 1. Обработка страниц
  for (const page of config.pages) {
    if (page.template && page.contentDir) {
      console.log(`[${moduleName}] Рендеринг страницы: ${page.outputName}`);
      let html = await readFile(page.template, 'utf-8');

      const mdFiles = await readdir(page.contentDir);
      for (const mdFile of mdFiles) {
        if (!mdFile.endsWith('.md')) continue;
        if (page.contentFiles && !page.contentFiles.includes(mdFile)) continue;
        if (page.excludeContent && page.excludeContent.includes(mdFile)) continue;

        const key = basename(mdFile, '.md');
        const content = await readFile(join(page.contentDir, mdFile), 'utf-8');
        let rendered = md.render(content);

        // Автоматическое оборачивание в секции (кроме лендинга и формы)
        if (mdFile !== 'landing.md' && !page.template.includes('form.html')) {
          rendered = wrapHtmlSections(rendered);
        }

        const placeholder = `<!-- CONTENT:${key} -->`;
        html = html.replace(new RegExp(placeholder, 'g'), rendered);
      }

      const outPath = join(moduleOutDir, page.outputName);
      await writeFile(outPath, html);
      console.log(`✅ [${moduleName}] HTML собран из шаблона: ${page.outputName}`);
      copiedFiles.push(page.outputName);
    } else if (page.template) {
      // Просто копия шаблона если нет контента
      const htmlName = page.outputName || basename(page.template);
      await copyFile(page.template, join(moduleOutDir, htmlName));
      copiedFiles.push(htmlName);
    }
  }

  // 2. Копируем ассеты модуля
  for (const assetPattern of config.assets) {
    const assetFiles = await findFiles(assetPattern);
    for (const assetFile of assetFiles) {
      // Пропускаем HTML и MD файлы и шаблоны
      if (assetFile.endsWith('.html') || assetFile.endsWith('.md') || assetFile.includes('.template.')) continue;

      const relativePath = assetFile.replace(`src/${moduleName}/ui/`, '');
      const destPath = join(moduleOutDir, relativePath);
      await copyFile(assetFile, destPath);
      copiedFiles.push(relativePath);
    }
  }

  // 3. Собираем TypeScript/JavaScript файлы
  const tsFiles = (await findFiles(`src/${moduleName}/ui/**/*.{ts,js}`))
    .filter(file => !file.endsWith('.test.ts') && !file.endsWith('.test.js'));

  if (tsFiles.length > 0) {
    console.log(`[${moduleName}] Сборка TypeScript/JavaScript...`);

    try {
      const result = await Bun.build({
        entrypoints: tsFiles,
        outdir: moduleOutDir,
        minify: isProd,
        sourcemap: isDev ? 'inline' : 'none',
        target: 'browser',
        format: 'esm',
        splitting: false,
      });

      if (result.success) {
        console.log(`✅ [${moduleName}] JavaScript/TypeScript успешно собраны.`);
        for (const entry of tsFiles) {
          const baseName = basename(entry, '.ts');
          copiedFiles.push(`${baseName}.js`);
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
    outDir: moduleOutDir,
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
