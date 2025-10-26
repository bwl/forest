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
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-slate-50 mb-6">Create Note</h2>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-slate-200">
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
        <label className="block mb-2 font-semibold text-slate-200">
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
        <label className="block mb-2 font-semibold text-slate-200">
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
        <label className="flex items-center gap-2 cursor-pointer text-slate-200">
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
