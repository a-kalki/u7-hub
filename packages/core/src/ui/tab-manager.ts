const tabScrollPositions: Record<string, number> = {};

let currentTabId: string = 'unknown_tab';

function openTab(tabName: string, updateHistory: boolean = true) {
  // Проверяем существование вкладки
  if (!isValidTab(tabName)) {
    console.warn(`Вкладка "${tabName}" не найдена`);
    return;
  }

  // 1. Сохраняем текущую позицию прокрутки
  const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  tabScrollPositions[currentTabId] = currentScrollPosition;

  // 2. Скрываем весь контент вкладок
  const tabcontents = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontents.length; i++) {
    (tabcontents[i] as HTMLElement).style.display = "none";
  }

  // 3. Снимаем активный класс со всех кнопок
  const allTablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < allTablinks.length; i++) {
    allTablinks[i].classList.remove("w3-white");
  }

  // 4. Показываем новый контент и активируем кнопки
  const newTabContent = document.getElementById(tabName);
  const newTabButtons = document.querySelectorAll(`.tablink[data-tabname='${tabName}']`);

  if (newTabContent) {
    newTabContent.style.display = "block";
  }
  newTabButtons.forEach(button => button.classList.add("w3-white"));

  // 5. Восстанавливаем позицию прокрутки
  const newScrollPosition = tabScrollPositions[tabName] || 0;
  window.scrollTo({
    top: newScrollPosition,
    behavior: 'auto'
  });

  // 6. Обновляем ID текущей вкладки
  currentTabId = tabName;

  // 7. Диспатчим событие для кастомных обработчиков (слайдеры, аналитика)
  window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tabName } }));

  // 8. Обновляем URL (если не блокировано)
  if (updateHistory) {
    updateURLWithTab(tabName);
  }
}

function showToolbarScroll() {
  // Находим ВСЕ контейнеры с вкладками на странице
  const tabsContainers = document.querySelectorAll('.scrollable-tabs');

  tabsContainers.forEach((tabsContainer) => {
    function checkOverflow() {
      const containerWidth = tabsContainer.clientWidth;
      const contentWidth = tabsContainer.scrollWidth;
      const isOverflowing = contentWidth > containerWidth + 1;
      
      if (isOverflowing) {
        tabsContainer.classList.add('show-scrollbar');
      } else {
        tabsContainer.classList.remove('show-scrollbar');
      }
    }

    // Проверяем при загрузке страницы
    setTimeout(checkOverflow, 50);
    setTimeout(checkOverflow, 200);

    // Проверяем при изменении размера окна
    window.addEventListener('resize', checkOverflow);
  });
}

/**
 * Обрабатывает изменения URL (навигация по истории)
 */
function handleURLChange(): void {
  const tabFromURL = getTabFromURL();
  
  if (tabFromURL && tabFromURL !== currentTabId && isValidTab(tabFromURL)) {
    // Открываем вкладку из URL без обновления истории (чтобы избежать цикла)
    openTab(tabFromURL, false);
  }
}

/**
 * Обновляет URL с хэшем вкладки
 */
function updateURLWithTab(tabName: string): void {
  const newUrl = `${window.location.pathname}#${tabName}`;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Получает имя вкладки из URL хэша
 */
function getTabFromURL(): string | null {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#')) {
    return hash.substring(1); // Убираем # из начала
  }
  return null;
}

/**
 * Проверяет существование вкладки с указанным именем
 */
function isValidTab(tabName: string): boolean {
  return document.getElementById(tabName) !== null;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Определяем начальную вкладку по приоритету:
  // 1. Из URL
  // 2. Из открытой вкладки на странице
  // 3. По умолчанию "mission"
  
  const urlTab = getTabFromURL();
  const visibleTab = document.querySelector('.tabcontent[style*="display:block"]') as HTMLElement;
  
  if (urlTab && isValidTab(urlTab)) {
    // Вкладка из URL имеет высший приоритет
    currentTabId = urlTab;
    openTab(urlTab, false); // false - чтобы не обновлять URL повторно
  } else if (visibleTab) {
    // Используем вкладку, которая уже открыта на странице
    currentTabId = visibleTab.id;
  } else {
    // fallback - первая вкладка
    const pageNameTag: HTMLMetaElement | null = document.querySelector('meta[name="page-name"]');
    if (pageNameTag?.content === 'mission') {
      currentTabId = 'mission';
    } else if (pageNameTag?.content === 'course-details') {
      currentTabId = 'about-of-course';
    }
  }

  // Обработчик кликов по вкладкам для ВСЕХ контейнеров
  const tabContainers = document.querySelectorAll('.tabs');
  tabContainers.forEach(container => {
    container.addEventListener('click', (event: Event) => {
      const tabButton = (event.target as Element).closest('.tablink[data-tabname]');
      if (tabButton) {
        const tabName = tabButton.getAttribute('data-tabname');
        if (tabName) {
          openTab(tabName); // updateHistory = true по умолчанию
        }
      }
    });
  });

  // Слушаем изменения URL (навигация назад/вперед)
  window.addEventListener('hashchange', handleURLChange);

  // Показываем скроллбар для ВСЕХ вкладок на странице
  showToolbarScroll();

  // Плавный скролл для кнопки "Наверх"
  const toTopBtn = document.querySelector('.footer-button[href="#top"]');
  if (toTopBtn) {
    toTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Инициализация фильтров (например, для отзывов)
  initFilters();
});

/**
 * Универсальная фильтрация элементов внутри контейнера
 */
function initFilters() {
  document.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('.filter-btn');
    if (!btn) return;

    const filter = btn.getAttribute('data-filter');
    if (!filter) return;

    // Находим ближайший контейнер (обычно это вкладка tabcontent)
    const container = btn.closest('.tabcontent') || document.body;
    const items = container.querySelectorAll('[data-review-type]'); // Фильтруем по наличию атрибута типа
    const buttons = container.querySelectorAll('.filter-btn');

    // 1. Обновляем визуальное состояние кнопок (W3.CSS стили)
    buttons.forEach(b => {
      b.classList.remove('w3-black');
      b.classList.add('w3-light-grey');
    });
    btn.classList.add('w3-black');
    btn.classList.remove('w3-light-grey');

    // 2. Скрываем/показываем элементы
    items.forEach(item => {
      const type = item.getAttribute('data-review-type');
      if (filter === 'all' || type === filter) {
        (item as HTMLElement).style.display = 'block';
      } else {
        (item as HTMLElement).style.display = 'none';
      }
    });
  });
}
