import { promises as fs } from 'fs';
import { resolve } from 'path';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export interface UserChatSession {
  userId: string;
  messages: ChatMessage[];
  lastActivity: number;
}

// Маппинг тем → файлы контента
const CONTENT_FILES = {
  // Курсы
  course: {
    basePath: 'packages/nur-course/src/ui/content',
    files: {
      landing: 'landing.md',
      aboutCourse: 'about-of-course.md',
      aboutMe: 'about-of-me.md',
      mission: 'mission.md',
      program: 'program.md',
      reviews: 'reviews.md',
      contacts: 'contacts.md',
    },
  },
  // Сообщество
  community: {
    basePath: 'packages/community/src/ui/content',
    files: {
      mission: 'mission.md',
      program: 'program.md',
      communities: 'communities.md',
      courses: 'courses.md',
      gov: 'gov.md',
    },
  },
};

type ContentCategory = keyof typeof CONTENT_FILES;
type CourseFile = keyof typeof CONTENT_FILES.course.files;
type CommunityFile = keyof typeof CONTENT_FILES.community.files;

// Ключевые слова для определения темы вопроса
const TOPIC_KEYWORDS: Record<string, { category: ContentCategory; file: string }[]> = {
  program: [
    { category: 'course', file: 'program' },
    { category: 'course', file: 'aboutCourse' },
    { category: 'community', file: 'program' },
  ],
  aboutMe: [
    { category: 'course', file: 'aboutMe' },
  ],
  aboutCourse: [
    { category: 'course', file: 'aboutCourse' },
  ],
  mission: [
    { category: 'course', file: 'mission' },
    { category: 'community', file: 'mission' },
  ],
  reviews: [
    { category: 'course', file: 'reviews' },
  ],
  contacts: [
    { category: 'course', file: 'contacts' },
  ],
  community: [
    { category: 'community', file: 'communities' },
    { category: 'community', file: 'mission' },
    { category: 'community', file: 'program' },
    { category: 'community', file: 'courses' },
  ],
  gov: [
    { category: 'community', file: 'gov' },
  ],
};

const KEYWORD_MAP: Record<string, keyof typeof TOPIC_KEYWORDS> = {
  // Программа и обучение
  программа: 'program',
  модул: 'program',
  этап: 'program',
  урок: 'program',
  обучение: 'program',
  учить: 'program',
  'js': 'program',
  typescript: 'program',
  python: 'program',
  roadmap: 'program',
  'дорожная карта': 'program',

  // О Нурболате
  нурболат: 'aboutMe',
  'о тебе': 'aboutMe',
  'ты кто': 'aboutMe',
  опыт: 'aboutMe',
  преподавател: 'aboutMe',
  ментор: 'aboutMe',
  биография: 'aboutMe',

  // О курсах — организация, сроки, формат
  курс: 'aboutCourse',
  организация: 'aboutCourse',
  'как проходит': 'aboutCourse',
  формат: 'aboutCourse',
  офлайн: 'aboutCourse',
  онлайн: 'aboutCourse',
  интенсив: 'aboutCourse',
  направление: 'aboutCourse',
  срок: 'aboutCourse',
  длительность: 'aboutCourse',
  'сколько времени': 'aboutCourse',
  'сколько месяцев': 'aboutCourse',
  период: 'aboutCourse',
  расписани: 'aboutCourse',
  график: 'aboutCourse',
  заняти: 'aboutCourse',
  'раз в неделю': 'aboutCourse',
  '2 раза': 'aboutCourse',
  часов: 'aboutCourse',
  'в неделю': 'aboutCourse',
  'в месяц': 'aboutCourse',
  начало: 'aboutCourse',
  старт: 'aboutCourse',
  запуск: 'aboutCourse',
  поток: 'aboutCourse',

  // Миссия
  миссия: 'mission',
  цель: 'mission',
  'для чего': 'mission',
  обязательств: 'mission',

  // Отзывы
  отзыв: 'reviews',
  результат: 'reviews',
  студент: 'reviews',
  команда: 'reviews',

  // Контакты
  контакт: 'contacts',
  записат: 'contacts',
  анкет: 'contacts',
  связь: 'contacts',
  телефон: 'contacts',
  telegram: 'contacts',

  // Сообщество
  сообществ: 'community',
  коворкинг: 'community',
  'it сообщество': 'community',
  участие: 'community',
  роль: 'community',
  мастерск: 'community',
  стартап: 'community',
  серверн: 'community',
  правила: 'community',

  // Государство
  государств: 'gov',
  гипотез: 'gov',
  эффективность: 'gov',
  госпрограм: 'gov',
};

export abstract class AIService {
  protected systemPrompt = '';
  private contentCache: Map<string, string> = new Map();
  private sessions: Map<string, UserChatSession>;
  private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 час
  private readonly MAX_HISTORY_LENGTH = 20;

  constructor() {
    this.sessions = new Map();
    this.initialize();
    this.startSessionCleanup();
  }

  private async initialize() {
    const systemPromptPath = resolve(process.cwd(), 'packages/nur-course/src/api/ai', 'ai-system-prompt.txt');

    try {
      const systemPromptContent = await fs.readFile(systemPromptPath, 'utf-8');
      this.systemPrompt = systemPromptContent;
      console.log('AI CORE: Системный промпт успешно загружен.');
    } catch (error) {
      console.error('AI CORE: Ошибка загрузки системного промпта:', error);
      this.systemPrompt = 'Ты — ИИ-помощник на сайте курсов программирования. Отвечай кратко и по делу.';
    }
  }

