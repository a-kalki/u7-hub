import { Database } from 'bun:sqlite';
import { UserEventsRepository } from '#repositories/userEventsRepository';
import { join } from 'node:path';

function showHelp() {
  console.log(`
Использование: bun run packages/core/src/db-utils/view-events.ts [опции]

Опции:
  --limit <число>    Количество последних событий для показа (по умолчанию: 15)
  --user <userId>    Фильтровать события по ID пользователя
  --page <pageName>  Фильтровать события по названию страницы
  --format <формат>  Формат вывода: json, table, csv (по умолчанию: table)
  --json             Короткий алиас для --format=json
  --watch            Обновлять данные каждые 2 секунды
  --db <путь>        Путь к файлу БД (по умолчанию: автоматически по NODE_ENV)
  --help             Показать эту справку

Примеры:
  bun run packages/core/src/db-utils/view-events.ts --limit 20
  bun run packages/core/src/db-utils/view-events.ts --watch
  `);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }

  // Парсинг аргументов
  const getArgValue = (name: string) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    if (arg) return arg.split('=')[1];
    const index = args.indexOf(`--${name}`);
    if (index !== -1 && args[index + 1]) return args[index + 1];
    return null;
  };

  const limit = parseInt(getArgValue('limit') || '15');
  const userId = getArgValue('user');
  const pageName = getArgValue('page');
  const format = args.includes('--json') ? 'json' : (getArgValue('format') || 'table');
  const isWatch = args.includes('--watch');
  
  // Определяем путь к БД
  const defaultDbPath = process.env.NODE_ENV === 'production' ? 'course.sqlite' : 'course.sqlite';
  const dbPath = getArgValue('db') || defaultDbPath;

  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log(`🔌 Подключение к БД: ${dbPath}`);
  console.log(`🔍 Фильтр: ${userId ? `User=${userId}` : 'Все'} ${pageName ? `Page=${pageName}` : ''}`);

  const run = () => {
    const db = new Database(dbPath);
    const repo = new UserEventsRepository(db);

    try {
      let events;
      if (userId || pageName) {
        events = repo.getFilteredEvents({ userId, pageName, limit });
      } else {
        events = repo.getLatest(limit);
      }

      if (isWatch) {
        console.clear();
        console.log(`👀 Режим наблюдения (Ctrl+C для выхода)`);
        console.log(`📅 Обновлено: ${new Date().toLocaleTimeString()}`);
        console.log(`📊 Последние ${events.length} событий:`);
      } else {
        console.log(`📊 Найдено ${events.length} событий:`);
      }

      formatEvents(events, format);
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      if (!isWatch) process.exit(1);
    } finally {
      db.close();
    }
  };

  run();

  if (isWatch) {
    setInterval(run, 2000);
  }
}

function truncateLongValues(obj: any, maxLength: number = 50): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const truncated = { ...obj };
  for (const key in truncated) {
    if (typeof truncated[key] === 'string' && truncated[key].length > maxLength) {
      truncated[key] = truncated[key].substring(0, maxLength) + '...';
    }
  }
  return truncated;
}

function formatEvents(events: any[], format: string) {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(events, null, 2));
      break;
    
    case 'csv':
      if (events.length === 0) return;
      // Убираем ненужные поля для CSV
      const filteredEvents = events.map(({ created_at, updated_at, ...rest }) => rest);
      const headers = Object.keys(filteredEvents[0]).join(',');
      console.log(headers);
      filteredEvents.forEach(event => {
        const values = Object.values(event).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',');
        console.log(values);
      });
      break;
    
    case 'table':
    default:
      // Убираем created_at, updated_at и укорачиваем длинные строки
      const truncatedEvents = events.map(event => {
        const { created_at, updated_at, ...rest } = event;
        return truncateLongValues(rest, 30);
      });
      console.table(truncatedEvents);
      break;
  }
}

main();
