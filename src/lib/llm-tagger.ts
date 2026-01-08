import { loadConfig } from './config.js';
import { listNodes } from './db.js';

export interface TagSuggestion {
  tag: string;
  confidence: number;
}

export interface LLMTaggingResult {
  tags: string[];
  suggestions: TagSuggestion[];
  model: string;
  cost?: number;
}

/**
 * Get top N most common tags from database to provide as vocabulary context
 */
async function getTopTags(limit = 200): Promise<string[]> {
  const nodes = await listNodes();
  const tagCounts = new Map<string, number>();

  for (const node of nodes) {
    for (const tag of node.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Generate tags for a note using LLM (GPT-5-nano or fallback models)
 */
export async function generateTagsLLM(
  title: string,
  body: string,
  maxTags = 7,
  minConfidence = 0.6,
): Promise<LLMTaggingResult> {
  const config = loadConfig();

  // Get API key
  const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key required for LLM tagging. Run "forest config" to set it up.',
    );
  }

  // Get model from config
  const model = config.llmTaggerModel || 'gpt-5-nano';

  // Get vocabulary context
  const topTags = await getTopTags(200);
  const vocabularyContext = topTags.slice(0, 200).join(', ');

  // Construct input for Responses API
  const input = `You are a tagging assistant for a personal knowledge base.
Given a note, suggest 3-${maxTags} relevant tags that best capture its key topics.

IMPORTANT: Prefer reusing existing tags from the vocabulary below.
Only create new tags if existing ones don't adequately describe the content.
Use lowercase for all tags. Multi-word tags are allowed (e.g., "erie canal").

Existing tag vocabulary (top 200 most common):
${vocabularyContext}

Note title: ${title}
Note body: ${body.slice(0, 2000)}${body.length > 2000 ? '...' : ''}

Return ONLY a JSON array of objects with "tag" and "confidence" (0-1) fields.
Example: [{"tag": "river", "confidence": 0.95}, {"tag": "ecology", "confidence": 0.85}]`;

  // Call OpenAI Responses API (required for GPT-5 models)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      reasoning: { effort: 'minimal' }, // Fast tagging, minimal reasoning
      text: { verbosity: 'low' }, // Concise JSON output
      max_output_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result: any = await response.json();

  // Parse Responses API format: output[].content[].text
  const messageItem = result.output?.find((item: any) => item.type === 'message');
  const textItem = messageItem?.content?.find((item: any) => item.type === 'output_text');
  const content = textItem?.text;

  if (!content) {
    // Log the full response for debugging
    console.error('OpenAI API response:', JSON.stringify(result, null, 2));
    throw new Error('No content in OpenAI response');
  }

  // Parse JSON response
  let suggestions: TagSuggestion[];
  try {
    // Extract JSON from response (handle cases where LLM adds markdown formatting)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    suggestions = JSON.parse(jsonStr);

    if (!Array.isArray(suggestions)) {
      throw new Error('Response is not an array');
    }
  } catch (err) {
    throw new Error(`Failed to parse LLM response as JSON: ${content}`);
  }

  // Filter by confidence and validate
  const validSuggestions = suggestions
    .filter((s) => s.tag && typeof s.confidence === 'number' && s.confidence >= minConfidence)
    .slice(0, maxTags);

  // Normalize tags (lowercase, trim)
  const normalizedSuggestions = validSuggestions.map((s) => ({
    tag: s.tag.toLowerCase().trim(),
    confidence: s.confidence,
  }));

  // Deduplicate
  const seen = new Set<string>();
  const dedupedSuggestions = normalizedSuggestions.filter((s) => {
    if (seen.has(s.tag)) return false;
    seen.add(s.tag);
    return true;
  });

  // Extract just the tag names for return
  const tags = dedupedSuggestions.map((s) => s.tag);

  // Estimate cost (rough approximation)
  const inputTokens = (input.length / 4) + 50; // Rough estimate: 4 chars per token
  const outputTokens = (content.length / 4);
  const cost = estimateCost(model, inputTokens, outputTokens);

  return {
    tags,
    suggestions: dedupedSuggestions,
    model,
    cost,
  };
}

/**
 * Estimate cost for LLM API call
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Pricing per 1M tokens (as of 2025)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-5-nano': { input: 0.015, output: 0.06 }, // 10x cheaper than gpt-4o-mini
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.5, output: 10.0 },
  };

  const rates = pricing[model] || pricing['gpt-4o-mini'];
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

/**
 * Fallback: generate tags using lexical method if LLM fails
 */
export function generateTagsLexicalFallback(
  title: string,
  body: string,
  maxTags = 7,
): string[] {
  // Import extractTags from text.ts would create circular dependency
  // So we'll just return empty array and let caller handle it
  return [];
}