  /**
   * Прочитать содержимое markdown-файла по указанному пути.
   * Использует кэш: файл загружается один раз и сохраняется в памяти.
   */
  async readContentFile(category: ContentCategory, fileKey: CourseFile | CommunityFile): Promise<string> {
    const cacheKey = `${category}/${fileKey}`;

    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    const config = CONTENT_FILES[category];
    if (!config) {
      console.warn(`AI CONTENT: Неизвестная категория "${category}"`);
      return '';
    }

    const fileName = (config.files as Record<string, string>)[fileKey];
    if (!fileName) {
      console.warn(`AI CONTENT: Неизвестный файл "${fileKey}" в категории "${category}"`);
      return '';
    }

    const filePath = resolve(process.cwd(), config.basePath, fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.contentCache.set(cacheKey, content);
      console.log(`AI CONTENT: Загружен файл ${config.basePath}/${fileName}`);
      return content;
    } catch (error) {
      console.error(`AI CONTENT: Ошибка загрузки ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Определить, какие файлы контента нужны для ответа на вопрос пользователя.
   * Анализирует сообщение по ключевым словам и возвращает список файлов для загрузки.
   */
  private detectTopic(userMessage: string): { category: ContentCategory; file: string }[] {
    const lowerMessage = userMessage.toLowerCase();
    const selectedTopics = new Set<string>();
    const result: { category: ContentCategory; file: string }[] = [];

    // Проверяем ключевые слова
    for (const [keyword, topic] of Object.entries(KEYWORD_MAP)) {
      if (lowerMessage.includes(keyword)) {
        selectedTopics.add(topic);
      }
    }

    // Добавляем landing.md курсов как базовый контекст для любого вопроса
    result.push({ category: 'course', file: 'landing' });

    // Добавляем файлы по определённым темам
    for (const topic of Array.from(selectedTopics)) {
      const files = TOPIC_KEYWORDS[topic];
      if (files) {
        for (const file of files) {
          // Не дублируем
          if (!result.some(r => r.category === file.category && r.file === file.file)) {
            result.push(file);
          }
        }
      }
    }

    return result;
  }

  /**
   * Собрать полный промпт: system prompt + контент по теме вопроса
   */
  private async buildPrompt(userMessage: string): Promise<string> {
    const relevantFiles = this.detectTopic(userMessage);
    const contents: string[] = [];

    for (const file of relevantFiles) {
      const content = await this.readContentFile(file.category, file.file as CourseFile | CommunityFile);
      if (content) {
        // Извлекаем только содержимое markdown (без служебных тегов)
        const cleanContent = this.cleanContent(content);
        if (cleanContent) {
          contents.push(`--- ${file.category}/${file.file} ---\n${cleanContent}`);
        }
      }
    }

    if (contents.length > 0) {
      return `${this.systemPrompt}\n\n## Дополнительный контекст из файлов проекта:\n${contents.join('\n\n')}`;
    }

    return this.systemPrompt;
  }

  /**
   * Очистить markdown от HTML-разметки и служебных тегов,
   * оставляя только читаемый текст
   */
  private cleanContent(content: string): string {
    return content
      // Удаляем HTML-комментарии
      .replace(/<!--[\s\S]*?-->/g, '')
      // Удаляем атрибуты data-track-view-time
      .replace(/\s*data-track-view-time="[^"]*"/g, '')
      // Удаляем атрибуты class, style, data-* (кроме ссылок)
      .replace(/\s*(class|style|data-analytics-action|target|rel)="[^"]*"/g, '')
      // Удаляем пустые ссылки
      .replace(/\[([^\]]*)\]\(\)/g, '$1')
      // Удаляем конструкции {target="_blank"}
      .replace(/\{target="_blank"\}/g, '')
      // Удаляем множественные пустые строки
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Управление сессиями
  private getOrCreateSession(userId: string): UserChatSession {
    let session = this.sessions.get(userId);

    if (!session) {
      session = {
        userId,
        messages: [],
        lastActivity: Date.now(),
      };
      this.sessions.set(userId, session);
      console.log(`AI: Создана новая сессия для пользователя ${userId}`);
    } else {
      session.lastActivity = Date.now();
    }

    return session;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`AI: Очищено ${cleanedCount} неактивных сессий`);
    }
  }

  private startSessionCleanup(): void {
    setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000);
  }

  // Основной метод для обработки сообщений
  async *processMessage(userId: string, userMessage: string): AsyncGenerator<string> {
    console.log(`AI: Сообщение от ${userId}: "${userMessage.slice(0, 100)}..."`);
    const session = this.getOrCreateSession(userId);

    // Добавляем сообщение пользователя в историю
    session.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Ограничиваем историю
    if (session.messages.length > this.MAX_HISTORY_LENGTH) {
      session.messages = session.messages.slice(-this.MAX_HISTORY_LENGTH);
    }

    // Генерируем ответ
    let fullResponse = '';

    try {
      // Строим промпт с динамическим контекстом
      const prompt = await this.buildPrompt(userMessage);

      for await (const chunk of this.generateResponse(userMessage, session.messages, prompt)) {
        yield chunk;
        fullResponse += chunk;
      }

      // Добавляем ответ ассистента в историю
      session.messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('AI: Ошибка генерации ответа:', error);
      const errorMessage = 'Извините, произошла ошибка. Попробуйте позже.';
      yield errorMessage;

      session.messages.push({
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
      });
    }
  }

  // Внутренний метод для генерации ответа (переопределяется наследниками)
  protected abstract generateResponse(
    userMessage: string,
    history: ChatMessage[],
    prompt: string,
  ): AsyncGenerator<string>;

  // Метод для сброса истории
  resetSession(userId: string): boolean {
    return this.sessions.delete(userId);
  }

  // Метод для получения статистики
  getSessionStats() {
    return {
      activeSessions: this.sessions.size,
      totalMessages: Array.from(this.sessions.values()).reduce(
        (sum, session) => sum + session.messages.length,
        0,
      ),
    };
  }
}
