/**
 * Тесты для saveAnalyticsData (сервис аналитики)
 *
 * Проверяет: что сервис корректно вызывает UserEventsRepository.save()
 */
import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { Database } from 'bun:sqlite';
import { saveAnalyticsData } from '@course/api/services/analytics';

describe('saveAnalyticsData', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
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
        device_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('должен сохранять данные через репозиторий', async () => {
    const data = {
      userId: 'user_test',
      pageName: 'course-landing',
      pageVariant: 'v1_initial',
      timeSpent_sec: 60,
      scrollDepth_perc: 50,
      finalAction: 'close',
      navigationPath: [],
      sectionViewTimes: {},
      deviceInfo: { isMobile: false }
    };

    await saveAnalyticsData(db, data);

    const count = db.prepare('SELECT COUNT(*) as count FROM user_events').get() as { count: number };
    expect(count.count).toBe(1);
  });

  it('должен корректно передавать все поля в БД', async () => {
    const data = {
      userId: 'user_complex',
      pageName: 'course-details',
      pageVariant: 'v2_test',
      timeSpent_sec: 300,
      scrollDepth_perc: 100,
      finalAction: 'link_click_telegram',
      navigationPath: [{ fromTab: 'mission', toTab: 'reviews', scroll_perc: 80, timestamp: '2025-01-01T00:00:00Z' }],
      sectionViewTimes: { intro: 15.2, reviews: 42.1 },
      deviceInfo: { isMobile: true, browser: 'safari', platform: 'iOS' }
    };

    await saveAnalyticsData(db, data);

    const event = db.prepare('SELECT * FROM user_events').get() as any;
    expect(event.user_id).toBe('user_complex');
    expect(event.page_name).toBe('course-details');
    expect(event.page_variant).toBe('v2_test');
    expect(event.time_spent_sec).toBe(300);
    expect(event.scroll_depth_perc).toBe(100);
    expect(event.final_action).toBe('link_click_telegram');
    expect(JSON.parse(event.navigation_path)).toEqual(data.navigationPath);
    expect(JSON.parse(event.section_view_times)).toEqual(data.sectionViewTimes);
    expect(JSON.parse(event.device_info)).toEqual(data.deviceInfo);
  });

  it('должен обрабатывать пустые/минимальные данные', async () => {
    const minimalData = {
      userId: 'user_min',
      pageName: 'unknown',
      pageVariant: 'unknown',
      timeSpent_sec: 0,
      scrollDepth_perc: 0,
      finalAction: 'close',
      navigationPath: [],
      sectionViewTimes: {},
      deviceInfo: {}
    };

    await saveAnalyticsData(db, minimalData);

    const count = db.prepare('SELECT COUNT(*) as count FROM user_events').get() as { count: number };
    expect(count.count).toBe(1);
  });

  it('должен выбрасывать ошибку при невалидной БД', async () => {
    const badDb = new Database(':memory:'); // без таблицы

    const data = {
      userId: 'user',
      pageName: 'page',
      pageVariant: 'v1',
      timeSpent_sec: 1,
      scrollDepth_perc: 1,
      finalAction: 'close',
      navigationPath: [],
      sectionViewTimes: {},
      deviceInfo: {}
    };

    await expect(saveAnalyticsData(badDb, data)).rejects.toThrow();
    badDb.close();
  });
});
