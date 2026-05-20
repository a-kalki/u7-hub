import { Db } from '@app/db';

export async function up(db: Db): Promise<void> {
  console.log("Running migration: 002_remove_promocode.ts - UP");

  // Создаем временную таблицу без promocode
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_submissions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      contact_method TEXT,
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

  // Копируем данные из старой таблицы (исключая promocode)
  db.exec(`
    INSERT INTO form_submissions_new (
      id, name, phone, submitted_at, contact_method, 
      how_found_us, why_interested, programming_experience, 
      language_interest, learning_format, preferred_day, 
      preferred_time, user_id, created_at, updated_at
    )
    SELECT 
      id, name, phone, submitted_at, contact_method, 
      how_found_us, why_interested, programming_experience, 
      language_interest, learning_format, preferred_day, 
      preferred_time, user_id, created_at, updated_at
    FROM form_submissions;
  `);

  // Удаляем старую таблицу и переименовываем новую
  db.exec("DROP TABLE form_submissions;");
  db.exec("ALTER TABLE form_submissions_new RENAME TO form_submissions;");
}

export async function down(db: Db): Promise<void> {
  console.log("Running migration: 002_remove_promocode.ts - DOWN");
  
  // Восстанавливаем таблицу с promocode
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_submissions_old (
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

  db.exec(`
    INSERT INTO form_submissions_old (
      id, name, phone, submitted_at, contact_method, 
      promocode, how_found_us, why_interested, programming_experience, 
      language_interest, learning_format, preferred_day, 
      preferred_time, user_id, created_at, updated_at
    )
    SELECT 
      id, name, phone, submitted_at, contact_method, 
      NULL, how_found_us, why_interested, programming_experience, 
      language_interest, learning_format, preferred_day, 
      preferred_time, user_id, created_at, updated_at
    FROM form_submissions;
  `);

  db.exec("DROP TABLE form_submissions;");
  db.exec("ALTER TABLE form_submissions_old RENAME TO form_submissions;");
}
