# План реализации: Переход на монорепозиторий

## Фаза 1: Подготовка структуры монорепозитория

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
- [ ] Task: Conductor - User Manual Verification 'Подготовка структуры монорепозитория' (Protocol in workflow.md)

## Фаза 2: Миграция пакета `@u7-hub/core` (бывший `src/app`)

- [ ] Task: Зафиксировать базовое состояние — запустить все тесты до миграции
    - [ ] Выполнить `bun test` и убедиться, что все тесты проходят
- [ ] Task: Переместить код `src/app/` → `packages/core/src/`
    - [ ] Переместить все файлы из `src/app/` в `packages/core/src/`
    - [ ] Обновить внутренние импорты в перемещённых файлах
- [ ] Task: Обновить `tsconfig.json` paths
    - [ ] Изменить `@app/*`: `["src/app/*"]` → `["packages/core/src/*"]`
- [ ] Task: Обновить внешние импорты, ссылающиеся на `@app/*`
    - [ ] Найти все `from "@app/` по проекту и обновить пути при необходимости
- [ ] Task: Запустить тесты и убедиться, что они проходят
    - [ ] Выполнить `bun test` — все тесты должны быть зелёными
- [ ] Task: Conductor - User Manual Verification 'Миграция пакета core' (Protocol in workflow.md)

## Фаза 3: Миграция пакета `@u7-hub/community` (бывший `src/community`)

- [ ] Task: Переместить код `src/community/` → `packages/community/src/`
    - [ ] Переместить все файлы из `src/community/` в `packages/community/src/`
    - [ ] Обновить внутренние импорты
- [ ] Task: Обновить `tsconfig.json` paths
    - [ ] Изменить `@community/*`: `["src/community/*"]` → `["packages/community/src/*"]`
- [ ] Task: Обновить внешние импорты, ссылающиеся на `@community/*`
- [ ] Task: Запустить тесты и убедиться, что они проходят
- [ ] Task: Conductor - User Manual Verification 'Миграция пакета community' (Protocol in workflow.md)

## Фаза 4: Миграция пакета `@u7-hub/nur-course` (бывший `src/course`)

- [ ] Task: Переместить код `src/course/` → `packages/nur-course/src/`
    - [ ] Переместить все файлы из `src/course/` в `packages/nur-course/src/`
    - [ ] Обновить внутренние импорты
- [ ] Task: Обновить `tsconfig.json` paths
    - [ ] Изменить `@course/*`: `["src/course/*"]` → `["packages/nur-course/src/*"]`
- [ ] Task: Обновить внешние импорты, ссылающиеся на `@course/*`
- [ ] Task: Запустить тесты и убедиться, что они проходят
- [ ] Task: Conductor - User Manual Verification 'Миграция пакета nur-course' (Protocol in workflow.md)

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
