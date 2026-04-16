# Tech Stack - IT Hub Uralsk

## Core Runtime & Package Manager
*   **Bun:** Используется как среда выполнения, пакетный менеджер и основной инструмент сборки и тестирования.

## Project Structure & Modules
### 1. Course Module (`src/course`)
*   **Frontend:** HTML5, CSS3, TypeScript (сборка через Bun).
*   **Content:** Markdown файлы в `src/course/ui/content/`.
*   **AI Integration:** Интеграция с OpenAI, Gemini и DeepSeek (`src/course/api/ai`).
*   **Repositories:** Работа с данными форм и событий в SQLite.

### 2. Community Module (`src/community`)
*   **Frontend:** Статический HTML (`community.html`) с использованием W3.CSS.
*   **API:** Маршрутизация на бэкенде (`src/community/api/routes.ts`).

### 3. Analytics & UI Core (`src/app`, `src/ui`)
*   **Tracker:** TypeScript модуль для сбора метрик поведения.
*   **Server:** Bun.serve для обработки API запросов и раздачи статики.
*   **Database:** SQLite (через `bun:sqlite`).

## Frontend Deployment
*   **Static Assets:** Все веб-страницы собираются в статические файлы.
*   **Serving Strategy:** В режиме разработки используется `Bun.serve`. В production — высокопроизводительная раздача через **Nginx**.
*   **Styling:** Vanilla CSS, W3.CSS (для раздела сообщества).

## AI Integration
*   **Providers:** OpenAI, Gemini, DeepSeek через соответствующие SDK.
*   **System Prompts:** Хранятся в текстовых файлах (`ai-system-prompt.txt`) для гибкой настройки.

## Testing & Quality Assurance
*   **Bun Test:** Юнит и интеграционные тесты.
*   **Playwright:** E2E тестирование.
*   **Migrations:** Кастомная система управления схемой SQLite.
