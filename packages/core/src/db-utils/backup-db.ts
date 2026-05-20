import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

function showHelp() {
  console.log(`
Использование: bun run db-utils/backup-db.ts [опции]

Опции:
  --name <имя>      Произвольное имя для файла бэкапа
  --retain <дни>    Хранить бэкапы только за последние N дней (по умолчанию: 30)
  --list            Показать существующие бэкапы
  --cleanup         Удалить бэкапы старше периода хранения
  --help            Показать эту справку

Примеры:
  bun run db-utils/backup-db.ts                    # Создать бэкап с временной меткой
  bun run db-utils/backup-db.ts --name pre-migration  # Создать именованный бэкап
  bun run db-utils/backup-db.ts --list             # Показать все бэкапы
  bun run db-utils/backup-db.ts --cleanup          # Очистить старые бэкапы
  bun run db-utils/backup-db.ts --retain 7         # Установить период хранения 7 дней
  `);
}

function ensureBackupDir(): string {
  const backupDir = join(process.cwd(), 'db-backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${backupDir}`);
  }
  return backupDir;
}

function createBackup(backupName?: string): void {
  const dbPath = process.env.DB_PATH || 'course.sqlite';
  const sourceDb = join(process.cwd(), dbPath);
  
  if (!existsSync(sourceDb)) {
    console.log('ℹ️  Source database file not found, skipping backup.');
    return;
  }

  const backupDir = ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = backupName 
    ? `course-${backupName}-${timestamp}.sqlite`
    : `course-backup-${timestamp}.sqlite`;
  
  const backupPath = join(backupDir, backupFileName);

  try {
    copyFileSync(sourceDb, backupPath);
    
    // Проверяем что файл скопировался
    const stats = require('fs').statSync(backupPath);
    
    console.log(`✅ Backup created successfully:`);
    console.log(`   Source: ${sourceDb}`);
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    process.exit(1);
  }
}

function listBackups(): void {
  const backupDir = ensureBackupDir();
  
  try {
    const fs = require('fs');
    const files = fs.readdirSync(backupDir)
      .filter((file: string) => file.endsWith('.sqlite'))
      .map((file: string) => {
        const filePath = join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
      .sort((a: any, b: any) => b.modified - a.modified);

    if (files.length === 0) {
      console.log('📁 No backups found');
      return;
    }

    console.log(`📋 Found ${files.length} backups:`);
    console.log('='.repeat(80));
    
    files.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Modified: ${file.modified.toLocaleString()}`);
      console.log(`   Age: ${file.age} days ago`);
      console.log('-'.repeat(40));
    });

    const totalSize = files.reduce((sum: number, file: any) => sum + file.size, 0);
    console.log(`💾 Total backup size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Error listing backups:', error);
  }
}

function cleanupBackups(retainDays: number = 30): void {
  const backupDir = ensureBackupDir();
  
  try {
    const fs = require('fs');
    const files = fs.readdirSync(backupDir)
      .filter((file: string) => file.endsWith('.sqlite'))
      .map((file: string) => {
        const filePath = join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          modified: stats.mtime,
          age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24))
        };
      });

    const oldBackups = files.filter((file: any) => file.age > retainDays);
    
    if (oldBackups.length === 0) {
      console.log(`✅ No backups older than ${retainDays} days found`);
      return;
    }

    console.log(`🗑️  Found ${oldBackups.length} backups older than ${retainDays} days:`);
    
    oldBackups.forEach((file: any) => {
      console.log(`   - ${file.name} (${file.age} days old)`);
      fs.unlinkSync(file.path);
    });

    console.log(`✅ Removed ${oldBackups.length} old backups`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }

  if (args.includes('--list')) {
    listBackups();
    return;
  }

  if (args.includes('--cleanup')) {
    const retainDays = parseInt(args.find(arg => arg.startsWith('--retain='))?.split('=')[1] || '30');
    cleanupBackups(retainDays);
    return;
  }

  // Если указан --retain без --cleanup, игнорируем
  const retainIndex = args.findIndex(arg => arg.startsWith('--retain='));
  if (retainIndex !== -1 && !args.includes('--cleanup')) {
    args.splice(retainIndex, 1);
  }

  const backupName = args.find(arg => arg.startsWith('--name='))?.split('=')[1];
  
  createBackup(backupName);
}

main();
