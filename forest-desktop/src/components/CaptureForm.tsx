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

      // Reset form
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
    <form onSubmit={handleSubmit} className="forest-card">
      <h2>Create Note</h2>

      {error && (
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fee', color: '#d00', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Title
        </label>
        <input
          type="text"
          className="forest-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          required
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Content
        </label>
        <textarea
          className="forest-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your thoughts..."
          rows={8}
          required
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          Tags (comma-separated, optional)
        </label>
        <input
          type="text"
          className="forest-input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="rust, programming, ideas"
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoLink}
            onChange={(e) => setAutoLink(e.target.checked)}
          />
          <span>Auto-link to existing notes</span>
        </label>
      </div>

      <button
        type="submit"
        className="forest-button"
        disabled={loading || !title.trim() || !body.trim()}
      >
        {loading ? 'Creating...' : 'Create Note'}
      </button>
    </form>
  )
}
