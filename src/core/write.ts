import { loadConfig } from '../lib/config';

export type WriteModel = 'gpt-5' | 'gpt-5-mini' | 'gpt-4o';
export type WriteReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type WriteVerbosity = 'low' | 'medium' | 'high';

export interface WriteOptions {
  model?: WriteModel;
  reasoning?: WriteReasoningEffort;
  verbosity?: WriteVerbosity;
  maxTokens?: number;
}

export interface WriteResult {
  title: string;
  body: string;
  suggestedTags: string[];
  topic: string;
  model: string;
  reasoningEffort: string;
  verbosity: string;
  cost: number;
  tokensUsed: {
    reasoning: number;
    output: number;
  };
}

interface WriteResponse {
  title: string;
  body: string;
  suggestedTags: string[];
}

/**
 * Use GPT-5 to write an article on any topic
 */
export async function writeArticleCore(
  topic: string,
  options: WriteOptions = {}
): Promise<WriteResult> {
  // Validate topic
  if (!topic || topic.trim().length === 0) {
    throw new Error('Topic cannot be empty');
  }

  // Set defaults
  const model = options.model || 'gpt-5';
  const reasoning = options.reasoning || 'high'; // Default to high reasoning for quality
  const verbosity = options.verbosity || 'high'; // Default to comprehensive articles

  // Set realistic token limits based on verbosity if not explicitly provided
  const maxTokens = options.maxTokens || getDefaultMaxTokens(verbosity);

  // Get API key
  const config = loadConfig();
  const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key required for writing. Run "forest config" to set it up.'
    );
  }

  // Build writing prompt
  const prompt = buildWritingPrompt(topic, maxTokens, verbosity);

  // Call OpenAI Responses API
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      reasoning: { effort: reasoning },
      text: { verbosity },
      max_output_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result: any = await response.json();

  // Parse Responses API format: output[].content[].text
  const messageItem = result.output?.find((item: any) => item.type === 'message');
  const textItem = messageItem?.content?.find((item: any) => item.type === 'output_text');
  const content = textItem?.text;

  if (!content) {
    console.error('OpenAI API response:', JSON.stringify(result, null, 2));
    throw new Error('No content in OpenAI response');
  }

  // Parse JSON response
  let writeData: WriteResponse;
  try {
    // Extract JSON from response (handle cases where LLM adds markdown formatting)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    writeData = JSON.parse(jsonStr);

    if (!writeData.title || !writeData.body) {
      throw new Error('Response missing required fields (title, body)');
    }
  } catch (err) {
    // Check if response appears truncated
    const isTruncated = !content.trim().endsWith('}') || content.includes('..."body"');

    if (isTruncated) {
      throw new Error(
        `Response appears truncated (likely exceeded token limit).\n` +
        `Try reducing --max-tokens (current: ${maxTokens}) or use --verbosity=medium/low.\n` +
        `Partial response:\n${content.slice(0, 500)}...`
      );
    }

    throw new Error(
      `Failed to parse write response as JSON.\n` +
      `Response preview:\n${content.slice(0, 500)}...`
    );
  }

  // Extract token usage and calculate cost
  const reasoningTokens = extractReasoningTokens(result);
  const outputTokens = extractOutputTokens(result);
  const cost = estimateCost(model, reasoningTokens, outputTokens);

  return {
    title: writeData.title,
    body: writeData.body,
    suggestedTags: writeData.suggestedTags || [],
    topic,
    model,
    reasoningEffort: reasoning,
    verbosity,
    cost,
    tokensUsed: {
      reasoning: reasoningTokens,
      output: outputTokens,
    },
  };
}

/**
 * Get default max tokens based on verbosity level
 */
function getDefaultMaxTokens(verbosity: WriteVerbosity): number {
  switch (verbosity) {
    case 'low':
      return 4096;
    case 'medium':
      return 8192;
    case 'high':
      return 16384;
    default:
      return 16384;
  }
}

/**
 * Get word count guidance based on verbosity
 */
function getWordCountGuidance(verbosity: WriteVerbosity): string {
  switch (verbosity) {
    case 'low':
      return '500-800 words';
    case 'medium':
      return '800-1200 words';
    case 'high':
      return '1200-2000 words';
    default:
      return '1200-2000 words';
  }
}

/**
 * Build the writing prompt for a topic
 */
function buildWritingPrompt(topic: string, maxTokens: number, verbosity: WriteVerbosity): string {
  const wordGuidance = getWordCountGuidance(verbosity);

  return `You are a knowledgeable writer creating comprehensive articles for a personal knowledge base.

Write a detailed, well-researched article on the following topic:

"${topic}"

IMPORTANT: Your response MUST be under ${maxTokens} tokens. Keep your article concise and well-structured.

Requirements:
1. Write a comprehensive, informative article (${wordGuidance})
2. Use clear, engaging prose with proper markdown formatting
3. Include section headers (## and ###) to organize content
4. Cover key concepts, historical context, practical applications, and interesting details
5. Write as if for an intelligent, curious reader who wants to learn deeply
6. Be accurate and cite interesting facts or examples where relevant
7. CRITICAL: Stay under ${maxTokens} tokens - complete your JSON response properly

Return your response as JSON:
{
  "title": "A compelling, specific title for the article",
  "body": "The full article text in markdown format (${wordGuidance}, well-structured with headers)",
  "suggestedTags": ["relevant", "topic", "tags"]
}

Write something genuinely informative and interesting - this will become part of a personal knowledge base.`;
}

/**
 * Extract reasoning token count from response
 */
function extractReasoningTokens(result: any): number {
  // Look for reasoning items in output
  const reasoningItems = result.output?.filter((item: any) => item.type === 'reasoning');
  if (!reasoningItems || reasoningItems.length === 0) return 0;

  // Sum up token counts from reasoning items
  return reasoningItems.reduce((sum: number, item: any) => {
    if (item.tokens) return sum + item.tokens;
    const content = item.content?.[0]?.text || '';
    return sum + Math.ceil(content.length / 4);
  }, 0);
}

/**
 * Extract output token count from response
 */
function extractOutputTokens(result: any): number {
  // Look for the message item
  const messageItem = result.output?.find((item: any) => item.type === 'message');
  if (!messageItem) return 0;

  // If API provides token count, use it
  if (result.usage?.output_tokens) {
    return result.usage.output_tokens;
  }

  // Otherwise estimate from content length
  const textItem = messageItem.content?.find((item: any) => item.type === 'output_text');
  const content = textItem?.text || '';
  return Math.ceil(content.length / 4);
}

/**
 * Estimate cost for writing based on model and token usage
 */
function estimateCost(model: string, reasoningTokens: number, outputTokens: number): number {
  // Pricing per 1M tokens (as of 2025)
  const pricing: Record<string, { reasoning: number; output: number }> = {
    'gpt-5': { reasoning: 1.0, output: 4.0 },
    'gpt-5-mini': { reasoning: 0.2, output: 0.8 },
    'gpt-4o': { reasoning: 2.5, output: 10.0 },
  };

  const rates = pricing[model] || pricing['gpt-5'];
  const reasoningCost = (reasoningTokens / 1_000_000) * rates.reasoning;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return reasoningCost + outputCost;
}
