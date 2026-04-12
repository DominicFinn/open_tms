/**
 * ILlmProvider — provider-agnostic interface for LLM completions.
 *
 * Implementations: AnthropicLlmProvider (Claude)
 * Consumers never depend on a specific provider — swap via env config.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Temperature 0.0 - 1.0. Lower = more deterministic */
  temperature?: number;
}

export interface LlmCompletionResponse {
  content: string;
  /** Which provider produced this (for audit) */
  provider: string;
  /** Which model produced this (for audit) */
  model: string;
  /** Token usage for cost tracking */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ILlmProvider {
  /** Human-readable provider name: "anthropic", "openai", etc. */
  readonly providerName: string;
  /** Model ID being used: "claude-sonnet-4-20250514", etc. */
  readonly modelId: string;

  /**
   * Send a completion request to the LLM.
   * Returns the assistant's response content.
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
