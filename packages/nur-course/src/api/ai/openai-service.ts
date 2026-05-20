import OpenAI from 'openai';
import { AIService, ChatMessage } from './ai-service';

export class OpenAIService extends AIService {
  private openai: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    super();
    this.openai = new OpenAI({ apiKey });
    this.modelName = modelName;
  }

    protected async *generateResponse(userMessage: string, history: ChatMessage[], prompt: string): AsyncGenerator<string> {
        try {
            const stream = await this.openai.chat.completions.create({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: prompt
                    },
                    {
                        role: 'user',
                        content: userMessage
                    },
                ],
                stream: true,
                temperature: 0.8,
                max_tokens: 800,
                presence_penalty: 0.2,
                frequency_penalty: 0.3,
            });

            for await (const chunk of stream) {
                const chunkText = chunk.choices[0]?.delta?.content || '';
                yield chunkText;
            }

        } catch (error: any) {
            console.error("OPENAI ERROR:", error);
            yield "Извините, произошла техническая ошибка. Попробуйте позже.";
        }
    }
}
