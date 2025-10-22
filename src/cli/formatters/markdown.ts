import { Marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

export type MarkdownRenderOptions = {
  width?: number;
  reflowText?: boolean;
};

let cachedOptionsKey: string | undefined;
let cachedMarked: Marked | undefined;

function getRenderer(options: MarkdownRenderOptions = {}): Marked {
  const resolvedWidth =
    typeof options.width === 'number'
      ? options.width
      : typeof process.stdout?.columns === 'number'
      ? process.stdout.columns
      : undefined;
  const resolvedReflow = options.reflowText ?? false;

  const optionsKey = JSON.stringify({
    width: resolvedWidth ?? null,
    reflowText: resolvedReflow,
  });

  if (!cachedMarked || cachedOptionsKey !== optionsKey) {
    const renderer = new TerminalRenderer({
      reflowText: resolvedReflow,
      showSectionPrefix: false,
      width: resolvedWidth,
    }) as unknown as any;

    const marked = new Marked();
    marked.setOptions({
      gfm: true,
      breaks: true,
      renderer,
    });

    cachedMarked = marked;
    cachedOptionsKey = optionsKey;
  }

  return cachedMarked;
}

export function renderMarkdownToTerminal(markdown: string, options: MarkdownRenderOptions = {}): string {
  if (!markdown) return '';
  const renderer = getRenderer(options);
  return renderer.parse(markdown) as string;
}
