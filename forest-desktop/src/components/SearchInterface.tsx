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
        <div className="bg-[#eee8d5] border border-[#dc322f] p-4 text-[#dc322f]">
          {String(searchMutation.error)}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.id} className="bg-[#eee8d5] border border-[#93a1a1] p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-[#073642] m-0">{result.title}</h3>
                <span className="text-xs text-[#93a1a1] font-mono">
                  {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <p className="text-[#586e75] mb-3">
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
        <div className="bg-[#eee8d5] border border-[#93a1a1] p-8 text-center">
          <p className="text-[#93a1a1] mb-2">No results found for "{query}"</p>
          <p className="text-xs text-[#93a1a1]">
            Try a different search term or capture some notes first
          </p>
        </div>
      )}
    </div>
  )
}
