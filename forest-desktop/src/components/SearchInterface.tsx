import { useState } from 'react'
import { useSearchNodes } from '../queries/forest'

export function SearchInterface() {
  const [query, setQuery] = useState('')
  const searchMutation = useSearchNodes()

  async function handleSearch() {
    if (!query.trim()) return
    searchMutation.mutate({ query, limit: 20 })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const results = searchMutation.data ?? []

  return (
    <div>
      <div className="flex gap-4 mb-8">
        <input
          type="text"
          className="input flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your knowledge base..."
        />
        <button
          className="btn-primary"
          onClick={handleSearch}
          disabled={searchMutation.isPending}
        >
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchMutation.isError && (
        <div className="glass-panel rounded-xl p-4 border-red-400 text-red-400">
          {String(searchMutation.error)}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.id} className="glass-panel rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-slate-50 m-0">{result.title}</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <p className="text-slate-300 mb-3">
                {result.body.length > 200
                  ? result.body.substring(0, 200) + '...'
                  : result.body}
              </p>

              {result.tags.length > 0 && (
                <div>
                  {result.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !searchMutation.isPending && !searchMutation.isError && query && (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-slate-400 mb-2">No results found for "{query}"</p>
          <p className="text-xs text-slate-500">
            Try a different search term or capture some notes first
          </p>
        </div>
      )}
    </div>
  )
}
