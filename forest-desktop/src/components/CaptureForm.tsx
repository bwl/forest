import { useState } from 'react'
import { createNode, type NodeCreationResult } from '../lib/tauri-commands'

interface Props {
  onNodeCreated: (result: NodeCreationResult) => void
}

export function CaptureForm({ onNodeCreated }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [autoLink, setAutoLink] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    try {
      setLoading(true)
      setError(null)

      const tagArray = tags
        ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : undefined

      const result = await createNode(title, body, tagArray, autoLink)

      setTitle('')
      setBody('')
      setTags('')

      onNodeCreated(result)
    } catch (err) {
      console.error('Failed to create node:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Forest backend. Ensure the app is running via Tauri (not plain browser).'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#eee8d5] border border-[#93a1a1] p-6">
      <h2 className="text-2xl font-bold text-[#073642] mb-6">Create Note</h2>

      {error && (
        <div className="bg-[#dc322f] text-[#fdf6e3] p-4 mb-4 border border-[#b22222] rounded">
          <div className="font-semibold mb-1">Couldn’t create note</div>
          <div className="text-sm opacity-90">{error}</div>
          <div className="text-xs mt-2 opacity-80">
            Tip: launch via <code>bun run tauri dev</code> so the backend is available.
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-[#586e75]">
          Title
        </label>
        <input
          type="text"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-[#586e75]">
          Content
        </label>
        <textarea
          className="input resize-vertical min-h-[200px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your thoughts..."
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-[#586e75]">
          Tags (comma-separated, optional)
        </label>
        <input
          type="text"
          className="input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="rust, programming, ideas"
        />
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 cursor-pointer text-[#586e75]">
          <input
            type="checkbox"
            checked={autoLink}
            onChange={(e) => setAutoLink(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Auto-link to existing notes</span>
        </label>
      </div>

      <button
        type="submit"
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading || !title.trim() || !body.trim()}
      >
        {loading ? 'Creating...' : 'Create Note'}
      </button>
    </form>
  )
}
