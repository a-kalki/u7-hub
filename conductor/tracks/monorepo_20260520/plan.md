# План реализации: Переход на монорепозиторий

## Фаза 1: Подготовка структуры монорепозитория [checkpoint: c5060e1]

- [x] Task: Создать структуру директорий `packages/` [0eefdc8]
    - [x] Создать `packages/core/src/`, `packages/community/src/`, `packages/nur-course/src/`
    - [x] Создать `packages/core/package.json` (name: `@u7-hub/core`)
    - [x] Создать `packages/community/package.json` (name: `@u7-hub/community`)
    - [x] Создать `packages/nur-course/package.json` (name: `@u7-hub/nur-course`, зависимости: libphonenumber-js, openai)
    - [x] Создать `tsconfig.json` для каждого пакета (extends корневой)
- [x] Task: Настроить корневой `package.json` как workspace [0eefdc8]
    - [x] Добавить `"workspaces": ["packages/*"]`
    - [x] Удалить `libphonenumber-js` и `openai` из корневых зависимостей
    - [x] Выполнить `bun install` для проверки разрешения зависимостей
- [x] Task: Conductor - User Manual Verification 'Подготовка структуры монорепозитория' (Protocol in workflow.md) [bf49888]

## Фаза 2: Миграция пакета `@u7-hub/core` (бывший `src/app`)

- [x] Task: Зафиксировать базовое состояние — запустить все тесты до миграции [c5060e1]
    - [x] Выполнить `bun test` и убедиться, что все тесты проходят (5 pass, 13 fail — pre-existing)
- [x] Task: Переместить код `src/app/` → `packages/core/src/` [4d35890]
    - [x] Переместить все файлы из `src/app/` в `packages/core/src/`
    - [x] Обновить внутренние импорты в перемещённых файлах
- [x] Task: Обновить `tsconfig.json` paths [4d35890]
    - [x] Изменить `@app/*`: `["src/app/*"]` → `["packages/core/src/*"]`
- [x] Task: Обновить внешние импорты, ссылающиеся на `@app/*` [4d35890]
    - [x] Найти все `from "@app/` по проекту и обновить пути при необходимости
- [x] Task: Запустить тесты и убедиться, что они проходят [4d35890]
    - [x] Выполнить `bun test` — все тесты должны быть зелёными (5 pass, 13 fail — pre-existing)
- [x] Task: Conductor - User Manual Verification 'Миграция пакета core' (Protocol in workflow.md) [4d35890]

## Фаза 3: Миграция пакета `@u7-hub/community` (бывший `src/community`)

- [x] Task: Переместить код `src/community/` → `packages/community/src/` [167b7ff]
    - [x] Переместить все файлы из `src/community/` в `packages/community/src/`
    - [x] Обновить внутренние импорты
- [x] Task: Обновить `tsconfig.json` paths [167b7ff]
    - [x] Изменить `@community/*`: `["src/community/*"]` → `["packages/community/src/*"]`
- [x] Task: Обновить внешние импорты, ссылающиеся на `@community/*` [167b7ff]
    - [x] Ни одного не найдено по проекту
- [x] Task: Запустить тесты и убедиться, что они проходят [167b7ff]
    - [x] `bun test`: 5 pass, 13 fail — pre-existing
- [x] Task: Conductor - User Manual Verification 'Миграция пакета community' (Protocol in workflow.md) [167b7ff]

## Фаза 4: Миграция пакета `@u7-hub/nur-course` (бывший `src/course`)

- [x] Task: Переместить код `src/course/` → `packages/nur-course/src/` [5d4e3ef]
    - [x] Переместить все файлы из `src/course/` в `packages/nur-course/src/`
    - [x] Обновить внутренние импорты и пути в form-logic.test.ts
- [x] Task: Обновить `tsconfig.json` paths [5d4e3ef]
    - [x] Изменить `@course/*`: `["src/course/*"]` → `["packages/nur-course/src/*"]`
- [x] Task: Обновить внешние импорты, ссылающиеся на `@course/*` [5d4e3ef]
    - [x] core: server.ts, view-events.ts, view-submissions.ts — работают через path alias
- [x] Task: Запустить тесты и убедиться, что они проходят [5d4e3ef]
    - [x] `bun test`: 5 pass, 13 fail — pre-existing
- [x] Task: Conductor - User Manual Verification 'Миграция пакета nur-course' (Protocol in workflow.md) [5d4e3ef]

## Фаза 5: Обновление конфигурации и скриптов

- [ ] Task: Удалить корневую папку `test/`
    - [ ] Удалить директорию `test/` и всё её содержимое
- [ ] Task: Обновить `build.ts`
    - [ ] Обновить пути к шаблонам и контенту community и course
- [ ] Task: Обновить `ecosystem.config.cjs`
    - [ ] Изменить `args: "src/app/server.ts"` → `args: "packages/core/src/server.ts"`
- [ ] Task: Обновить скрипты в корневом `package.json`
    - [ ] `dev:server`: `src/app/server.ts` → `packages/core/src/server.ts`
    - [ ] `db:*`: скорректировать пути к db-utils
    - [ ] `test:e2e`: удалить (папка test удалена)
- [ ] Task: Обновить `.gitignore`
    - [ ] Добавить `packages/*/node_modules`
- [ ] Task: Финальная проверка — полный цикл
    - [ ] `bun install` — без ошибок
    - [ ] `bun test` — все тесты проходят
    - [ ] `bun run build:dev` — сборка успешна
    - [ ] `bun run dev:server` — сервер запускается
    - [ ] `bun run start:dev` — дев-режим работает
- [ ] Task: Conductor - User Manual Verification 'Обновление конфигурации и скриптов' (Protocol in workflow.md)
