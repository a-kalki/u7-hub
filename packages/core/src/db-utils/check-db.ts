import { Db } from '@app/db';

const db = new Db('course.sqlite');

console.log('🔍 Проверка состояния базы данных...');

// Проверяем существующие таблицы
const tables = db.all(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
`) as { name: string }[];

console.log('📋 Существующие таблицы:');
tables.forEach(table => console.log(`   - ${table.name}`));

// Проверяем данные в form_submissions
const submissionCount = db.get('SELECT COUNT(*) as count FROM form_submissions') as { count: number };
console.log(`📊 Записей в form_submissions: ${submissionCount.count}`);

// Проверяем таблицу миграций
const migrationCount = db.get('SELECT COUNT(*) as count FROM _migrations') as { count: number };
console.log(`🔄 Записей в _migrations: ${migrationCount.count}`);

if (migrationCount.count === 0 && submissionCount.count > 0) {
  console.log('💡 Рекомендация: База данных существует, но система миграций не инициализирована.');
  console.log('   Запустите: bun run db-utils/run-migrations.ts --force');
}
