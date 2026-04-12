/**
 * AnthropicLlmProvider — calls Claude via the Anthropic SDK.
 *
 * Configured via env: ANTHROPIC_API_KEY and optionally ANTHROPIC_MODEL.
 * Default model: claude-sonnet-4-20250514
 */

import Anthropic from '@anthropic-ai/sdk';
import { ILlmProvider, LlmCompletionRequest, LlmCompletionResponse } from './ILlmProvider.js';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  /** Base URL override for testing/proxies */
  baseURL?: string;
}

export class AnthropicLlmProvider implements ILlmProvider {
  readonly providerName = 'anthropic';
  readonly modelId: string;
  private client: Anthropic;

  constructor(config: AnthropicConfig) {
    this.modelId = config.model || 'claude-sonnet-4-20250514';
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    // Separate system message from conversation messages
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: request.maxTokens ?? 1024,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: conversationMessages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const content = textBlock ? textBlock.text : '';

    return {
      content,
      provider: this.providerName,
      model: this.modelId,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
