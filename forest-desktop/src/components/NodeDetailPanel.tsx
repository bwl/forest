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
      <div className="bg-[#eee8d5] border border-[#93a1a1] p-6">
        <p className="text-[#586e75]">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-[#eee8d5] border-l border-[#93a1a1] fixed right-0 top-0 w-[700px] h-screen p-9 overflow-y-auto z-[1100]">
      <div className="flex justify-between items-center mb-4">
        {editing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input flex-1 mr-2 text-xl font-bold px-3 py-2"
          />
        ) : (
          <h2 className="text-2xl font-bold text-[#073642] m-0">{node.title}</h2>
        )}
        <button
          onClick={onClose}
          className="bg-[#eee8d5] border border-[#93a1a1] text-[#586e75] text-xl cursor-pointer w-8 h-8 grid place-items-center hover:bg-[#dc322f] hover:text-[#fdf6e3]"
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
        <div className="whitespace-pre-wrap leading-relaxed mb-8 text-[#586e75]">
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

      <div className="text-xs text-[#93a1a1] mb-8">
        <p className="mb-1">Created: {new Date(node.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(node.updated_at).toLocaleString()}</p>
      </div>

      {connections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-[#073642]">Connected Notes ({connections.length})</h3>
          {connections.map((conn) => (
            <div
              key={conn.node_id}
              className="bg-[#fdf6e3] border border-[#93a1a1] p-3 mb-2"
            >
              <div className="flex justify-between items-center">
                <span className="text-[#586e75]">{conn.title}</span>
                <span className="text-xs text-[#93a1a1]">
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
