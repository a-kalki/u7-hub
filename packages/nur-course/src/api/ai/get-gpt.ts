import { OpenAIService } from './openai-service';
import { GoogleAIService } from './gemini-ai-service'
import { DeepSeekService } from './deepseek-ai-service';


export function getOpenAiService(): OpenAIService {
  const AI_API_KEY = process.env.AI_CHAT_OPENAI_API_KEY as string;

  if (!AI_API_KEY) {
    throw new Error('AI_API_KEY не установлена');
  }

  return new OpenAIService(AI_API_KEY, 'gpt-4o');

}

export function getGeminiAiService(): GoogleAIService {
  const GOOGLE_AI_KEY = process.env.AI_GEMINI_API_KEY as string;

  if (!GOOGLE_AI_KEY) {
    console.error('GOOGLE_AI_KEY must be set');
    process.exit(1);
  }

  return new GoogleAIService(GOOGLE_AI_KEY);
}

export function getDeepSeekAiService(): DeepSeekService {
  const DEEPSEEK_AI_KEY = process.env.DEEPSEEK_API_KEY as string;
  console.log('deepseek:', DEEPSEEK_AI_KEY)

  if (!DEEPSEEK_AI_KEY) {
    console.error('DEEPSEEK_AI_KEY must be set');
    process.exit(1);
  }

  return new DeepSeekService(DEEPSEEK_AI_KEY);
}
