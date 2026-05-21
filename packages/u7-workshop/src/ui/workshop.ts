/**
 * Модуль слайдера для Коворкинг-мастерской Дедок
 * Один слайдер, переключает изображения при смене таба
 */

class SimpleImageSlider {
  container: HTMLElement;
  _slides: HTMLImageElement[];
  _dots: HTMLElement[];
  _currentIndex: number = 0;
  _intervalId: ReturnType<typeof setInterval> | null = null;
  _isActive: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this._slides = Array.from(container.querySelectorAll('.full-screen-image'));
    this._dots = Array.from(container.querySelectorAll('.dot'));
    this._currentIndex = 0;
    this._intervalId = null;
    this._isActive = false;
  }

  _getDescriptionEl(): HTMLElement | null {
    return this.container.querySelector('.description');
  }

  _getDescriptionContainer(): HTMLElement | null {
    return this.container.querySelector('.description-container');
  }

  showSlide(index: number): void {
    if (this._slides.length === 0) return;

    this._slides.forEach((slide) => (slide.style.display = 'none'));
    this._dots.forEach((dot) => dot.classList.remove('active'));

    this._slides[index].style.display = 'block';
    if (this._dots[index]) {
      this._dots[index].classList.add('active');
    }

    const description = this._slides[index].dataset.description;
    const descEl = this._getDescriptionEl();
    if (descEl && description) {
      descEl.textContent = description;
    }

    this._showDescriptionTemp();
    this._currentIndex = index;
  }

  _showDescriptionTemp(): void {
    const descContainer = this._getDescriptionContainer();
    if (descContainer) {
      descContainer.style.opacity = '1';
      setTimeout(() => {
        if (descContainer) {
          descContainer.style.opacity = '0';
        }
      }, 2000);
    }
  }

  nextSlide(): void {
    if (this._slides.length <= 1) return;
    const nextIndex = (this._currentIndex + 1) % this._slides.length;
    this.showSlide(nextIndex);
  }

  startAutoSlide(): void {
    if (!this._isActive) return;
    this.stopAutoSlide();
    this._intervalId = setInterval(() => {
      this.nextSlide();
    }, 4000);
  }

  stopAutoSlide(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  restartAutoSlide(): void {
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  activate(): void {
    this._isActive = true;
    this.startAutoSlide();
  }

  deactivate(): void {
    this._isActive = false;
    this.stopAutoSlide();
  }

  updateSlides(newSlides: HTMLImageElement[]): void {
    // Скрываем все изображения в контейнере (в т.ч. с предыдущего таба)
    this.container.querySelectorAll<HTMLImageElement>('.full-screen-image').forEach(
      (img) => (img.style.display = 'none')
    );

    this._slides = newSlides;
    this._currentIndex = 0;

    if (this._slides.length > 0) {
      this.showSlide(0);
    }

    this._rebuildDots();
  }

  _rebuildDots(): void {
    const descContainer = this._getDescriptionContainer();
    if (!descContainer) return;

    const indicator = descContainer.querySelector('.indicator');
    if (!indicator) return;

    indicator.innerHTML = '';

    this._slides.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'dot' + (index === 0 ? ' active' : '');
      dot.dataset.index = String(index);
      dot.addEventListener('click', () => {
        this.showSlide(index);
        this.restartAutoSlide();
      });
      indicator.appendChild(dot);
    });

    this._dots = Array.from(indicator.querySelectorAll('.dot'));
  }

  getCurrentIndex(): number {
    return this._currentIndex;
  }

  setCurrentIndex(index: number): void {
    this._currentIndex = index;
    this.showSlide(index);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const slidesContainer = document.querySelector('.slides') as HTMLElement;
  if (!slidesContainer) {
    console.warn('Workshop: слайдер не найден');
    return;
  }

  const slider = new SimpleImageSlider(slidesContainer);

  // При смене таба показываем соответствующие изображения
  window.addEventListener('tab-changed', ((event: CustomEvent) => {
    const tabName = event.detail.tabName;
    const newSlides = Array.from(
      slidesContainer.querySelectorAll<HTMLImageElement>(`img[data-tab="${tabName}"]`)
    );
    slider.updateSlides(newSlides);
    slider.restartAutoSlide();
  }) as EventListener);

  // Определяем начальный таб из URL-хэша или по умолчанию 'home'
  const initialTab = window.location.hash.replace('#', '') || 'home';
  const initialSlides = Array.from(
    slidesContainer.querySelectorAll<HTMLImageElement>(`img[data-tab="${initialTab}"]`)
  );
  slider.updateSlides(initialSlides);
  slider.activate();
});
