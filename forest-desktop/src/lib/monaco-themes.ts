import type { editor } from 'monaco-editor'

/**
 * Solarized Light theme for Monaco Editor
 * Based on the official Solarized color palette
 */
export const solarizedLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '586e75', background: 'fdf6e3' },
    { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
    { token: 'keyword', foreground: '859900' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'regexp', foreground: 'dc322f' },
    { token: 'type', foreground: 'b58900' },
    { token: 'class', foreground: 'b58900' },
    { token: 'function', foreground: '268bd2' },
    { token: 'variable', foreground: '268bd2' },
    { token: 'constant', foreground: 'cb4b16' },
    { token: 'operator', foreground: '859900' },
    { token: 'delimiter', foreground: '586e75' },
  ],
  colors: {
    'editor.background': '#fdf6e3',
    'editor.foreground': '#586e75',
    'editor.lineHighlightBackground': '#eee8d5',
    'editor.selectionBackground': '#93a1a180',
    'editor.inactiveSelectionBackground': '#eee8d5',
    'editor.selectionHighlightBackground': '#93a1a140',
    'editor.wordHighlightBackground': '#93a1a140',
    'editor.wordHighlightStrongBackground': '#93a1a160',
    'editor.findMatchBackground': '#b5890080',
    'editor.findMatchHighlightBackground': '#b5890040',
    'editor.lineHighlightBorder': '#93a1a1',
    'editorCursor.foreground': '#586e75',
    'editorWhitespace.foreground': '#93a1a140',
    'editorIndentGuide.background': '#93a1a140',
    'editorIndentGuide.activeBackground': '#93a1a1',
    'editorLineNumber.foreground': '#93a1a1',
    'editorLineNumber.activeForeground': '#586e75',
    'editorBracketMatch.background': '#93a1a140',
    'editorBracketMatch.border': '#93a1a1',
    'editorGutter.background': '#eee8d5',
    'editorWidget.background': '#eee8d5',
    'editorWidget.border': '#93a1a1',
    'editorSuggestWidget.background': '#eee8d5',
    'editorSuggestWidget.border': '#93a1a1',
    'editorSuggestWidget.foreground': '#586e75',
    'editorSuggestWidget.selectedBackground': '#93a1a140',
    'editorHoverWidget.background': '#eee8d5',
    'editorHoverWidget.border': '#93a1a1',
    'scrollbarSlider.background': '#93a1a140',
    'scrollbarSlider.hoverBackground': '#93a1a160',
    'scrollbarSlider.activeBackground': '#93a1a180',
  },
}

/**
 * Solarized Dark theme for Monaco Editor
 * Based on the official Solarized color palette
 */
export const solarizedDark: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: '839496', background: '002b36' },
    { token: 'comment', foreground: '586e75', fontStyle: 'italic' },
    { token: 'keyword', foreground: '859900' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'regexp', foreground: 'dc322f' },
    { token: 'type', foreground: 'b58900' },
    { token: 'class', foreground: 'b58900' },
    { token: 'function', foreground: '268bd2' },
    { token: 'variable', foreground: '268bd2' },
    { token: 'constant', foreground: 'cb4b16' },
    { token: 'operator', foreground: '859900' },
    { token: 'delimiter', foreground: '839496' },
  ],
  colors: {
    'editor.background': '#002b36',
    'editor.foreground': '#839496',
    'editor.lineHighlightBackground': '#073642',
    'editor.selectionBackground': '#586e7580',
    'editor.inactiveSelectionBackground': '#073642',
    'editor.selectionHighlightBackground': '#586e7540',
    'editor.wordHighlightBackground': '#586e7540',
    'editor.wordHighlightStrongBackground': '#586e7560',
    'editor.findMatchBackground': '#b5890080',
    'editor.findMatchHighlightBackground': '#b5890040',
    'editor.lineHighlightBorder': '#586e75',
    'editorCursor.foreground': '#839496',
    'editorWhitespace.foreground': '#586e7540',
    'editorIndentGuide.background': '#586e7540',
    'editorIndentGuide.activeBackground': '#586e75',
    'editorLineNumber.foreground': '#586e75',
    'editorLineNumber.activeForeground': '#839496',
    'editorBracketMatch.background': '#586e7540',
    'editorBracketMatch.border': '#586e75',
    'editorGutter.background': '#073642',
    'editorWidget.background': '#073642',
    'editorWidget.border': '#586e75',
    'editorSuggestWidget.background': '#073642',
    'editorSuggestWidget.border': '#586e75',
    'editorSuggestWidget.foreground': '#839496',
    'editorSuggestWidget.selectedBackground': '#586e7540',
    'editorHoverWidget.background': '#073642',
    'editorHoverWidget.border': '#586e75',
    'scrollbarSlider.background': '#586e7540',
    'scrollbarSlider.hoverBackground': '#586e7560',
    'scrollbarSlider.activeBackground': '#586e7580',
  },
}

/**
 * Register Solarized themes with Monaco Editor
 * Call this once when Monaco editor mounts
 */
export function registerSolarizedThemes(monaco: typeof import('monaco-editor')) {
  monaco.editor.defineTheme('solarizedLight', solarizedLight)
  monaco.editor.defineTheme('solarizedDark', solarizedDark)
}
