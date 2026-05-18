import { AIService, ChatMessage } from './ai-service';

export class DeepSeekService extends AIService {
  private apiUrl: string = 'https://api.deepseek.com/chat/completions';
  private apiKey: string;

  constructor(key: string) {
    super();
    this.apiKey = key;
  }

  protected async *generateResponse(userMessage: string, history: ChatMessage[], prompt: string): AsyncGenerator<string> {
    try {
      const messages = this.prepareMessages(userMessage, history, prompt);

      console.log('Sending to DeepSeek:', {
        messagesCount: messages.length,
        historyLength: history.length
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: messages,
          stream: true,
          temperature: 0.8,
          max_tokens: 1200,
          top_p: 0.9
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API error:', errorText);
        throw new Error(`DeepSeek error: ${response.status}`);
      }

      yield* this.handleStream(response);

    } catch (error: any) {
      console.error("DEEPSEEK ERROR:", error);
      yield "Извините, сервис временно недоступен. Попробуйте позже.";
    }
  }

  private async *handleStream(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              const content = data.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              console.warn('Failed to parse SSE message:', trimmedLine);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private prepareMessages(userMessage: string, history: ChatMessage[], prompt: string) {
    const messages: { role: string; content: string }[] = [];

    // 1. Системный промпт с динамическим контекстом
    messages.push({
      role: 'system',
      content: prompt,
    });

    // 2. История диалога как отдельные сообщения
    const recentHistory = this.getRecentHistory(history, 8);

    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // 3. Текущее сообщение пользователя
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  private getRecentHistory(history: ChatMessage[], maxMessages: number): ChatMessage[] {
    if (history.length <= 1) return [];

    const startIndex = Math.max(0, history.length - 1 - maxMessages);
    return history.slice(startIndex, -1);
  }
}
