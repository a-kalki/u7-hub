// migrations/000_initial_migration.ts
import { Db } from '@app/db';

export async function up(db: Db): Promise<void> {
  console.log("Running migration: 000_initial_migration.ts - UP");
  
  // Эта миграция только создает таблицу _migrations
  // и отмечает, что текущая схема уже соответствует миграции 001
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Помечаем, что 001_initial_schema уже применена
  db.exec(`INSERT OR IGNORE INTO _migrations (name) VALUES ('001_initial_schema.ts')`);
}

export async function down(db: Db): Promise<void> {
  console.log("Running migration: 000_initial_migration.ts - DOWN");
  // Осторожно с down для initial миграции!
  // db.exec("DROP TABLE IF EXISTS _migrations;");
}
