import { getNodeById, NodeRecord } from '../lib/db.js';
import { loadConfig } from '../lib/config.js';

export type SynthesisModel = 'gpt-5' | 'gpt-5-mini';
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type TextVerbosity = 'low' | 'medium' | 'high';

export interface SynthesizeOptions {
  model?: SynthesisModel;
  reasoning?: ReasoningEffort;
  verbosity?: TextVerbosity;
  maxTokens?: number;
}

export interface SynthesisResult {
  title: string;
  body: string;
  suggestedTags: string[];
  sourceNodeIds: string[];
  model: string;
  reasoningEffort: string;
  verbosity: string;
  cost: number;
  tokensUsed: {
    reasoning: number;
    output: number;
  };
}

interface SynthesisResponse {
  title: string;
  body: string;
  suggestedTags: string[];
}

/**
 * Synthesize a new article from multiple source nodes using GPT-5
 */
export async function synthesizeNodesCore(
  nodeIds: string[],
  options: SynthesizeOptions = {}
): Promise<SynthesisResult> {
  // Validate inputs
  if (!nodeIds || nodeIds.length < 2) {
    throw new Error('At least 2 node IDs are required for synthesis');
  }

  // Fetch all source nodes
  const nodes: NodeRecord[] = [];
  for (const id of nodeIds) {
    const node = await getNodeById(id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }
    nodes.push(node);
  }

  // Set defaults
  const model = options.model || 'gpt-5';
  const reasoning = options.reasoning || 'high'; // Default to high reasoning for quality synthesis
  const verbosity = options.verbosity || 'high'; // Default to comprehensive synthesis

  // Set realistic token limits based on verbosity if not explicitly provided
  const maxTokens = options.maxTokens || getDefaultMaxTokens(verbosity);

  // Get API key
  const config = loadConfig();
  const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key required for synthesis. Run "forest config" to set it up.'
    );
  }

  // Build synthesis prompt
  const prompt = buildSynthesisPrompt(nodes, maxTokens, verbosity);

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
  let synthesisData: SynthesisResponse;
  try {
    // Extract JSON from response (handle cases where LLM adds markdown formatting)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    synthesisData = JSON.parse(jsonStr);

    if (!synthesisData.title || !synthesisData.body) {
      throw new Error('Response missing required fields (title, body)');
    }
  } catch (err) {
    throw new Error(`Failed to parse synthesis response as JSON: ${content}`);
  }

  // Extract token usage and calculate cost
  const reasoningTokens = extractReasoningTokens(result);
  const outputTokens = extractOutputTokens(result);
  const cost = estimateCost(model, reasoningTokens, outputTokens);

  return {
    title: synthesisData.title,
    body: synthesisData.body,
    suggestedTags: synthesisData.suggestedTags || [],
    sourceNodeIds: nodeIds,
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
function getDefaultMaxTokens(verbosity: TextVerbosity): number {
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
function getWordCountGuidance(verbosity: TextVerbosity): string {
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
 * Build the synthesis prompt from source nodes
 */
function buildSynthesisPrompt(nodes: NodeRecord[], maxTokens: number, verbosity: TextVerbosity): string {
  const wordGuidance = getWordCountGuidance(verbosity);

  const nodeDescriptions = nodes
    .map((node, i) => {
      return `## Note ${i + 1}: ${node.title}
Tags: ${node.tags.join(', ')}

${node.body}`;
    })
    .join('\n\n---\n\n');

  return `You are synthesizing knowledge from a personal knowledge base, creating new insights by connecting existing notes.

I will provide you with ${nodes.length} notes. Your task is to write a NEW article that synthesizes these ideas.

IMPORTANT: Your response MUST be under ${maxTokens} tokens. Keep your synthesis concise and well-structured.

Requirements:
1. Explore connections and relationships between the notes (${wordGuidance})
2. Identify patterns, themes, and emergent ideas that span across the notes
3. Expand on ideas at the boundaries/edges of this knowledge
4. Introduce novel perspectives or insights that emerge from combining these ideas
5. Use clear, engaging prose with proper markdown formatting
6. Include section headers (## and ###) to organize your synthesis
7. Be comprehensive yet focused - synthesize, don't just summarize
8. CRITICAL: Stay under ${maxTokens} tokens - complete your JSON response properly

Source notes:

${nodeDescriptions}

---

Based on these notes, write a synthesized article that reveals new insights. Return your response as JSON:
{
  "title": "A compelling, specific title for the synthesized article",
  "body": "The full synthesis in markdown format (${wordGuidance}, well-structured with headers)",
  "suggestedTags": ["3-5 relevant topic tags based on the synthesis themes and cross-cutting concepts"]
}

Focus on connections, patterns, and emergent ideas that aren't obvious from reading the notes individually. For tags, identify the key themes and concepts that emerge from the synthesis - not just the source note tags, but the new concepts that arise from combining them. This synthesis will become part of the knowledge base, so make it genuinely insightful.`;
}

/**
 * Extract reasoning token count from response
 */
function extractReasoningTokens(result: any): number {
  // Look for reasoning items in output
  const reasoningItems = result.output?.filter((item: any) => item.type === 'reasoning');
  if (!reasoningItems || reasoningItems.length === 0) return 0;

  // Sum up token counts from reasoning items
  // Note: Actual token counting may vary based on API response format
  return reasoningItems.reduce((sum: number, item: any) => {
    // If the API provides token counts, use them
    if (item.tokens) return sum + item.tokens;
    // Otherwise estimate from content length
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
 * Estimate cost for synthesis based on model and token usage
 */
function estimateCost(model: string, reasoningTokens: number, outputTokens: number): number {
  // Pricing per 1M tokens (as of 2025)
  // Note: These are estimates - actual pricing should be verified
  const pricing: Record<string, { reasoning: number; output: number }> = {
    'gpt-5': { reasoning: 1.0, output: 4.0 }, // Estimate
    'gpt-5-mini': { reasoning: 0.2, output: 0.8 }, // Estimate (5x cheaper)
  };

  const rates = pricing[model] || pricing['gpt-5'];
  const reasoningCost = (reasoningTokens / 1_000_000) * rates.reasoning;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return reasoningCost + outputCost;
}
