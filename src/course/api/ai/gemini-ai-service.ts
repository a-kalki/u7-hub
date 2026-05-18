import { AIService, ChatMessage } from './ai-service';

export class GoogleAIService extends AIService {
    private apiKey: string;
    private modelName: string;
    private apiUrl: string;

    constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
        super();
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;
    }

    protected async *generateResponse(userMessage: string, history: ChatMessage[], prompt: string): AsyncGenerator<string> {
        try {
            console.log('Sending request to Google AI with model:', this.modelName);

            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: this.buildFullPrompt(userMessage, history, prompt)
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000,
                        topP: 0.8,
                        topK: 40
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Google AI API Error:', {
                    status: response.status,
                    model: this.modelName,
                    error: errorText
                });

                if (response.status === 404) {
                    yield* this.fallbackModel(userMessage, history, prompt);
                    return;
                } else if (response.status === 429) {
                    yield "Слишком много запросов. Попробуйте через минуту.";
                } else {
                    yield "Временные проблемы с сервисом. Попробуйте позже.";
                }
                return;
            }

            const data = await response.json();

            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response format from Google AI');
            }

            const responseText = data.candidates[0].content.parts[0].text;

            yield* this.streamText(responseText);

        } catch (error: any) {
            console.error("GOOGLE AI ERROR:", error);
            yield "Извините, произошла ошибка соединения. Попробуйте позже.";
        }
    }

    private async *fallbackModel(userMessage: string, history: ChatMessage[], prompt: string): AsyncGenerator<string> {
        console.log('Trying fallback model: gemini-1.5-flash-001');

        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: this.buildFullPrompt(userMessage, history, prompt)
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000,
                    }
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const responseText = data.candidates[0].content.parts[0].text;
                yield* this.streamText(responseText);
            } else {
                yield "Сервис временно недоступен. Пожалуйста, попробуйте позже или свяжитесь с Нурболатом напрямую.";
            }
        } catch (error) {
            yield "Ошибка сервиса. Попробуйте позже.";
        }
    }

    private async *streamText(text: string): AsyncGenerator<string> {
        const words = text.split(' ');

        for (const word of words) {
            yield word + ' ';
            const delay = Math.floor(Math.random() * 30) + 10;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    private buildFullPrompt(userMessage: string, history: ChatMessage[], basePrompt: string): string {
        let fullPrompt = basePrompt + "\n\n";

        if (history.length > 1) {
            fullPrompt += "ИСТОРИЯ ДИАЛОГА:\n";
            const relevantHistory = history.slice(0, -1);
            relevantHistory.forEach(msg => {
                const role = msg.role === 'user' ? 'СТУДЕНТ' : 'НАСТАВНИК';
                fullPrompt += `${role}: ${msg.content}\n`;
            });
            fullPrompt += "\n";
        }

        fullPrompt += `ТЕКУЩИЙ ВОПРОС СТУДЕНТА: ${userMessage}\n\n`;
        fullPrompt += "ОТВЕТ НАСТАВНИКА:";

        return fullPrompt;
    }
}
