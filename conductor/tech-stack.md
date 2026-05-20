# Tech Stack - IT Hub Uralsk

## Core Runtime & Package Manager
*   **Bun:** Используется как среда выполнения, пакетный менеджер и основной инструмент сборки и тестирования.
*   **Monorepo:** Проект организован как монорепозиторий через **Bun Workspaces** (`"workspaces": ["packages/*"]`).

## Project Structure & Modules
Проект организован как монорепозиторий с разделением на три пакета:

### 1. Course Module (`packages/nur-course`)
*   **Frontend:** HTML5, CSS3, TypeScript (сборка через Bun).
*   **Content:** Markdown файлы в `packages/nur-course/src/ui/content/`.
*   **AI Integration:** Интеграция с OpenAI, Gemini и DeepSeek (`packages/nur-course/src/api/ai`).
*   **Repositories:** Работа с данными форм и событий в SQLite.
*   **Dependencies:** libphonenumber-js, openai.

### 2. Community Module (`packages/community`)
*   **Frontend:** Статический HTML (`community.html`) с использованием W3.CSS.
*   **API:** Маршрутизация на бэкенде (`packages/community/src/api/routes.ts`).
*   **Content:** Markdown файлы в `packages/community/src/ui/content/`.

### 3. Core Module (`packages/core`)
*   **Tracker:** TypeScript модуль для сбора метрик поведения.
*   **Server:** Bun.serve для обработки API запросов и раздачи статики.
*   **Database:** SQLite (через `bun:sqlite`).
*   **Database Utilities:** Миграции, бэкапы и просмотр событий в `packages/core/src/db-utils/`.

## Frontend Deployment
*   **Static Assets:** Все веб-страницы собираются в статические файлы.
*   **Serving Strategy:** В режиме разработки используется `Bun.serve`. В production — высокопроизводительная раздача через **Nginx**.
*   **Styling:** Vanilla CSS, W3.CSS (для раздела сообщества).

## AI Integration
*   **Providers:** OpenAI, Gemini, DeepSeek через соответствующие SDK.
*   **System Prompts:** Хранятся в текстовых файлах (`ai-system-prompt.txt`) для гибкой настройки.

## Testing & Quality Assurance
*   **Bun Test:** Юнит и интеграционные тесты (per-package, добавляются отдельно).
*   **playwright:** Playwright для E2E тестирования (в корневых devDependencies).
*   **Migrations:** Кастомная система управления схемой SQLite (`packages/core/src/migrations/`).
