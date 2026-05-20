import { Db } from '@app/db';

export async function up(db: Db): Promise<void> {
  console.log("Running migration: 003_update_why_interested_text.ts - UP");

  // Обновляем текст в существующих записях
  db.exec(`
    UPDATE form_submissions 
    SET why_interested = REPLACE(why_interested, '"Решил попробовать из за бесплатных уроков"', '"Так бесплатно же!"')
    WHERE why_interested LIKE '%Решил попробовать из за бесплатных уроков%'
  `);

  // Также обновляем если значение хранится как массив JSON
  db.exec(`
    UPDATE form_submissions 
    SET why_interested = REPLACE(why_interested, 'Решил попробовать из за бесплатных уроков', 'Так бесплатно же!')
    WHERE why_interested LIKE '%Решил попробовать из за бесплатных уроков%'
  `);

  console.log("Updated why_interested text from 'Решил попробовать из за бесплатных уроков' to 'Так бесплатно же!'");
}

export async function down(db: Db): Promise<void> {
  console.log("Running migration: 003_update_why_interested_text.ts - DOWN");
  
  // Возвращаем обратно старый текст
  db.exec(`
    UPDATE form_submissions 
    SET why_interested = REPLACE(why_interested, '"Так бесплатно же!"', '"Решил попробовать из за бесплатных уроков"')
    WHERE why_interested LIKE '%Так бесплатно же!%'
  `);

  db.exec(`
    UPDATE form_submissions 
    SET why_interested = REPLACE(why_interested, 'Так бесплатно же!', 'Решил попробовать из за бесплатных уроков')
    WHERE why_interested LIKE '%Так бесплатно же!%'
  `);

  console.log("Reverted why_interested text from 'Так бесплатно же!' to 'Решил попробовать из за бесплатных уроков'");
}
