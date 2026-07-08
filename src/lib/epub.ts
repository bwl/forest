/**
 * EPUB extraction utilities
 * Converts EPUB files to markdown for import into Forest
 *
 * EPUBs are ZIP archives containing XHTML chapters + metadata.
 * We parse the OPF spine for reading order, TOC for chapter titles,
 * strip XHTML to plain text, and emit markdown with # headers.
 */

import { spawnSync } from 'child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

export type EpubResult = {
  title: string;
  author: string;
  markdown: string;
  chapterCount: number;
};

/**
 * Extract an EPUB file to a markdown string suitable for Forest import.
 * Uses `unzip` CLI (available on macOS + Linux) for extraction.
 */
export function extractEpubToMarkdown(epubPath: string): EpubResult {
  const absPath = path.resolve(epubPath);
  if (!existsSync(absPath)) {
    throw new Error(`EPUB file not found: ${absPath}`);
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'forest-epub-'));
  try {
    const result = spawnSync('unzip', ['-o', '-q', absPath, '-d', tmpDir], {
      encoding: 'utf-8',
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
      throw new Error(`Failed to extract EPUB: ${detail}`);
    }
    return parseEpubDirectory(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// --- Internal ---

/** Items to skip from the spine (boilerplate, not narrative content) */
const SKIP_IDREFS = new Set([
  'cover.xhtml',
  'titlepage.xhtml',
  'public-domain.xhtml',
  'halftitlepage.xhtml',
  'donate.xhtml',
  'acknowledgments.xhtml',
  'endnotes.xhtml',
]);

function parseEpubDirectory(dir: string): EpubResult {
  // Locate content.opf via META-INF/container.xml
  const containerPath = path.join(dir, 'META-INF', 'container.xml');
  const containerXml = readFileSync(containerPath, 'utf-8');
  const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
  const opfRelPath = rootfileMatch?.[1] ?? 'content.opf';
  const opfPath = path.join(dir, opfRelPath);
  const opfDir = path.dirname(opfPath);

  const opf = readFileSync(opfPath, 'utf-8');

  // Metadata
  const title = extractXmlText(opf, 'dc:title') ?? 'Untitled';
  const author = extractXmlText(opf, 'dc:creator') ?? 'Unknown';

  // Manifest: id → href (attributes may appear in any order)
  const manifest = new Map<string, string>();
  const itemRe = /<item\s([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opf)) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/id="([^"]+)"/);
    const hrefMatch = attrs.match(/href="([^"]+)"/);
    if (idMatch && hrefMatch) {
      manifest.set(idMatch[1], hrefMatch[1]);
    }
  }

  // Spine: reading order
  const spineIdrefs: string[] = [];
  const spineRe = /<itemref\s[^>]*?idref="([^"]+)"[^>]*?\/?>/g;
  while ((m = spineRe.exec(opf)) !== null) {
    spineIdrefs.push(m[1]);
  }

  // TOC: href → display title
  const tocTitles = parseTocTitles(opfDir, manifest);

  // Build markdown from spine items, skipping boilerplate
  const sections: string[] = [];

  for (const idref of spineIdrefs) {
    if (SKIP_IDREFS.has(idref)) continue;

    const href = manifest.get(idref);
    if (!href) continue;

    const filePath = path.join(opfDir, href);
    if (!existsSync(filePath)) continue;

    const xhtml = readFileSync(filePath, 'utf-8');
    const text = xhtmlToText(xhtml);
    if (text.trim().length < 20) continue; // skip near-empty files

    // Look up title from TOC (try both href and bare filename)
    const chapterTitle =
      tocTitles.get(href) ??
      tocTitles.get(path.basename(href)) ??
      `Section ${sections.length + 1}`;

    sections.push(`# ${chapterTitle}\n\n${text.trim()}`);
  }

  return {
    title,
    author,
    markdown: sections.join('\n\n'),
    chapterCount: sections.length,
  };
}

/**
 * Parse toc.xhtml (EPUB3 nav) for chapter titles.
 * Returns a map of href → display title.
 */
function parseTocTitles(
  opfDir: string,
  manifest: Map<string, string>,
): Map<string, string> {
  const titles = new Map<string, string>();

  // Find toc.xhtml in manifest (has properties="nav" or id contains "toc")
  let tocHref: string | undefined;
  for (const [id, href] of manifest) {
    if (id === 'toc.xhtml' || href.endsWith('toc.xhtml')) {
      tocHref = href;
      break;
    }
  }

  if (!tocHref) return titles;

  const tocPath = path.join(opfDir, tocHref);
  if (!existsSync(tocPath)) return titles;

  const toc = readFileSync(tocPath, 'utf-8');

  // Only parse the main TOC nav, not the landmarks nav
  const tocNavMatch = toc.match(/<nav[^>]*id="toc"[^>]*>([\s\S]*?)<\/nav>/i);
  const tocContent = tocNavMatch?.[1] ?? toc;

  // Match <a href="...">title text</a> entries
  // The title may contain nested tags like <span>I</span>: Title
  const linkRe = /<a\s[^>]*href="([^"#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(tocContent)) !== null) {
    const href = m[1];
    const rawTitle = decodeEntities(stripTags(m[2]).replace(/\s+/g, ' ').trim());
    if (rawTitle.length > 0) {
      titles.set(href, rawTitle);
      titles.set(path.basename(href), rawTitle);
    }
  }

  return titles;
}

/**
 * Convert XHTML to plain text, preserving paragraph structure.
 */
function xhtmlToText(html: string): string {
  // Extract just the <body> content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch?.[1] ?? html;

  return (
    content
      // Block-level elements → double newline
      .replace(/<\/(p|div|blockquote|li|h[1-6]|section|article)>/gi, '\n\n')
      // Line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Horizontal rules
      .replace(/<hr\s*\/?>/gi, '\n---\n')
      // Strip remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n /g, '\n')
      .replace(/ \n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/** Strip HTML/XML tags from a string */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** Decode HTML/XML numeric and named entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Extract text content from an XML element by tag name */
function extractXmlText(xml: string, tagName: string): string | undefined {
  // Handle both <dc:title>text</dc:title> and namespaced variants
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([^<]+)</${escaped}>`, 'i');
  const match = xml.match(re);
  return match?.[1]?.trim();
}
