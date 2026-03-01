/**
 * OpenAI LLM Provider
 * Default implementation of LLMProvider using OpenAI API
 */

import OpenAI from 'openai';
import { LLMProvider, LLMMessage, LLMRequestOptions } from '../types';

export interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;  // For OpenAI-compatible APIs (Azure, local, etc.)
}

export class OpenAIProvider implements LLMProvider {
  private openai: OpenAI;
  private model: string;

  constructor(config: OpenAIProviderConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  async chat(
    messages: LLMMessage[],
    options: LLMRequestOptions = {}
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 2000,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined
    });

    return response.choices[0]?.message?.content || '';
  }
}
