# Монорепозиторий: рефакторинг структуры проекта

## Обзор
Рефакторинг текущей монолитной структуры `src/` в монорепозиторий с использованием Bun Workspaces.
Цель — разделить кодовую базу на три независимых пакета для улучшения модульности, переиспользования и управления зависимостями.

## Целевая структура

```
/
├── package.json              # Корневой workspace (Bun workspaces)
├── tsconfig.json             # Общий конфиг TypeScript (paths обновлены)
├── build.ts                  # Сборщик остаётся в корне
├── ecosystem.config.cjs      # Конфиг PM2 (обновить пути)
├── packages/
│   ├── core/                 # ← src/app
│   │   ├── package.json      # name: @u7-hub/core
│   │   ├── tsconfig.json     # extends корневой
│   │   └── src/
│   │       ├── index.ts      # точка входа: сервер, БД, трекер
│   │       ├── server.ts
│   │       ├── db.ts
│   │       ├── ui/
│   │       ├── db-utils/
│   │       └── migrations/
│   ├── community/            # ← src/community
│   │   ├── package.json      # name: @u7-hub/community
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── api/
│   │       └── ui/
│   └── nur-course/           # ← src/course
│       ├── package.json      # name: @u7-hub/nur-course
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── api/
│           ├── domain/
│           └── ui/
└── conductor/                # Без изменений
```

## Функциональные требования

### FR1: Создание структуры монорепозитория
- Настроить корневой `package.json` с `"workspaces": ["packages/*"]`
- Создать `packages/core/package.json`, `packages/community/package.json`, `packages/nur-course/package.json`
- Каждый пакет имеет свой `tsconfig.json`, расширяющий корневой

### FR2: Миграция кода
- `src/app/*` → `packages/core/src/*`
- `src/community/*` → `packages/community/src/*`
- `src/course/*` → `packages/nur-course/src/*`
- Обновить все импорты соответственно

### FR3: Распределение зависимостей
- **Корень:** typescript, @types/bun, @types/markdown-it, @playwright/test, playwright, dotenv-cli, @happy-dom/global-registrator, markdown-it + плагины, happy-dom
- **nur-course:** libphonenumber-js, openai

### FR4: Обновление конфигурации
- `tsconfig.json`: обновить paths алиасы (`@app/*`, `@community/*`, `@course/*`)
- `ecosystem.config.cjs`: обновить путь к серверу (`packages/core/src/server.ts`)
- `build.ts`: обновить пути к шаблонам и контенту
- `.gitignore`: добавить `packages/*/node_modules`

### FR5: Обновление скриптов
- Корневые скрипты (`package.json`) должны продолжать работать: `dev:server`, `build:dev`, `build:prod`, `start:dev`, `start:prod`, `test`, `db:*`

### FR6: Удаление папки `test/`
- Удалить корневую папку `test/` (тесты будут добавлены для каждого пакета отдельно позже)

## Нефункциональные требования
- Все существующие тесты должны проходить после миграции
- Сборка (`build.ts`) должна работать без изменений в поведении
- Сервер (`server.ts`) должен запускаться и функционировать идентично

## Критерии приёмки
- [ ] `bun install` устанавливает зависимости всех трёх пакетов
- [ ] `bun run test` — все тесты проходят
- [ ] `bun run build:dev` — сборка успешна
- [ ] `bun run dev:server` — сервер запускается
- [ ] `bun run start:dev` — дев-режим работает полностью

## За рамками (Out of Scope)
- Изменение логики приложения
- Изменение контента или вёрстки
- Добавление новых фич
- Настройка CI/CD для монорепозитория
- Добавление тестов для отдельных пакетов
