// Модуль для сбора и отправки аналитики поведения пользователей
import UserSessionManager from '@app/ui/user-session-manager.js';

console.log("Трекер аналитики загружен.");

// --- Типы данных ---
interface NavigationEvent {
  fromTab: string;
  toTab: string;
  scroll_perc: number;
  timestamp: string;
  action?: string;
  fromPage?: string;
}

interface SectionViewTimes {
  [key: string]: number;
}

interface DeviceInfo {
  isMobile: boolean;
  userAgent: string;
  browser: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
}

interface AnalyticsState {
  userId: string | null;
  pageName: string;
  pageVariant: string;
  startTime: number | null;
  timeSpent_sec: number;
  scrollDepth_perc: number;
  finalAction: string;
  navigationPath: NavigationEvent[];
  sectionViewTimes: SectionViewTimes;
  deviceInfo: DeviceInfo;
}

interface TrackerData {
  userId: string | null;
  pageName: string;
  pageVariant: string;
  timeSpent_sec: number;
  scrollDepth_perc: number;
  finalAction: string;
  navigationPath: NavigationEvent[];
  sectionViewTimes: SectionViewTimes;
  deviceInfo: DeviceInfo;
}

// --- Хранилище данных и состояния ---
const analyticsState: AnalyticsState = {
  userId: null,
  pageName: 'unknown',
  pageVariant: 'unknown',
  startTime: null,
  timeSpent_sec: 0,
  scrollDepth_perc: 0,
  finalAction: 'close', // По умолчанию - закрытие
  navigationPath: [],
  sectionViewTimes: {},
  deviceInfo: {
    isMobile: false,
    userAgent: '',
    browser: 'unknown',
    platform: 'unknown',
    screenWidth: 0,
    screenHeight: 0
  }
};

// Вспомогательные переменные
const sectionEntryTimes: Map<string, number> = new Map();
let dataSent = false;

// --- Вспомогательные функции ---

/**
 * Определяет информацию об устройстве и браузере
 */
function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth <= 768;
  
  let browser = 'unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
  else if (ua.includes('Edg')) browser = 'edge';
  
  return {
    isMobile,
    userAgent: ua,
    browser,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
}

/**
 * Получает или генерирует уникальный ID пользователя
 */
function getOrSetUserId(): string {
  return UserSessionManager.getOrCreateUserId();
}

/**
 * Инициализирует отслеживание времени просмотра секций
 */
function initSectionViewTimeObserver(): void {
  console.log("Инициализация отслеживания времени на секциях.");

  const sections: NodeListOf<Element> = document.querySelectorAll('[data-track-view-time]');
  if (sections.length === 0) return;

  const observer: IntersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    const now: number = Date.now();
    entries.forEach((entry: IntersectionObserverEntry) => {
      const sectionName: string | undefined = (entry.target as HTMLElement).dataset.trackViewTime;
      if (sectionName) {
        if (entry.isIntersecting) {
          sectionEntryTimes.set(sectionName, now);
        } else {
          if (sectionEntryTimes.has(sectionName)) {
            const entryTime: number = sectionEntryTimes.get(sectionName)!;
            const duration: number = now - entryTime;

            const currentTotal: number = analyticsState.sectionViewTimes[sectionName] || 0;
            analyticsState.sectionViewTimes[sectionName] = currentTotal + duration;
            sectionEntryTimes.delete(sectionName);
          }
        }
      }
    });
  }, {
    root: null,
    threshold: 0.5,
  });

  sections.forEach((section: Element) => observer.observe(section));
}

/**
 * Инициализирует отслеживание переходов по вкладкам
 */
function initTabTracking(): void {
  console.log("Запущена логика отслеживания вкладок");
  
  // ХАРДКОД: определяем начальную вкладку по page-name
  let currentTab: string = 'unknown_tab';
  
  if (analyticsState.pageName === 'mission') {
    currentTab = 'mission';
  } else if (analyticsState.pageName === 'course-details') {
    currentTab = 'about-of-course';
  }
  
  console.log('Хардкод: начальная вкладка установлена как:', currentTab);

  // Отслеживаем клики по вкладкам
  document.body.addEventListener('click', (event: MouseEvent) => {
    const tabButton: HTMLElement | null = (event.target as HTMLElement).closest('.tablink[data-tabname]');
    if (!tabButton) return;

    const toTab: string | null = tabButton.getAttribute('data-tabname');
    if (!toTab || toTab === currentTab) return;

    const eventData: NavigationEvent = {
      fromTab: currentTab,
      toTab: toTab,
      scroll_perc: Math.round(analyticsState.scrollDepth_perc),
      timestamp: new Date().toISOString(),
    };

    analyticsState.navigationPath.push(eventData);
    console.log('Переход по вкладке:', eventData);
    currentTab = toTab;
  });
}

/**
 * Обрабатывает клики по ссылкам с аналитикой - ОСНОВНАЯ ЛОГИКА!
 */
function initLinkTracking(): void {
  // Отслеживание всех кликов по ссылкам с data-analytics-action
  document.body.addEventListener('click', (event: MouseEvent) => {
    const targetElement: HTMLElement | null = (event.target as HTMLElement).closest('[data-analytics-action]');
    
    if (targetElement && targetElement.tagName === 'A') {
      const action = targetElement.getAttribute('data-analytics-action') || 'unknown_link';
      
      // НЕМЕДЛЕННО обновляем finalAction для этого перехода
      analyticsState.finalAction = action;
      console.log(`Зафиксирован переход по ссылке: ${action}`);
      
      // Сразу отправляем данные перед переходом
      setTimeout(() => sendAnalyticsData(), 10);
    }
  });
}

