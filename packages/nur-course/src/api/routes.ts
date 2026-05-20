import { type Database } from 'bun:sqlite';
// TODO: Исправить пути импорта после рефакторинга сервисов
import { saveAnalyticsData } from './services/analytics';
import { saveFormData } from './services/formSubmission';
import { getDeepSeekAiService } from './ai/get-gpt';

// Инициализация AI сервиса должна быть вынесена на уровень приложения (в app/server.ts)
// и передаваться в обработчики роутов. Пока оставим так для простоты.
const aiService = getDeepSeekAiService();

const HEADERS = {};

export async function handleCourseRoutes(request: Request, db: Database): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/api/track') {
        try {
            const data = await request.json();
            await saveAnalyticsData(db, data);
            return new Response('Данные аналитики получены и сохранены', { status: 200, headers: HEADERS });
        } catch (error: any) {
            console.error('COURSE API: Error processing analytics data:', error);
            const isProd = process.env.NODE_ENV === 'production';
            const errorMessage = isProd ? 'Внутренняя ошибка сервера.' : `Ошибка: ${error.message}`;
            const status = isProd ? 500 : 400;
            return new Response(errorMessage, { status, headers: HEADERS });
        }
    }

    if (request.method === 'POST' && url.pathname === '/api/submit-form') {
        try {
            const formData = await request.json();
            await saveFormData(db, formData);
            return new Response('Данные формы получены и сохранены', { status: 200, headers: HEADERS });
        } catch (error: any) {
            console.error('COURSE API: Ошибка при обработке данных формы:', error);
            const isProd = process.env.NODE_ENV === 'production';
            const errorMessage = isProd ? 'Внутренняя ошибка сервера.' : `Ошибка: ${error.message}`;
            const status = isProd ? 500 : 400;
            return new Response(errorMessage, { status, headers: HEADERS });
        }
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
        try {
            const { question, userId } = await request.json();
            
            if (!question || typeof question !== 'string') {
                return new Response('"question" обязательно', { status: 400, headers: HEADERS });
            }
            
            if (!userId || typeof userId !== 'string') {
                return new Response('"userId" обязательно', { status: 400, headers: HEADERS });
            }

            console.log(`Chat request from user: ${userId.substring(0, 8)}...`);

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of aiService.processMessage(userId, question)) {
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                    } catch (error) {
                        console.error('Stream error:', error);
                        controller.enqueue(new TextEncoder().encode('Ошибка потока'));
                    } finally {
                        controller.close();
                    }
                }
            });

            return new Response(stream, {
                headers: {
                    ...HEADERS,
                    'Content-Type': 'text/plain; charset=utf-8',
                }
            });

        } catch (error: any) {
            console.error('COURSE API: CHAT API ERROR:', error);
            return new Response('Внутренняя ошибка', { status: 500, headers: HEADERS });
        }
    }

    // Если ни один роут не подошел, возвращаем null, чтобы главный сервер мог продолжить обработку
    return null;
}
