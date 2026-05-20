import { Db } from '@app/db';

export async function up(db: Db): Promise<void> {
  console.log("Running migration: 001_initial_schema.ts - UP");

  // Таблица для отправленных форм
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      contact_method TEXT,
      promocode TEXT,
      how_found_us TEXT,
      why_interested TEXT,
      programming_experience TEXT,
      language_interest TEXT,
      learning_format TEXT,
      preferred_day TEXT,
      preferred_time TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
  db.exec("DROP TABLE IF EXISTS form_submissions;");
  db.exec("DROP TABLE IF EXISTS user_events;");
}
