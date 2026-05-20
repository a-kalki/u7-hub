import { Database } from 'bun:sqlite';
import { FormSubmissionsRepository } from '@course/api/repositories/formSubmissionsRepository';

function showHelp() {
  console.log(`
Использование: bun run db-utils/view-submissions.ts [опции]

Опции:
  --limit <число>    Количество последних заявок для показа (по умолчанию: 10)
  --user <userId>    Фильтровать заявки по ID пользователя
  --date <дата>      Фильтровать по дате (формат ГГГГ-ММ-ДД)
  --format <формат>  Формат вывода: json, table, csv (по умолчанию: table)
  --json             Короткий алиас для --format=json
  --help             Показать эту справку

Примеры:
  bun run db-utils/view-submissions.ts
  bun run db-utils/view-submissions.ts --limit 20
  bun run db-utils/view-submissions.ts --user "user123" --json
  bun run db-utils/view-submissions.ts --date "2024-01-15" --limit 5 --format csv
  `);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }

  const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10');
  const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1];
  const date = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const format = args.includes('--json') ? 'json' : 
                 args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'table';

  const db = new Database('course.sqlite');
  const repo = new FormSubmissionsRepository(db);

  try {
    let submissions;
    
    if (userId || date) {
      submissions = repo.getFilteredSubmissions({ userId, date, limit });
    } else {
      submissions = repo.getLatest(limit);
    }

    console.log(`📝 Найдено ${submissions.length} заявок`);
    formatSubmissions(submissions, format);
    
  } catch (error) {
    console.error('❌ Ошибка при получении заявок:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

function truncateLongValues(obj: any, maxLength: number = 30): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const truncated = { ...obj };
  for (const key in truncated) {
    if (typeof truncated[key] === 'string' && truncated[key].length > maxLength) {
      truncated[key] = truncated[key].substring(0, maxLength) + '...';
    }
  }
  return truncated;
}

function formatSubmissions(submissions: any[], format: string) {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(submissions, null, 2));
      break;
    
    case 'csv':
      if (submissions.length === 0) return;
      // Убираем ненужные поля для CSV
      const filteredSubmissions = submissions.map(({ created_at, updated_at, ...rest }) => rest);
      const headers = Object.keys(filteredSubmissions[0]).join(',');
      console.log(headers);
      filteredSubmissions.forEach(submission => {
        const values = Object.values(submission).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',');
        console.log(values);
      });
      break;
    
    case 'table':
    default:
      // Убираем created_at, updated_at и укорачиваем длинные строки
      const simplified = submissions.map(sub => {
        const { created_at, updated_at, ...rest } = sub;
        return truncateLongValues({
          id: rest.id,
          name: rest.name,
          phone: rest.phone,
          submitted_at: rest.submitted_at,
          contact_method: rest.contact_method,
          how_found_us: rest.how_found_us,
          why_interested: rest.why_interested,
          programming_experience: rest.programming_experience,
          language_interest: rest.language_interest,
          learning_format: rest.learning_format,
          preferred_day: rest.preferred_day,
          preferred_time: rest.preferred_time
        }, 20);
      });
      console.table(simplified);
      break;
  }
}

main();
