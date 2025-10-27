import { useState } from 'react'
import { useNode, useConnections, useUpdateNode } from '../queries/forest'
import { useKeyboard } from '../hooks/useKeyboard'
import { MonacoEditor } from './MonacoEditor'

interface Props {
  nodeId: string
  onClose: () => void
}

export function NodeDetailPanel({ nodeId, onClose }: Props) {
  const { data: node, isLoading } = useNode(nodeId)
  const { data: connections = [] } = useConnections(nodeId)
  const updateMutation = useUpdateNode()

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  // Centralized keyboard handling
  useKeyboard((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  async function handleSave() {
    if (!node) return
    await updateMutation.mutateAsync({ id: node.id, title: editTitle, body: editBody })
    setEditing(false)
  }

  function handleCancelEdit() {
    if (!node) return
    setEditTitle(node.title)
    setEditBody(node.body)
    setEditing(false)
  }

  if (isLoading || !node) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-slate-300">Loading...</p>
      </div>
    )
  }

  return (
    <div className="glass-panel fixed right-0 top-0 w-[700px] h-screen p-9 overflow-y-auto z-[1100] border-l animate-[slideIn_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-4">
        {editing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input flex-1 mr-2 text-xl font-bold px-3 py-2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-slate-50 m-0">{node.title}</h2>
        )}
        <button
          onClick={onClose}
          className="bg-slate-900/60 border border-slate-400/30 text-slate-300 text-xl cursor-pointer rounded-full w-8 h-8 grid place-items-center"
        >
          ×
        </button>
      </div>

      {node.tags.length > 0 && (
        <div className="mb-4">
          {node.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mb-4">
          <MonacoEditor
            value={editBody}
            onChange={setEditBody}
            language="markdown"
            height="500px"
          />
        </div>
      ) : (
        <div className="whitespace-pre-wrap leading-relaxed mb-8 text-slate-200/90">
          {node.body}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={updateMutation.isPending}
              className="btn-ghost disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              if (!node) return
              // Initialize edit state when entering edit mode (not in useEffect!)
              setEditTitle(node.title)
              setEditBody(node.body)
              setEditing(true)
            }}
            className="btn-primary"
          >
            Edit
          </button>
        )}
      </div>

      <div className="text-xs text-slate-400 mb-8">
        <p className="mb-1">Created: {new Date(node.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(node.updated_at).toLocaleString()}</p>
      </div>

      {connections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-100">Connected Notes ({connections.length})</h3>
          {connections.map((conn) => (
            <div
              key={conn.node_id}
              className="glass-panel rounded-xl p-3 mb-2"
            >
              <div className="flex justify-between items-center">
                <span className="text-slate-200">{conn.title}</span>
                <span className="text-xs text-slate-400">
                  {(conn.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
