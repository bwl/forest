/**
 * Markdown chunking utilities for importing large documents
 * Splits documents by headers while respecting token limits
 */

export type ChunkStrategy = 'headers' | 'size' | 'hybrid';

export type ChunkMetadata = {
  level: number;           // Header level (0 = root, 1 = h1, 2 = h2, etc.)
  headingText: string;     // The heading text if this chunk starts with a header
  chunkIndex: number;      // Sequential index within document
  totalChunks: number;     // Total number of chunks in document
  estimatedTokens: number; // Rough token estimate
};

export type DocumentChunk = {
  title: string;           // Derived from heading or generated
  body: string;            // The chunk content
  metadata: ChunkMetadata;
};

export type ChunkingOptions = {
  strategy: ChunkStrategy;
  maxTokens: number;       // Target max tokens per chunk
  overlap: number;         // Character overlap between chunks (for 'size' strategy)
};

// Rough estimation: 1 token ≈ 4 characters for English text
const CHARS_PER_TOKEN = 4;

/**
 * Extract heading text from a markdown header line
 */
function parseHeader(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

/**
 * Estimate token count for text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text by headers, respecting maxTokens
 */
function chunkByHeaders(text: string, maxTokens: number): DocumentChunk[] {
  const lines = text.split('\n');
  const chunks: DocumentChunk[] = [];

  let currentChunk: string[] = [];
  let currentLevel = 0;
  let currentHeading = '';
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = parseHeader(line);

    // If we hit a header
    if (header) {
      // Save previous chunk if it exists
      if (currentChunk.length > 0) {
        const body = currentChunk.join('\n').trim();
        if (body.length > 0) {
          chunks.push({
            title: currentHeading || `Chunk ${chunkIndex + 1}`,
            body,
            metadata: {
              level: currentLevel,
              headingText: currentHeading,
              chunkIndex,
              totalChunks: 0, // Will update after
              estimatedTokens: estimateTokens(body),
            },
          });
          chunkIndex++;
        }
      }

      // Start new chunk
      currentChunk = [line];
      currentLevel = header.level;
      currentHeading = header.text;
    } else {
      // Add line to current chunk
      currentChunk.push(line);

      // Check if chunk is getting too large
      const currentText = currentChunk.join('\n');
      if (estimateTokens(currentText) > maxTokens) {
        // Split at this point if we have content
        if (currentChunk.length > 1) {
          // Save all but the last line
          const body = currentChunk.slice(0, -1).join('\n').trim();
          if (body.length > 0) {
            chunks.push({
              title: currentHeading || `Chunk ${chunkIndex + 1}`,
              body,
              metadata: {
                level: currentLevel,
                headingText: currentHeading,
                chunkIndex,
                totalChunks: 0,
                estimatedTokens: estimateTokens(body),
              },
            });
            chunkIndex++;
          }

          // Start new chunk with last line
          currentChunk = [lines[i]];
          currentHeading = `${currentHeading} (cont.)`;
        }
      }
    }
  }

  // Save final chunk
  if (currentChunk.length > 0) {
    const body = currentChunk.join('\n').trim();
    if (body.length > 0) {
      chunks.push({
        title: currentHeading || `Chunk ${chunkIndex + 1}`,
        body,
        metadata: {
          level: currentLevel,
          headingText: currentHeading,
          chunkIndex,
          totalChunks: 0,
          estimatedTokens: estimateTokens(body),
        },
      });
    }
  }

  // Update totalChunks
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = totalChunks;
  });

  return mergeSmallChunks(chunks, maxTokens);
}

/**
 * Merge undersized chunks into their predecessor to reduce graph noise.
 * Chunks below minTokens are folded into the previous chunk as long as
 * the combined size stays within maxTokens.
 */
function mergeSmallChunks(chunks: DocumentChunk[], maxTokens: number): DocumentChunk[] {
  const minTokens = Math.max(Math.floor(maxTokens / 4), 50);
  const merged: DocumentChunk[] = [];

  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && chunk.metadata.estimatedTokens < minTokens) {
      const combinedTokens = prev.metadata.estimatedTokens + chunk.metadata.estimatedTokens;
      if (combinedTokens <= maxTokens) {
        prev.body = prev.body + '\n\n' + chunk.body;
        prev.metadata.estimatedTokens = combinedTokens;
        continue;
      }
    }
    merged.push({ ...chunk });
  }

  // Reindex
  merged.forEach((c, i) => {
    c.metadata.chunkIndex = i;
    c.metadata.totalChunks = merged.length;
  });
  return merged;
}

/**
 * Split text by size with overlap
 */
function chunkBySize(text: string, maxTokens: number, overlap: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    let chunkText = text.substring(start, end);

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const lastNewline = chunkText.lastIndexOf('\n\n');
      const lastPeriod = chunkText.lastIndexOf('. ');
      const breakPoint = lastNewline > maxChars * 0.7
        ? lastNewline
        : lastPeriod > maxChars * 0.7
          ? lastPeriod + 1
          : chunkText.length;

      chunkText = chunkText.substring(0, breakPoint).trim();
    }

    if (chunkText.length > 0) {
      chunks.push({
        title: `Chunk ${chunkIndex + 1}`,
        body: chunkText,
        metadata: {
          level: 0,
          headingText: '',
          chunkIndex,
          totalChunks: 0,
          estimatedTokens: estimateTokens(chunkText),
        },
      });
      chunkIndex++;
    }

    // Move start forward, accounting for overlap
    start = end - overlap;
    if (start >= text.length) break;
  }

  // Update totalChunks
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = totalChunks;
  });

  return chunks;
}

/**
 * Main chunking function
 */
export function chunkDocument(
  text: string,
  options: ChunkingOptions
): DocumentChunk[] {
  const { strategy, maxTokens, overlap } = options;

  if (strategy === 'headers' || strategy === 'hybrid') {
    const chunks = chunkByHeaders(text, maxTokens);

    // For hybrid mode, further split any chunks that are still too large
    if (strategy === 'hybrid') {
      const finalChunks: DocumentChunk[] = [];
      for (const chunk of chunks) {
        if (chunk.metadata.estimatedTokens > maxTokens) {
          // Split this chunk by size
          const subChunks = chunkBySize(chunk.body, maxTokens, overlap);
          subChunks.forEach((subChunk, i) => {
            finalChunks.push({
              title: `${chunk.title} (part ${i + 1})`,
              body: subChunk.body,
              metadata: {
                ...chunk.metadata,
                chunkIndex: finalChunks.length,
                estimatedTokens: subChunk.metadata.estimatedTokens,
              },
            });
          });
        } else {
          finalChunks.push(chunk);
        }
      }

      // Update totalChunks and indices
      finalChunks.forEach((chunk, i) => {
        chunk.metadata.chunkIndex = i;
        chunk.metadata.totalChunks = finalChunks.length;
      });

      return finalChunks;
    }

    return chunks;
  }

  // Size-based chunking
  return chunkBySize(text, maxTokens, overlap);
}

/**
 * Extract document title from content
 * Looks for first h1, or uses first line, or generates generic title
 */
export function extractDocumentTitle(text: string): string {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = parseHeader(trimmed);
    if (header && header.level === 1) {
      return header.text;
    }

    // First non-empty line
    if (trimmed.length > 0 && trimmed.length < 100) {
      return trimmed.replace(/^#+\s+/, '').trim();
    }
  }

  return 'Imported Document';
}
