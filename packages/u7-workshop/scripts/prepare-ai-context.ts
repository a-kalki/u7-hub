import { Window } from 'happy-dom';
import { promises as fs } from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const htmlFilePath = path.join(projectRoot, 'src', 'ui', 'index.html');
const contextOutputPath = path.join(projectRoot, 'src', 'api', 'ai', 'ai-context.txt');

async function extractTextFromHtml(filePath: string): Promise<string> {
    const htmlContent = await fs.readFile(filePath, 'utf-8');
    let extractedText = ''
    
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = htmlContent;

    // Удаляем скрипты и стили, чтобы они не попали в контекст
    document.querySelectorAll('script, style, meta, link').forEach(element => element.remove());

    // Общая функция для очистки текста от HTML тегов и нормализации пробелов
    const getCleanText = (element: any): string => {
        if (!element) return '';
        
        const clone = element.cloneNode(true);
        
        // Удаляем элементы, которые будут обработаны отдельно
        clone.querySelectorAll('a, .term-card, ul, ol').forEach((el: any) => el.remove());
        
        // Заменяем <br> на пробелы
        clone.querySelectorAll('br').forEach((br: any) => {
            br.replaceWith(' ');
        });
        
        // ⚠️ ИСПРАВЛЕНИЕ 1: Правильная обработка зачеркнутого текста
        clone.querySelectorAll('s, strike, del').forEach((strikethroughEl: any) => {
            const text = strikethroughEl.textContent || '';
            // Сохраняем зачеркнутый текст с markdown-форматированием
            strikethroughEl.replaceWith(`~~${text}~~`);
        });
        
        // ⚠️ ИСПРАВЛЕНИЕ 2: Удаляем пустые span и другие inline элементы
        clone.querySelectorAll('strong, b, em, i, span').forEach((el: any) => {
            const text = el.textContent || '';
            // Если элемент пустой или содержит только пробелы - удаляем
            if (!text.trim()) {
                el.remove();
            } else {
                el.replaceWith(text);
            }
        });
        
        const text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
    };

    // ⚠️ ИСПРАВЛЕНИЕ 3: Универсальная проверка служебных элементов
    const shouldSkipElement = (element: any): boolean => {
        const tagName = element.tagName.toLowerCase();
        const classList = element.classList;
        const id = element.id || '';
        
        // Универсальные признаки служебных элементов
        const isUtility = 
            // Элементы навигации и управления
            classList.contains('btn') ||
            classList.contains('nav') ||
            classList.contains('menu') ||
            classList.contains('button') ||
            classList.contains('tab') ||
            id.includes('nav') ||
            id.includes('menu') ||
            id.includes('button') ||
            
            // Элементы UI/UX и интерактивные элементы
            classList.contains('indicator') ||
            classList.contains('dot') ||
            classList.contains('slider') ||
            classList.contains('slides') ||
            classList.contains('control') ||
            classList.contains('to-top-btn') ||
            
            // Элементы описаний и подписей
            classList.contains('description-container') ||
            classList.contains('description') ||
            
            // Пустые или декоративные элементы
            (!element.textContent?.trim() && 
             !element.querySelector('img, h1, h2, h3, h4, h5, h6, p, li, a, blockquote'));
        
        return isUtility || element.closest('.slides, .tab-bar, .indicator');
    };

    // ⚠️ ИСПРАВЛЕНИЕ 4: Улучшенная обработка списков с вложенностью
    const processListElement = (list: any): string => {
        const tagName = list.tagName.toLowerCase();
        const items = list.querySelectorAll('li');
        let listContent = '';
        
        items.forEach((li: any, index: number) => {
            // Сначала обрабатываем вложенные списки
            const nestedLists = li.querySelectorAll('ul, ol');
            let nestedContent = '';
            
            nestedLists.forEach((nestedList: any) => {
                nestedContent += processListElement(nestedList);
                nestedList.remove(); // Удаляем обработанные вложенные списки
            });
            
            const itemText = getCleanText(li);
            if (itemText && itemText.trim()) {
                const prefix = tagName === 'ol' ? `${index + 1}. ` : '• ';
                listContent += `${prefix}${itemText}\n`;
                
                if (nestedContent) {
                    // Добавляем отступ для вложенного контента
                    const indentedNested = nestedContent.split('\n')
                        .map(line => line ? `  ${line}` : '')
                        .join('\n');
                    listContent += indentedNested + '\n';
                }
            }
        });
        
        if (listContent.trim()) {
            list.dataset.processed = 'true';
            return listContent + '\n';
        }
        return '';
    };

    // ⚠️ ИСПРАВЛЕНИЕ 5: Улучшенная обработка ссылок с динамическим контекстом
    const formatLinkElement = (element: any): string => {
        const href = element.getAttribute('href');
        const linkText = getCleanText(element);
        
        if (!href) return linkText || '';

        // Ищем описательный текст рядом со ссылкой
        let description = '';
        let nextElement = element.nextElementSibling;
        
        // Ищем следующий элемент с текстом (но не другую ссылку)
        while (nextElement && !description && nextElement.nodeType === 1) {
            if (nextElement.tagName.toLowerCase() !== 'a' && 
                !nextElement.classList.contains('term-card-title') &&
                !nextElement.classList.contains('term-card-body')) {
                
                const nextText = getCleanText(nextElement);
                if (nextText && nextText.length > 10 && !nextText.includes('http')) {
                    description = nextText;
                    // Помечаем как обработанный, чтобы не дублировать
                    nextElement.dataset.processed = 'true';
                    break;
                }
            }
            nextElement = nextElement.nextElementSibling;
        }
        
        const displayText = linkText && linkText !== href && linkText.length > 0 ? 
            linkText : 'Ссылка';
            
        return description ? `[${displayText}](${href}) - ${description}` : `[${displayText}](${href})`;
    };

    const processNode = (node: any) => {
        let result = '';
        
        // Собираем ВСЕ элементы в правильном порядке
        const allElements = node.querySelectorAll('*');
        
        allElements.forEach((el: any) => {
            const tagName = el.tagName.toLowerCase();
            
            // Пропускаем ненужные элементы
            if (shouldSkipElement(el)) {
                return;
            }

            // ⚠️ ОБРАБОТКА КАРТОЧЕК - ВОССТАНАВЛИВАЕМ ФОРМАТ
            if (el.classList.contains('term-card') && !el.dataset.processed) {
                const title = getCleanText(el.querySelector('.term-card-title'));
                const body = getCleanText(el.querySelector('.term-card-body'));
                
                if (title && body) {
                    result += `--- КАРТОЧКА ---\n**${title}**\n${body}\n\n`;
                    el.dataset.processed = 'true';
                }
                return;
            }

            // Пропускаем элементы внутри уже обработанных карточек
            if (el.closest('.term-card[data-processed="true"]')) {
                return;
            }

            // Пропускаем отдельные элементы карточек
            if (el.classList.contains('term-card-title') || el.classList.contains('term-card-body')) {
                return;
            }

            // Пропускаем контейнер карточек
            if (el.classList.contains('term-cards')) {
                return;
            }

            // ⚠️ ОБРАБОТКА СПИСКОВ - ВОССТАНАВЛИВАЕМ
            if ((tagName === 'ul' || tagName === 'ol') && !el.dataset.processed) {
                result += processListElement(el);
                return;
            }

            // ⚠️ Пропускаем отдельные <li> (они уже обработаны в списках)
            if (tagName === 'li' && el.closest('ul, ol')) {
                return;
            }

            const text = getCleanText(el);
            if (!text && tagName !== 'a') return;

            let formattedLine = '';

            switch (tagName) {
                case 'h1':
                    formattedLine = `# ${text}`;
                    break;
                case 'h2':
                    formattedLine = `## ${text}`;
                    break;
                case 'h3':
                    formattedLine = `### ${text}`;
                    break;
                case 'h4':
                    formattedLine = `#### ${text}`;
                    break;
                case 'h5':
                    formattedLine = `##### ${text}`;
                    break;
                case 'h6':
                    formattedLine = `###### ${text}`;
                    break;
                case 'p':
                    formattedLine = text;
                    break;
                case 'div':
                    // Для div - только если нет других значимых элементов внутри
                    if (!el.querySelector('h1, h2, h3, h4, h5, h6, p, li, a, blockquote')) {
                        formattedLine = text;
                    }
                    break;
                case 'a':
                    formattedLine = formatLinkElement(el);
                    break;
                case 'blockquote':
                    formattedLine = `> ${text.replace(/\n/g, '\n> ')}`;
                    break;
                default:
                    if (el.parentElement?.tagName.toLowerCase() !== 'p') {
                        formattedLine = text;
                    }
                    break;
            }
            
            if(formattedLine && formattedLine.trim()) {
                result += formattedLine + '\n\n';
            }
        });
        
        return result;
    };

    // ⚠️ ИСПРАВЛЕНИЕ 7: Универсальное удаление дубликатов
    const removeUniversalDuplicates = (text: string): string => {
        const lines = text.split('\n');
        const result: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            const prevLine = result[result.length - 1]?.trim() || '';
            
            if (!currentLine) {
                if (result.length === 0 || result[result.length - 1] !== '') {
                    result.push('');
                }
                continue;
            }
            
            // Универсальная проверка на дубликаты
            const isDuplicate = 
                // Полное совпадение
                currentLine === prevLine ||
                // Короткие изолированные фразы (1-3 слова) без пунктуации
                (currentLine.split(/\s+/).length <= 3 && 
                 currentLine === prevLine &&
                 !currentLine.match(/[.!?;:]$/)) ||
                // Структурные дубли (одинаковое начало коротких фраз)
                (currentLine.split(/\s+/)[0] === prevLine.split(/\s+/)[0] &&
                 currentLine.split(/\s+/).length <= 5 &&
                 currentLine.length < 50);
            
            if (!isDuplicate) {
                result.push(lines[i]); // Сохраняем оригинальную строку с пробелами
            }
        }
        
        return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    };

    // 1. Обрабатываем Header (панель вкладок)
    const header = document.querySelector('.tab-bar');
    if (header) {
        extractedText += `--- НАЧАЛО HEADER (НАВИГАЦИЯ) ---\n\n`;
        extractedText += processNode(header);
    }

    // 2. Обрабатываем вкладки
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tabContent => {
        const tabId = tabContent.id;
        const tabName = tabId.replace('-tab', '');
        
        // Получаем название вкладки из кнопки навигации
        const tabButton = document.querySelector(`.btn[data-tab="${tabName}"]`);
        const tabDisplayName = tabButton ? tabButton.textContent?.trim() : tabName;

        extractedText += `--- НАЧАЛО ВКЛАДКИ: ${tabDisplayName} ---\n\n`;
        
        // Обрабатываем основной контент вкладки
        extractedText += processNode(tabContent);
    });

    // 3. Обрабатываем Footer
    const footer = document.querySelector('footer');
    if (footer) {
        extractedText += `--- НАЧАЛО FOOTER ---\n\n`;
        extractedText += processNode(footer);
    }

    return removeUniversalDuplicates(extractedText);
}

async function main() {
    try {
        console.log(`📖 Чтение контента из ${htmlFilePath}...`);
        const textContent = await extractTextFromHtml(htmlFilePath);
        
        // Создаем директорию если не существует
        await fs.mkdir(path.dirname(contextOutputPath), { recursive: true });
        
        await fs.writeFile(contextOutputPath, textContent, 'utf-8');
        console.log(`✅ AI контекст успешно сгенерирован: ${contextOutputPath}`);
        console.log(`\n📋 Предпросмотр контекста:\n---`);
        console.log(textContent.substring(0, 500) + '...');
        console.log('---');
        console.log(`📊 Общий размер: ${textContent.length} символов`);

    } catch (error) {
        console.error('❌ Ошибка при генерации AI контекста:', error);
        process.exit(1);
    }
}

main();