/**
 * Проверяет, есть ли на странице вкладки для отслеживания
 */
function hasTabsToTrack(): boolean {
  return document.querySelectorAll('[data-tabname], [data-tab]').length > 0;
}

/**
 * Запускает сбор всех основных метрик
 */
function startMetricsCollection(): void {
  console.log("Начало сбора метрик: время, скролл, клики...");

  analyticsState.startTime = Date.now();

  // Отслеживание скролла
  window.addEventListener('scroll', () => {
    const scrollTop: number = window.scrollY;
    const docHeight: number = document.documentElement.scrollHeight;
    const winHeight: number = document.documentElement.clientHeight;

    if (docHeight === winHeight) {
      analyticsState.scrollDepth_perc = 100;
      return;
    }

    const scrollPercent: number = (scrollTop / (docHeight - winHeight)) * 100;
    analyticsState.scrollDepth_perc = Math.max(analyticsState.scrollDepth_perc || 0, scrollPercent);
  }, { passive: true });

  // Отслеживание вкладок для ВСЕХ страниц с табами
  if (hasTabsToTrack()) {
    initTabTracking();
  }

  // Отслеживание ссылок - ОСНОВНАЯ ЛОГИКА!
  initLinkTracking();

  // Гарантированная отправка при уходе со страницы
  setupUnloadHandlers();
}

/**
 * Настраивает обработчики для гарантированной отправки данных при уходе
 */
function setupUnloadHandlers(): void {
  const sendBeforeUnload = () => {
    if (dataSent) return;
    
    const now: number = Date.now();
    
    // Финализируем время просмотра секций
    sectionEntryTimes.forEach((entryTime: number, sectionName: string) => {
      const duration: number = now - entryTime;
      const currentTotal: number = analyticsState.sectionViewTimes[sectionName] || 0;
      analyticsState.sectionViewTimes[sectionName] = currentTotal + duration;
    });

    // Конвертируем время в секунды
    for (const sectionName in analyticsState.sectionViewTimes) {
      analyticsState.sectionViewTimes[sectionName] = parseFloat((analyticsState.sectionViewTimes[sectionName] / 1000).toFixed(1));
    }

    // Вычисляем общее время
    analyticsState.timeSpent_sec = Math.round((now - (analyticsState.startTime || now)) / 1000);
    analyticsState.scrollDepth_perc = Math.round(analyticsState.scrollDepth_perc);

    // Если finalAction не был установлен ссылкой, оставляем 'close'
    if (analyticsState.finalAction === 'close' && hasTabsToTrack()) {
      // ХАРДКОД: используем последнюю вкладку из navigationPath
      const lastNavigation = analyticsState.navigationPath[analyticsState.navigationPath.length - 1];
      if (lastNavigation) {
        analyticsState.finalAction = `close_on_tab_${lastNavigation.toTab}`;
      }
    }

    sendAnalyticsData();
  };

  // Обработчики для ухода со страницы
  window.addEventListener('beforeunload', sendBeforeUnload);
  window.addEventListener('pagehide', sendBeforeUnload);
}

/**
 * Отправляет собранные данные на сервер
 */
function sendAnalyticsData(): void {
  if (dataSent) {
    console.log('Данные уже отправлены, пропускаем');
    return;
  }

  const MIN_TIME_SPENT_SEC = 3;
  if (analyticsState.timeSpent_sec < MIN_TIME_SPENT_SEC) {
    console.log(`Сессия слишком короткая (${analyticsState.timeSpent_sec} сек). Данные не отправлены.`);
    return;
  }

  const data: TrackerData = {
    userId: analyticsState.userId,
    pageName: analyticsState.pageName,
    pageVariant: analyticsState.pageVariant,
    timeSpent_sec: analyticsState.timeSpent_sec,
    scrollDepth_perc: analyticsState.scrollDepth_perc,
    finalAction: analyticsState.finalAction,
    navigationPath: analyticsState.navigationPath,
    sectionViewTimes: analyticsState.sectionViewTimes,
    deviceInfo: analyticsState.deviceInfo
  };

  const webhookUrl: string = '/api/track';

  try {
    // Используем sendBeacon для гарантированной отправки при уходе
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      if (navigator.sendBeacon(webhookUrl, blob)) {
        console.log("Данные отправлены через sendBeacon:", data);
        dataSent = true;
      } else {
        // Fallback к fetch с keepalive
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true,
        });
        console.log("Данные отправлены через fetch (keepalive):", data);
        dataSent = true;
      }
    } else {
      // Fallback для старых браузеров
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      console.log("Данные отправлены через fetch:", data);
      dataSent = true;
    }
  } catch (error: any) {
    console.error("Ошибка при отправке данных:", error);
  }
}

/**
 * Главная функция инициализации трекера
 */
function initTracker(): void {
  const pageNameTag: HTMLMetaElement | null = document.querySelector('meta[name="page-name"]');
  const pageVariantTag: HTMLMetaElement | null = document.querySelector('meta[name="page-variant"]');

  analyticsState.pageName = pageNameTag ? pageNameTag.content : 'unknown';
  analyticsState.pageVariant = pageVariantTag ? pageVariantTag.content : 'unknown';
  analyticsState.deviceInfo = getDeviceInfo();
  analyticsState.userId = getOrSetUserId();

  console.log(`Трекер запущен на странице: ${analyticsState.pageName} (вариант: ${analyticsState.pageVariant})`);
  console.log('Информация об устройстве:', analyticsState.deviceInfo);

  startMetricsCollection();
  initSectionViewTimeObserver();
}

// Запускаем трекер после полной загрузки страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTracker);
} else {
  initTracker();
}
