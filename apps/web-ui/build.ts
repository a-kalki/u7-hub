import { rm, mkdir, readdir, cp, stat, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import MarkdownIt from 'markdown-it';
import mdAttrs from 'markdown-it-attrs';
import mdSpans from 'markdown-it-bracketed-spans';

// --- Корень проекта (относительно apps/web-ui) ---
const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const PKG_CORE = join(PROJECT_ROOT, 'packages/core');
const PKG_COURSE = join(PROJECT_ROOT, 'packages/nur-course');
const PKG_COMMUNITY = join(PROJECT_ROOT, 'packages/community');
const PKG_WORKSHOP = join(PROJECT_ROOT, 'packages/u7-workshop');
const PKG_CRAFTYARD = join(PROJECT_ROOT, 'packages/craftyard');

// --- Вспомогательная функция для сборки TS через bun build CLI ---
async function bunBuildCli(options: {
  entrypoints: string[],
  outdir: string,
  minify: boolean,
  sourcemap?: string,
  target?: string,
  format?: string,
  splitting?: boolean,
}): Promise<{ success: boolean, logs: string[] }> {
  const args = ['build', ...options.entrypoints];
  args.push('--outdir', options.outdir);
  if (options.minify) args.push('--minify');
  if (options.sourcemap && options.sourcemap !== 'none') {
    args.push('--sourcemap');
    if (options.sourcemap === 'inline') args.push('--inline');
  }
  if (options.target) args.push('--target', options.target);
  if (options.format) args.push('--format', options.format);
  if (options.splitting) args.push('--splitting');
  args.push('--tsconfig-override', join(PROJECT_ROOT, 'tsconfig.json'));

  const proc = Bun.spawnSync(['bun', ...args], { cwd: PROJECT_ROOT });
  const logs: string[] = [];
  if (proc.stdout?.length) logs.push(proc.stdout.toString());
  if (proc.stderr?.length) logs.push(proc.stderr.toString());

  return { success: proc.exitCode === 0, logs };
}

// --- Определение режима сборки ---
const args = process.argv.slice(2);
const envMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const argMode = args.includes('--prod') ? 'prod' : args.includes('--dev') ? 'dev' : null;

const MODE = argMode || envMode || 'dev';
const isProd = MODE === 'prod';

const OUT_DIR = join(import.meta.dir, 'dist', isProd ? 'prod' : 'dev');

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
const MODULES = {
  community: {
    pages: [
      {
        template: join(PKG_COMMUNITY, 'src/ui/community.template.html'),
        contentDir: join(PKG_COMMUNITY, 'src/ui/content'),
        outputPath: 'community/index.html',
      }
    ],
    assets: [],
    dependencies: []
  },
  'workshop': {
    pages: [
      {
        template: join(PKG_WORKSHOP, 'src/ui/workshop.template.html'),
        contentDir: join(PKG_WORKSHOP, 'src/ui/content'),
        outputPath: 'workshop/index.html',
      }
    ],
    assets: [
      join(PKG_WORKSHOP, 'src/ui/**/*.{css,js,ts,svg,png,jpg}'),
    ],
    dependencies: []
  },
  'craftyard': {
    pages: [
      {
        template: join(PKG_CRAFTYARD, 'src/ui/craftyard.template.html'),
        contentDir: join(PKG_CRAFTYARD, 'src/ui/content'),
        outputPath: 'craftyard/index.html',
      }
    ],
    assets: [],
    dependencies: []
  },
  'nur-courses': {
    pages: [
      {
        template: join(PKG_COURSE, 'src/ui/course-landing.template.html'),
        contentDir: join(PKG_COURSE, 'src/ui/content'),
        contentFiles: ['landing.md'],
        outputPath: 'nur-courses/index.html',
      },
      {
        template: join(PKG_COURSE, 'src/ui/course-details.template.html'),
        contentDir: join(PKG_COURSE, 'src/ui/content'),
        excludeContent: ['landing.md'],
        outputPath: 'nur-courses/details/index.html',
      }
    ],
    assets: [
      join(PKG_COURSE, 'src/ui/**/*.{css,ts,js,svg}'),
    ],
    dependencies: []
  }
};

// Общие зависимости (будут в корне dist)
const SHARED_DEPENDENCIES = [
  join(PKG_CORE, 'src/ui/common.css'),
  join(PKG_CORE, 'src/ui/tracker.ts'),
  join(PKG_CORE, 'src/ui/user-session-manager.ts'),
  join(PKG_CORE, 'src/ui/tab-manager.ts')
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
  const absolutePattern = join(PROJECT_ROOT, pattern);
  const glob = new Bun.Glob(absolutePattern);
  const files = [];
  for await (const file of glob.scan(PROJECT_ROOT)) {
    // file — абсолютный путь, делаем относительным от PROJECT_ROOT
    const relativeFile = relative(PROJECT_ROOT, file);
    if (!relativeFile.endsWith('.test.ts') && !relativeFile.includes('.test.')) {
      files.push(relativeFile);
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

    const result = await bunBuildCli({
      entrypoints: tsDeps,
      outdir: OUT_DIR,
      minify: isProd,
      sourcemap: 'none',
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

      // Удаляем исходные .ts файлы из выходной директории
      for (const tsDep of tsDeps) {
        const name = basename(tsDep);
        const tsPath = join(OUT_DIR, name);
        try { await rm(tsPath); } catch { /* ignore */ }
      }
    } else {
      console.error('❌ Ошибка сборки общих зависимостей:');
      for (const log of result.logs) console.error(log);
      throw new Error('Сборка общих зависимостей завершилась с ошибками');
    }
  }

  return copiedFiles;
}

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
        let rendered: string;
        if (page.rawContent) {
          rendered = content;
        } else {
          rendered = md.render(content);
        }

        if (!page.rawContent && mdFile !== 'landing.md') {
          rendered = wrapHtmlSections(rendered);
        }

        const placeholder = `<!-- CONTENT:${key} -->`;
        html = html.replace(new RegExp(placeholder, 'g'), rendered);
      }

      const outPath = join(OUT_DIR, page.outputPath);
      await mkdir(dirname(outPath), { recursive: true });
      html = html.replace(/\{\{CURRENT_YEAR\}\}/g, String(new Date().getFullYear()));

      await writeFile(outPath, html);
      console.log(`✅ [${moduleName}] HTML собран: ${page.outputPath}`);
      copiedFiles.push(page.outputPath);
    } else if (page.template) {
      const outPath = join(OUT_DIR, page.outputPath);
      await mkdir(dirname(outPath), { recursive: true });
      let tmplHtml = await readFile(page.template, 'utf-8');
      tmplHtml = tmplHtml.replace(/\{\{CURRENT_YEAR\}\}/g, String(new Date().getFullYear()));
      await writeFile(outPath, tmplHtml);
      copiedFiles.push(page.outputPath);
    }
  }

  // 2. Копируем ассеты модуля
  for (const assetPattern of config.assets) {
    // Сканируем от корня проекта
    const repoRelative = relative(PROJECT_ROOT, assetPattern);
    const assetFiles = await findFiles(repoRelative);
    const absAssetFiles = assetFiles.map(f => join(PROJECT_ROOT, f));

    for (const absFile of absAssetFiles) {
      if (absFile.endsWith('.html') || absFile.endsWith('.md') || absFile.includes('.template.')) continue;
      // Исключаем старый дизайн и бэкап
      if (absFile.includes('/backup/')) continue;
      if (absFile.endsWith('/styles.css') || absFile.endsWith('/script.js')) continue;

      const starIndex = assetPattern.indexOf('*');
      const basePath = starIndex >= 0 ? assetPattern.substring(0, starIndex) : assetPattern;
      const moduleRelativePath = relative(basePath, absFile);

      const destPath = join(OUT_DIR, moduleName, moduleRelativePath);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(absFile, destPath);
      copiedFiles.push(join(moduleName, moduleRelativePath));
    }
  }

  // 3. Собираем TypeScript файлы из ассетов
  const tsFiles: string[] = [];
  for (const assetPattern of config.assets) {
    const repoRelative = relative(PROJECT_ROOT, assetPattern);
    const files = await findFiles(repoRelative);
    for (const file of files) {
      const absFile = join(PROJECT_ROOT, file);
      if ((absFile.endsWith('.ts') || absFile.endsWith('.js')) && !absFile.endsWith('.test.ts') && !absFile.endsWith('.test.js')) {
        tsFiles.push(absFile);
      }
    }
  }

  const uniqueTsFiles = [...new Set(tsFiles)];

  if (uniqueTsFiles.length > 0) {
    console.log(`[${moduleName}] Сборка TypeScript...`);

    try {
      const result = await bunBuildCli({
        entrypoints: uniqueTsFiles,
        outdir: join(OUT_DIR, moduleName),
        minify: isProd,
        sourcemap: 'none',
        target: 'browser',
        format: 'esm',
        splitting: false,
      });

      if (result.success) {
        console.log(`✅ [${moduleName}] TypeScript успешно собран.`);

        for (const entry of uniqueTsFiles) {
          if (!entry.endsWith('.ts')) continue;

          let found = false;
          for (const assetPattern of config.assets) {
            const starIdx = assetPattern.indexOf('*');
            const base = starIdx >= 0 ? assetPattern.substring(0, starIdx) : assetPattern;
            if (entry.startsWith(base)) {
              const moduleRelativePath = relative(base, entry);
              const tsPath = join(OUT_DIR, moduleName, moduleRelativePath);
              try { await rm(tsPath); } catch { /* ignore */ }
              found = true;
              break;
            }
          }
          if (!found) {
            console.log(`⚠️  Не найден assetPattern для ${entry}`);
          }
        }
      } else {
        console.error(`❌ [${moduleName}] Ошибка сборки TypeScript:`);
        for (const log of result.logs) console.error(log);
        throw new Error(`Сборка TypeScript для модуля ${moduleName} завершилась с ошибками`);
      }
    } catch (error: any) {
      console.error(`💥 [${moduleName}] Критическая ошибка:`, error.message);
      throw error;
    }
  }

  return { moduleName, files: copiedFiles };
}

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

async function runBuild() {
  try {
    await cleanAndCreateDir();

    const buildResults = [];

    const sharedFiles = await buildSharedDependencies();

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

    console.log('\n📁 Структура выходной директории:');
    try {
      const structureLines = await printDirectoryStructure(OUT_DIR);
      structureLines.forEach(line => console.log(line));
    } catch (error) {
      console.log('❌ Не удалось отобразить структуру:', error);
    }

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
