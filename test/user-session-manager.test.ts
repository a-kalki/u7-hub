/**
 * Тесты для UserSessionManager
 *
 * Проверяет: генерацию userId, TTL сессии, сохранение/очистку истории чата,
 * управление активностью сессии.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';

// --- Мок localStorage ---
const localStorageMock: Record<string, string> = {};
const localStorage = {
  getItem: (key: string) => localStorageMock[key] ?? null,
  setItem: (key: string, value: string) => { localStorageMock[key] = value; },
  removeItem: (key: string) => { delete localStorageMock[key]; },
  clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); },
  get length() { return Object.keys(localStorageMock).length; },
  key: (index: number) => Object.keys(localStorageMock)[index] ?? null,
};

// Подменяем глобальный localStorage до импорта тестируемого модуля
(globalThis as any).localStorage = localStorage;

import UserSessionManager from '@app/ui/user-session-manager.js';

const USER_ID_KEY = 'chatUserId';
const LAST_ACTIVITY_KEY = 'lastChatActivity';

describe('UserSessionManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOrCreateUserId', () => {
    it('должен создавать новый userId, если его нет в localStorage', () => {
      const userId = UserSessionManager.getOrCreateUserId();

      expect(userId).toBeTruthy();
      expect(userId).toMatch(/^user_\d+_/); // формат user_<timestamp>_<random>
      expect(localStorage.getItem(USER_ID_KEY)).toBe(userId);
    });

    it('должен возвращать существующий userId, если он уже есть в localStorage', () => {
      const existingId = 'user_123_test';
      localStorage.setItem(USER_ID_KEY, existingId);

      const userId = UserSessionManager.getOrCreateUserId();

      expect(userId).toBe(existingId);
    });

    it('должен генерировать уникальные ID при каждом вызове', () => {
      const id1 = UserSessionManager.generateUserId();
      const id2 = UserSessionManager.generateUserId();

      expect(id1).not.toBe(id2);
    });

    it('должен создавать userId в формате user_<timestamp>_<random>', () => {
      const id = UserSessionManager.generateUserId();
      expect(id).toMatch(/^user_\d+_[a-z0-9]+$/);
    });
  });

  describe('updateLastActivity', () => {
    it('должен сохранять текущий timestamp в localStorage', () => {
      const before = Date.now();
      UserSessionManager.updateLastActivity();
      const after = Date.now();

      const saved = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY)!, 10);
      expect(saved).toBeGreaterThanOrEqual(before);
      expect(saved).toBeLessThanOrEqual(after);
    });
  });

  describe('getChatHistoryKey', () => {
    it('должен формировать ключ на основе userId', () => {
      const userId = UserSessionManager.getOrCreateUserId();
      const key = UserSessionManager.getChatHistoryKey();

      expect(key).toBe(`chatHistory_${userId}`);
    });

    it('должен создавать userId, если его нет', () => {
      expect(localStorage.getItem(USER_ID_KEY)).toBeNull();

      UserSessionManager.getChatHistoryKey();

      expect(localStorage.getItem(USER_ID_KEY)).toBeTruthy();
    });
  });

  describe('isSessionActive / getTimeUntilCleanup', () => {
    it('должен возвращать false, если активность никогда не обновлялась', () => {
      expect(UserSessionManager.isSessionActive()).toBe(false);
    });

    it('должен возвращать true, если активность была недавно', () => {
      UserSessionManager.updateLastActivity();
      expect(UserSessionManager.isSessionActive()).toBe(true);
    });

    it('должен возвращать false, если TTL истёк', () => {
      const oldTime = Date.now() - 31 * 60 * 1000; // 31 минута назад (TTL = 30 мин)
      localStorage.setItem(LAST_ACTIVITY_KEY, oldTime.toString());

      expect(UserSessionManager.isSessionActive()).toBe(false);
    });

    it('должен возвращать корректное время до очистки', () => {
      UserSessionManager.updateLastActivity();
      const timeLeft = UserSessionManager.getTimeUntilCleanup();

      expect(timeLeft).toBeGreaterThan(29 * 60 * 1000); // чуть меньше 30 мин
      expect(timeLeft).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it('должен возвращать TTL, если активность не установлена', () => {
      const timeLeft = UserSessionManager.getTimeUntilCleanup();
      expect(timeLeft).toBe(30 * 60 * 1000);
    });
  });

  describe('saveMessageToHistory', () => {
    it('должен сохранять сообщение в историю', () => {
      UserSessionManager.saveMessageToHistory('Привет!', 'user');

      const history = UserSessionManager.getValidHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Привет!');
      expect(history[0].timestamp).toBeDefined();
    });

    it('должен сохранять сообщения в хронологическом порядке', () => {
      UserSessionManager.saveMessageToHistory('Первое', 'user');
      UserSessionManager.saveMessageToHistory('Второе', 'assistant');

      const history = UserSessionManager.getValidHistory();
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Первое');
      expect(history[1].content).toBe('Второе');
    });

    it('должен ограничивать историю последними 20 сообщениями', () => {
      for (let i = 0; i < 25; i++) {
        UserSessionManager.saveMessageToHistory(`Сообщение ${i}`, i % 2 === 0 ? 'user' : 'assistant');
      }

      const history = UserSessionManager.getValidHistory();
      expect(history).toHaveLength(20);
      expect(history[0].content).toBe('Сообщение 5');
      expect(history[19].content).toBe('Сообщение 24');
    });

    it('должен обновлять время активности при сохранении', () => {
      const before = Date.now();
      UserSessionManager.saveMessageToHistory('тест', 'user');

      const savedActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY)!, 10);
      expect(savedActivity).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getValidHistory', () => {
    it('должен возвращать пустой массив, если истории нет', () => {
      const history = UserSessionManager.getValidHistory();
      expect(history).toEqual([]);
    });

    it('должен возвращать пустой массив, если TTL истёк (очищая историю)', () => {
      UserSessionManager.saveMessageToHistory('старое сообщение', 'user');

      // Ставим активность 31 минуту назад
      const oldTime = (Date.now() - 31 * 60 * 1000).toString();
      localStorage.setItem(LAST_ACTIVITY_KEY, oldTime);

      const history = UserSessionManager.getValidHistory();
      expect(history).toEqual([]);

      // Проверяем, что история действительно очищена
      const historyKey = UserSessionManager.getChatHistoryKey();
      expect(localStorage.getItem(historyKey)).toBeNull();
    });

    it('должен парсить сохранённый JSON', () => {
      const historyKey = `chatHistory_test-user`;
      localStorage.setItem('chatUserId', 'test-user');
      localStorage.setItem(historyKey, JSON.stringify([{ role: 'user', content: 'тест', timestamp: Date.now() }]));
      UserSessionManager.updateLastActivity();

      const history = UserSessionManager.getValidHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
    });

    it('должен возвращать пустой массив при повреждённом JSON', () => {
      const historyKey = `chatHistory_test-user`;
      localStorage.setItem('chatUserId', 'test-user');
      localStorage.setItem(historyKey, '{{{невалидный json');
      UserSessionManager.updateLastActivity();

      const history = UserSessionManager.getValidHistory();
      expect(history).toEqual([]);
    });
  });

  describe('cleanupExpiredHistory', () => {
    it('должен очищать историю, если TTL истёк', () => {
      UserSessionManager.saveMessageToHistory('сообщение', 'user');

      const oldTime = (Date.now() - 31 * 60 * 1000).toString();
      localStorage.setItem(LAST_ACTIVITY_KEY, oldTime);

      UserSessionManager.cleanupExpiredHistory();

      const historyKey = UserSessionManager.getChatHistoryKey();
      expect(localStorage.getItem(historyKey)).toBeNull();
      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
    });

    it('должен очищать историю, если LAST_ACTIVITY_KEY отсутствует', () => {
      UserSessionManager.saveMessageToHistory('сообщение', 'user');
      localStorage.removeItem(LAST_ACTIVITY_KEY);

      UserSessionManager.cleanupExpiredHistory();

      const historyKey = UserSessionManager.getChatHistoryKey();
      expect(localStorage.getItem(historyKey)).toBeNull();
    });

    it('не должен очищать историю, если TTL не истёк', () => {
      UserSessionManager.saveMessageToHistory('сообщение', 'user');
      UserSessionManager.updateLastActivity();

      UserSessionManager.cleanupExpiredHistory();

      const history = UserSessionManager.getValidHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('clearAllHistory', () => {
    it('должен очищать историю и активность, но сохранять userId', () => {
      const userId = UserSessionManager.getOrCreateUserId();
      UserSessionManager.saveMessageToHistory('сообщение', 'user');

      UserSessionManager.clearAllHistory();

      const historyKey = UserSessionManager.getChatHistoryKey();
      expect(localStorage.getItem(historyKey)).toBeNull();
      expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
      expect(localStorage.getItem(USER_ID_KEY)).toBe(userId); // userId сохраняется
    });
  });
});
