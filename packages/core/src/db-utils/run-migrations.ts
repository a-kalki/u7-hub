import { cwd } from 'process';
import { join } from 'path';
import { Db } from '@app/db';

const migrationsDir = 'src/app/migrations';

function showHelp() {
  console.log(`
Использование: bun run db-utils/run-migrations.ts [опции]

Опции:
  --force            Принудительный запуск миграций (обязателен для выполнения)
  --status           Показать статус миграций
  --rollback         Откатить последнюю миграцию (только для разработки)
  --migration <имя>  Запустить конкретную миграцию
  --help             Показать эту справку

Примеры:
  bun run src/app/db-utils/run-migrations.ts --status      # Показать статус
  bun run src/app/db-utils/run-migrations.ts --force       # Запустить все миграции
  bun run src/app/db-utils/run-migrations.ts --force --migration=002_remove_promocode.ts  # Конкретная миграция
  bun run src/app/db-utils/run-migrations.ts --rollback    # Откатить последнюю миграцию
  `);
}

async function main() {
  const projectDir = cwd();
  const dbPath = join(projectDir, 'course.sqlite');

  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    showHelp();
    return; // Выйти сразу после показа помощи
  }

  const forceRun = args.includes('--force');
  const specificMigration = args.find(arg => arg.startsWith('--migration='))?.split('=')[1];
  const rollback = args.includes('--rollback');
  const status = args.includes('--status');

  // Всегда показываем предупреждение для миграций без --force
  if (!forceRun && !status && !rollback) {
    console.error('❌ ОШИБКА: Запуск миграций требует флага --force');
    console.error('   Используйте: bun run src/app/db-utils/run-migrations.ts --force');
    console.error('   Или для проверки статуса: bun src/app/run db-utils/run-migrations.ts --status');
    console.error('   Для справки: bun run src/app/db-utils/run-migrations.ts --help');
    process.exit(1);
  }

  console.log(`🚀 Запуск управления миграциями`);
  console.log(`📍 База данных: ${dbPath}`);
  console.log(`📍 Окружение: ${process.env.NODE_ENV || 'development'}`);

  try {
    const db = new Db(dbPath);

    if (status) {
      // Показать статус миграций
      const migrationStatus = db.getMigrationStatus();
      console.log('📊 Статус миграций:');
      console.log(`✅ Примененные: ${migrationStatus.applied.length}`);
      console.log(`⏳ Ожидающие: ${migrationStatus.pending.length}`);
      migrationStatus.applied.forEach((m: string) => console.log(`   ✓ ${m}`));
      migrationStatus.pending.forEach((m: string) => console.log(`   ○ ${m}`));
      return;
    }

    if (rollback) {
      // Откат последней миграции
      await db.rollbackLastMigration();
      return;
    }

    if (specificMigration) {
      // Запуск конкретной миграции
      console.log(`🎯 Запуск миграции: ${specificMigration}`);
      await db.runSpecificMigration(specificMigration);
    } else {
      // Запуск всех непримененных миграций
      console.log('🔄 Запуск всех непримененных миграций...');
      await db.runMigrations(migrationsDir);
    }

    console.log('✅ Операция завершена успешно');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

main();
