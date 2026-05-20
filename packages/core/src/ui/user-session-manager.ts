const CHAT_HISTORY_TTL = 30 * 60 * 1000; // 30 минут
const USER_ID_KEY = 'chatUserId';
const LAST_ACTIVITY_KEY = 'lastChatActivity';

class UserSessionManager {
    // Получить или создать ID пользователя
    static getOrCreateUserId(): string {
        let userId = localStorage.getItem(USER_ID_KEY);
        
        if (!userId) {
            userId = this.generateUserId();
            localStorage.setItem(USER_ID_KEY, userId);
        }
        
        return userId;
    }

    // Обновить время последней активности
    static updateLastActivity(): void {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    // Получить ключ для истории чата
    static getChatHistoryKey(): string {
        const userId = this.getOrCreateUserId();
        return `chatHistory_${userId}`;
    }

    // Очистить просроченную историю
    static cleanupExpiredHistory(): void {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        
        if (!lastActivity) {
            // Если нет времени активности, очищаем всю историю
            this.clearAllHistory();
            return;
        }

        const now = Date.now();
        const timePassed = now - parseInt(lastActivity);
        
        if (timePassed > CHAT_HISTORY_TTL) {
            this.clearAllHistory();
        }
    }

    // Получить оставшееся время до очистки
    static getTimeUntilCleanup(): number {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        
        if (!lastActivity) {
            return CHAT_HISTORY_TTL;
        }

        const now = Date.now();
        const timePassed = now - parseInt(lastActivity);
        return Math.max(0, CHAT_HISTORY_TTL - timePassed);
    }

    // Получить актуальную историю (если не просрочена)
    static getValidHistory(): Array<any> {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        
        if (!lastActivity) {
            return [];
        }

        const now = Date.now();
        const timePassed = now - parseInt(lastActivity);
        
        if (timePassed > CHAT_HISTORY_TTL) {
            this.clearAllHistory();
            return [];
        }

        const historyKey = this.getChatHistoryKey();
        const savedHistory = localStorage.getItem(historyKey);
        
        if (!savedHistory) {
            return [];
        }

        try {
            return JSON.parse(savedHistory);
        } catch (error) {
            console.error('Error parsing chat history:', error);
            this.clearAllHistory();
            return [];
        }
    }

    // Сохранить сообщение в историю
    static saveMessageToHistory(content: string, role: 'user' | 'assistant'): void {
        // Сначала обновляем активность
        this.updateLastActivity();
        
        const key = this.getChatHistoryKey();
        const existingHistory = this.getValidHistory();
        
        const newMessage = { 
            role, 
            content, 
            timestamp: Date.now() 
        };
        
        // Добавляем новое сообщение и сохраняем только последние 20
        const updatedHistory = [...existingHistory, newMessage].slice(-20);
        localStorage.setItem(key, JSON.stringify(updatedHistory));
    }

    // Полная очистка всех данных сессии
    static clearAllHistory(): void {
        const historyKey = this.getChatHistoryKey();
        localStorage.removeItem(historyKey);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        // userId не удаляем - он постоянный для пользователя
    }

    // Генерация уникального ID пользователя
    static generateUserId(): string {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Проверить, активна ли текущая сессия
    static isSessionActive(): boolean {
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        
        if (!lastActivity) {
            return false;
        }

        const now = Date.now();
        const timePassed = now - parseInt(lastActivity);
        return timePassed <= CHAT_HISTORY_TTL;
    }
}

export default UserSessionManager;
