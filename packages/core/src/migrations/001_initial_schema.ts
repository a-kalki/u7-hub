import { Db } from '#db';

export async function up(db: Db): Promise<void> {
  console.log("Running migration: 001_initial_schema.ts - UP");

  // Таблица для событий аналитики
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      page_name TEXT,
      page_variant TEXT,
      time_spent_sec INTEGER,
      scroll_depth_perc INTEGER,
      final_action TEXT,
      navigation_path TEXT,
      section_view_times TEXT,
      device_info TEXT, -- Новое поле для информации об устройстве
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function down(db: Db): Promise<void> {
  console.log("Running migration: 001_initial_schema.ts - DOWN");
  db.exec("DROP TABLE IF EXISTS user_events;");
}
