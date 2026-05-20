class SimpleImageSlider {
  constructor(container) {
    this.container = container;
    this.slides = Array.from(container.querySelectorAll('.full-screen-image'));
    this.dots = Array.from(container.querySelectorAll('.dot'));
    this.description = container.querySelector('.description');
    this.descriptionContainer = container.querySelector('.description-container');
    this.currentIndex = 0;
    this.intervalId = null;
    this.isActive = false;
    
    this.init();
  }

  init() {
    if (this.slides.length <= 1) return;
    
    // Определяем начальный активный слайд
    this.currentIndex = this.slides.findIndex(slide => 
      slide.style.display === 'block' || getComputedStyle(slide).display === 'block'
    );
    if (this.currentIndex === -1) this.currentIndex = 0;
    
    // Показываем начальный слайд
    this.showSlide(this.currentIndex);
    
    // Обработчики для точек
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.showSlide(index);
        this.restartAutoSlide();
      });
    });
  }

  showSlide(index) {
    // Скрываем все слайды
    this.slides.forEach(slide => slide.style.display = 'none');
    this.dots.forEach(dot => dot.classList.remove('active'));
    
    // Показываем выбранный слайд
    this.slides[index].style.display = 'block';
    this.dots[index].classList.add('active');
    
    // Обновляем описание из data-атрибута
    const description = this.slides[index].dataset.description;
    if (this.description && description) {
      this.description.textContent = description;
    }
    
    // Показываем описание на 2 секунды
    this.showDescription();
    
    this.currentIndex = index;
  }

  showDescription() {
    this.descriptionContainer.style.opacity = '1';
    setTimeout(() => {
      if (this.descriptionContainer) {
        this.descriptionContainer.style.opacity = '0';
      }
    }, 2000);
  }

  nextSlide() {
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.showSlide(nextIndex);
  }

  startAutoSlide() {
    if (!this.isActive) return;
    
    this.stopAutoSlide();
    this.intervalId = setInterval(() => {
      this.nextSlide();
    }, 4000);
  }

  stopAutoSlide() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restartAutoSlide() {
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  activate() {
    this.isActive = true;
    this.startAutoSlide();
  }

  deactivate() {
    this.isActive = false;
    this.stopAutoSlide();
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  setCurrentIndex(index) {
    this.currentIndex = index;
    this.showSlide(index);
  }
}

// Менеджер для управления слайдерами в пределах вкладки
class TabSlidersManager {
  constructor(tabName) {
    this.tabName = tabName;
    this.sliders = [];
    this.currentIndex = 0;
    this.isActive = false;
  }

  addSlider(slider) {
    this.sliders.push(slider);
    
    // Синхронизируем клики по точкам
    const dots = slider.container.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.setCurrentIndex(index);
      });
    });
  }

  setCurrentIndex(index) {
    this.currentIndex = index;
    this.sliders.forEach(slider => {
      slider.setCurrentIndex(index);
    });
  }

  activate() {
    this.isActive = true;
    this.sliders.forEach(slider => {
      slider.activate();
      slider.setCurrentIndex(this.currentIndex);
    });
  }

  deactivate() {
    this.isActive = false;
    this.sliders.forEach(slider => {
      slider.deactivate();
    });
  }

  getCurrentIndex() {
    return this.currentIndex;
  }
}

// Главный менеджер вкладок
class TabManager {
  constructor() {
    this.currentTab = 'home';
    this.scrollPositions = new Map();
    this.tabManagers = new Map();
    this.init();
  }

  init() {
    this.initializeSliders();
    
    // Обработчики для кнопок вкладок
    document.querySelectorAll('.tab-buttons .btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName, window.scrollY, window.scrollX);
      });
    });

    // Кнопка "наверх"
    document.querySelector('.to-top-btn').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Активируем начальную вкладку
    this.activateTab('home');
  }

  initializeSliders() {
    const allSliders = document.querySelectorAll('.slides');
    
    allSliders.forEach((slidesContainer) => {
      const tabContent = slidesContainer.closest('.tab-content');
      if (!tabContent) return;
      
      const tabName = tabContent.id.replace('-tab', '');
      
      // Создаем менеджер для вкладки если его нет
      if (!this.tabManagers.has(tabName)) {
        this.tabManagers.set(tabName, new TabSlidersManager(tabName));
      }
      
      const slider = new SimpleImageSlider(slidesContainer);
      this.tabManagers.get(tabName).addSlider(slider);
    });
  }

  switchTab(tabName, scrollTop = 0, scrollLeft = 0) {
    // Сохраняем текущую позицию прокрутки
    this.scrollPositions.set(this.currentTab, {
      top: scrollTop,
      left: scrollLeft
    });

    // Деактивируем текущую вкладку
    this.deactivateTab(this.currentTab);

    // Активируем новую вкладку
    this.activateTab(tabName);

    // Восстанавливаем позицию прокрутки
    const savedPosition = this.scrollPositions.get(tabName) || { top: 0, left: 0 };
    setTimeout(() => {
      window.scrollTo(savedPosition.left, savedPosition.top);
    }, 10);
  }

  activateTab(tabName) {
    // Обновляем активные кнопки
    document.querySelectorAll('.tab-buttons .btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Обновляем активный контент
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // Активируем слайдеры вкладки
    const tabManager = this.tabManagers.get(tabName);
    if (tabManager) {
      tabManager.activate();
    }

    this.currentTab = tabName;
  }

  deactivateTab(tabName) {
    const tabManager = this.tabManagers.get(tabName);
    if (tabManager) {
      tabManager.deactivate();
    }
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  new TabManager();
});
