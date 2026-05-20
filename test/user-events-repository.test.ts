/**
 * Тесты для UserEventsRepository
 *
 * Проверяет: сохранение событий, подсчёт, получение последних,
 * фильтрацию по userId/pageName, JSON-сериализацию сложных полей.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { UserEventsRepository } from '@course/api/repositories/userEventsRepository';

describe('UserEventsRepository', () => {
  let db: Database;
  let repo: UserEventsRepository;

  /** Базовое событие для тестов */
  const baseEvent = {
    userId: 'user_test_123',
    pageName: 'course-landing',
    pageVariant: 'v1_initial',
    timeSpent_sec: 120,
    scrollDepth_perc: 75,
    finalAction: 'close',
    navigationPath: [
      { fromTab: 'tab1', toTab: 'tab2', scroll_perc: 50, timestamp: '2025-01-01T00:00:00Z' }
    ],
    sectionViewTimes: { 'intro': 10.5, 'program': 25.2 },
    deviceInfo: {
      isMobile: false,
      userAgent: 'test-agent',
      browser: 'chrome',
      platform: 'test',
      screenWidth: 1920,
      screenHeight: 1080
    }
  };

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
    repo = new UserEventsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('save', () => {
    it('должен сохранять событие и возвращать успех', () => {
      expect(() => repo.save(baseEvent)).not.toThrow();
    });

    it('должен сохранять событие с корректными данными', () => {
      repo.save(baseEvent);

      const events = repo.getLatest(1);
      expect(events).toHaveLength(1);
      expect(events[0].user_id).toBe('user_test_123');
      expect(events[0].page_name).toBe('course-landing');
      expect(events[0].page_variant).toBe('v1_initial');
      expect(events[0].time_spent_sec).toBe(120);
      expect(events[0].scroll_depth_perc).toBe(75);
      expect(events[0].final_action).toBe('close');
    });

    it('должен сериализовать navigationPath в JSON', () => {
      repo.save(baseEvent);
      const events = repo.getLatest(1);
      const navPath = JSON.parse(events[0].navigation_path);
      expect(navPath).toEqual(baseEvent.navigationPath);
    });

    it('должен сериализовать sectionViewTimes в JSON', () => {
      repo.save(baseEvent);
      const events = repo.getLatest(1);
      const sectionTimes = JSON.parse(events[0].section_view_times);
      expect(sectionTimes).toEqual(baseEvent.sectionViewTimes);
    });

    it('должен сериализовать deviceInfo в JSON', () => {
      repo.save(baseEvent);
      const events = repo.getLatest(1);
      const deviceInfo = JSON.parse(events[0].device_info);
      expect(deviceInfo).toEqual(baseEvent.deviceInfo);
    });

    it('должен корректно сохранять пустые массивы и объекты', () => {
      const eventWithEmpty = {
        ...baseEvent,
        navigationPath: [],
        sectionViewTimes: {},
      };
      repo.save(eventWithEmpty);

      const events = repo.getLatest(1);
      expect(JSON.parse(events[0].navigation_path)).toEqual([]);
      expect(JSON.parse(events[0].section_view_times)).toEqual({});
    });

    it('должен проставлять received_at при сохранении', () => {
      repo.save(baseEvent);
      const events = repo.getLatest(1);
      expect(events[0].received_at).toBeTruthy();
    });
  });

  describe('count', () => {
    it('должен возвращать 0 для пустой таблицы', () => {
      expect(repo.count()).toBe(0);
    });

    it('должен возвращать количество сохранённых событий', () => {
      repo.save(baseEvent);
      repo.save({ ...baseEvent, userId: 'user2', pageName: 'community' });
      repo.save({ ...baseEvent, userId: 'user3', pageName: 'course-details' });

      expect(repo.count()).toBe(3);
    });
  });

  describe('getLatest', () => {
    it('должен возвращать последние события (по id DESC)', () => {
      // Сохраняем через прямой SQL с разными received_at для гарантии порядка
      const insertStmt = db.prepare(`
        INSERT INTO user_events (received_at, user_id, page_name, page_variant, time_spent_sec, scroll_depth_perc, final_action, navigation_path, section_view_times, device_info)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run('2025-01-01 10:00:00', 'user1', 'p1', 'v1', 10, 10, 'close', '[]', '{}', '{}');
      insertStmt.run('2025-01-01 10:00:01', 'user2', 'p2', 'v1', 10, 10, 'close', '[]', '{}', '{}');
      insertStmt.run('2025-01-01 10:00:02', 'user3', 'p3', 'v1', 10, 10, 'close', '[]', '{}', '{}');

      const events = repo.getLatest(2);
      expect(events).toHaveLength(2);
      expect(events[0].user_id).toBe('user3'); // самoe новое
      expect(events[1].user_id).toBe('user2');
    });

    it('должен возвращать все события, если лимит больше количества', () => {
      repo.save(baseEvent);
      repo.save({ ...baseEvent, userId: 'user2' });

      const events = repo.getLatest(100);
      expect(events).toHaveLength(2);
    });

    it('должен возвращать пустой массив, если событий нет', () => {
      const events = repo.getLatest(10);
      expect(events).toEqual([]);
    });

    it('должен использовать лимит по умолчанию 10', () => {
      for (let i = 0; i < 15; i++) {
        repo.save({ ...baseEvent, userId: `user${i}` });
      }

      const events = repo.getLatest();
      expect(events).toHaveLength(10);
    });
  });

  describe('getFilteredEvents', () => {
    beforeEach(() => {
      repo.save({ ...baseEvent, userId: 'user_a', pageName: 'course-landing' });
      repo.save({ ...baseEvent, userId: 'user_b', pageName: 'course-details' });
      repo.save({ ...baseEvent, userId: 'user_a', pageName: 'course-details' });
      repo.save({ ...baseEvent, userId: 'user_c', pageName: 'community' });
    });

    it('должен возвращать все события без фильтров', () => {
      const events = repo.getFilteredEvents({});
      expect(events).toHaveLength(4);
    });

    it('должен фильтровать по userId', () => {
      const events = repo.getFilteredEvents({ userId: 'user_a' });
      expect(events).toHaveLength(2);
      events.forEach(e => expect(e.user_id).toBe('user_a'));
    });

    it('должен фильтровать по pageName', () => {
      const events = repo.getFilteredEvents({ pageName: 'course-details' });
      expect(events).toHaveLength(2);
      events.forEach(e => expect(e.page_name).toBe('course-details'));
    });

    it('должен комбинировать фильтры userId + pageName', () => {
      const events = repo.getFilteredEvents({ userId: 'user_a', pageName: 'course-details' });
      expect(events).toHaveLength(1);
      expect(events[0].user_id).toBe('user_a');
      expect(events[0].page_name).toBe('course-details');
    });

    it('должен возвращать пустой массив, если ничего не найдено', () => {
      const events = repo.getFilteredEvents({ userId: 'nonexistent' });
      expect(events).toEqual([]);
    });

    it('должен применять лимит', () => {
      const events = repo.getFilteredEvents({ limit: 2 });
      expect(events).toHaveLength(2);
    });
  });
});
