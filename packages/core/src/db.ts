import { Database, Statement } from 'bun:sqlite';

export class Db {
  private dbInstance: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.setupMigrationsTable();
  }

  public connect(): Database {
    if (!this.dbInstance) {
      try {
        this.dbInstance = new Database(this.dbPath);
      } catch (error: any) {
        console.error(`[DB] Error connecting to database: ${error.message}`);
        throw error;
      }
    }
    return this.dbInstance;
  }

  public close(): void {
    if (this.dbInstance) {
      this.dbInstance.close();
      this.dbInstance = null;
      console.log('[DB] Database connection closed.');
    }
  }

  // --- Basic Database Operations ---

  public run(sql: string, params?: any): import('bun:sqlite').Changes {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.run(params);
  }

  public all(sql: string, params?: any): any[] {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.all(params);
  }

  public get(sql: string, params?: any): any {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.get(params);
  }

  public exec(sql: string): void {
    const db = this.connect();
    db.exec(sql);
  }

  public prepare(sql: string): Statement {
    const db = this.connect();
    return db.prepare(sql);
  }

  // --- Migration System ---

  /**
   * Создает таблицу для отслеживания примененных миграций
   */
  private setupMigrationsTable(): void {
    const db = this.connect();
    
    // Создаем таблицу миграций если её нет
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Проверяем, есть ли уже данные в основных таблицах
    // Если есть - значит 001 миграция уже применена
    const hasFormSubmissions = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='form_submissions'
    `).get();
    
    const hasMigrations = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number };
    
    // Если таблица form_submissions существует, но в _migrations нет записей
    // значит это существующая БД где 001 уже применена
    if (hasFormSubmissions && hasMigrations.count === 0) {
      console.log('[DB] Detected existing database. Marking 001_initial_schema.ts as applied.');
      try {
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('001_initial_schema.ts');
      } catch (error) {
        // Игнорируем ошибку если запись уже существует (UNIQUE constraint)
        console.log('[DB] 001_initial_schema.ts already marked as applied');
      }
    }
  }

  /**
   * Получает список уже примененных миграций
   */
  private getAppliedMigrations(): string[] {
    const db = this.connect();
    try {
      const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as { name: string }[];
      return rows.map(row => row.name);
    } catch (error) {
      // Если таблицы _migrations еще нет, возвращаем пустой массив
      return [];
    }
  }

  /**
   * Отмечает миграцию как выполненную
   */
  private markMigrationAsApplied(migrationName: string): void {
    const db = this.connect();
    try {
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationName);
    } catch (error: any) {
      // Игнорируем ошибку UNIQUE constraint (миграция уже применена)
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw error;
      }
    }
  }

  /**
   * Запускает все непримененные миграции
   */
  public async runMigrations(migrationsDir: string): Promise<void> {
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    // Убедимся что таблица миграций создана
    this.setupMigrationsTable();

    // Получаем список файлов миграций
    const migrationFiles = (await readdir(migrationsDir))
      .filter(file => file.endsWith('.ts') && file.startsWith('0'))
      .sort();

    // Получаем уже примененные миграции
    const appliedMigrations = this.getAppliedMigrations();

    console.log(`[DB] Found ${migrationFiles.length} migration files`);
    console.log(`[DB] ${appliedMigrations.length} migrations already applied`);

    let appliedCount = 0;
    for (const file of migrationFiles) {
      // Пропускаем уже примененные миграции
      if (appliedMigrations.includes(file)) {
        console.log(`[DB] Skipping already applied migration: ${file}`);
        continue;
      }

      const migrationPath = join(process.cwd(), migrationsDir, file);
      const migration = await import(migrationPath);
      
      if (migration.up && typeof migration.up === 'function') {
        console.log(`[DB] Running migration UP: ${file}`);
        
        // Запускаем в транзакции для безопасности
        const db = this.connect();
        const transaction = db.transaction(() => {
          migration.up(this);
          this.markMigrationAsApplied(file);
        });

        try {
          transaction();
          console.log(`[DB] ✓ Migration ${file} applied successfully`);
          appliedCount++;
        } catch (error) {
          console.error(`[DB] ✗ Migration ${file} failed:`, error);
          throw error; // Прерываем весь процесс при ошибке
        }
      } else {
        console.warn(`[DB] Migration file ${file} does not export an 'up' function.`);
      }
    }
    
    console.log(`[DB] Applied ${appliedCount} new migrations`);
  }

  /**
   * Запускает конкретную миграцию (для экстренных случаев)
   */
  public async runSpecificMigration(migrationName: string): Promise<void> {
    const { join } = await import('node:path');
    const appliedMigrations = this.getAppliedMigrations();

    if (appliedMigrations.includes(migrationName)) {
      console.log(`[DB] Migration ${migrationName} is already applied`);
      return;
    }

    const migrationPath = join(process.cwd(), 'migrations', migrationName);
    const migration = await import(migrationPath);
    
    if (migration.up && typeof migration.up === 'function') {
      console.log(`[DB] Running specific migration: ${migrationName}`);
      
      const db = this.connect();
      const transaction = db.transaction(() => {
        migration.up(this);
        this.markMigrationAsApplied(migrationName);
      });

      try {
        transaction();
        console.log(`[DB] ✓ Specific migration ${migrationName} applied successfully`);
      } catch (error) {
        console.error(`[DB] ✗ Specific migration ${migrationName} failed:`, error);
        throw error;
      }
    } else {
      throw new Error(`Migration ${migrationName} does not export an 'up' function`);
    }
  }

  /**
   * Откатывает последнюю миграцию (только для разработки)
   */
  public async rollbackLastMigration(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Rollback is not allowed in production');
    }

    const db = this.connect();
    const lastMigration = db.prepare(
      'SELECT name FROM _migrations ORDER BY id DESC LIMIT 1'
    ).get() as { name: string } | undefined;

    if (!lastMigration) {
      console.log('[DB] No migrations to rollback');
      return;
    }

    const { join } = await import('node:path');
    const migrationPath = join(process.cwd(), 'migrations', lastMigration.name);
    const migration = await import(migrationPath);

    if (migration.down && typeof migration.down === 'function') {
      console.log(`[DB] Rolling back migration: ${lastMigration.name}`);
      
      const transaction = db.transaction(() => {
        migration.down(this);
        db.prepare('DELETE FROM _migrations WHERE name = ?').run(lastMigration.name);
      });

      try {
        transaction();
        console.log(`[DB] ✓ Migration ${lastMigration.name} rolled back`);
      } catch (error) {
        console.error(`[DB] ✗ Rollback of ${lastMigration.name} failed:`, error);
        throw error;
      }
    } else {
      console.warn(`[DB] Migration ${lastMigration.name} does not have a 'down' function`);
    }
  }

  /**
   * Показывает статус миграций
   */
  public getMigrationStatus(): { applied: string[]; pending: string[] } {
    const { readdirSync } = require('node:fs');
    const { join } = require('node:path');

    try {
      const allMigrations = readdirSync('migrations')
        .filter((file: string) => file.endsWith('.ts') && file.startsWith('0'))
        .sort();

      const appliedMigrations = this.getAppliedMigrations();
      const pendingMigrations = allMigrations.filter((file: string) => !appliedMigrations.includes(file));

      return {
        applied: appliedMigrations,
        pending: pendingMigrations
      };
    } catch (error) {
      console.error('[DB] Error getting migration status:', error);
      return { applied: [], pending: [] };
    }
  }
}
