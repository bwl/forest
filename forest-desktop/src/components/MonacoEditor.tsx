import { useRef, useEffect } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useTheme } from '../store/theme'
import { registerSolarizedThemes } from '../lib/monaco-themes'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
  readOnly?: boolean
  minimap?: boolean
}

export function MonacoEditor({
  value,
  onChange,
  language = 'markdown',
  height = '400px',
  readOnly = false,
  minimap = false,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const effectiveTheme = useTheme((s) => s.effectiveTheme)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Register our custom Solarized themes
    registerSolarizedThemes(monaco)

    // Set initial theme
    const themeName = effectiveTheme === 'dark' ? 'solarizedDark' : 'solarizedLight'
    monaco.editor.setTheme(themeName)

    // Focus the editor when it mounts
    editor.focus()
  }

  const handleChange = (value: string | undefined) => {
    onChange(value || '')
  }

  useEffect(() => {
    // Ensure editor updates when value changes externally
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== value) {
        editorRef.current.setValue(value)
      }
    }
  }, [value])

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current) {
      const themeName = effectiveTheme === 'dark' ? 'solarizedDark' : 'solarizedLight'
      // Access Monaco instance through the editor
      const monaco = (editorRef.current as any)._themeService?._theme?.themeName
        ? (window as any).monaco
        : null
      if (monaco) {
        monaco.editor.setTheme(themeName)
      }
    }
  }, [effectiveTheme])

  const themeName = effectiveTheme === 'dark' ? 'solarizedDark' : 'solarizedLight'

  return (
    <div className="monaco-editor-wrapper rounded-lg overflow-hidden border border-slate-600/50">
      <Editor
        height={height}
        defaultLanguage={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={themeName}
        options={{
          minimap: { enabled: minimap },
          fontSize: 14,
          lineHeight: 24,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          readOnly,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          folding: true,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          selectOnLineNumbers: true,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          bracketPairColorization: { enabled: true },
          suggest: {
            snippetsPreventQuickSuggestions: false,
          },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
          },
        }}
      />
    </div>
  )
}
