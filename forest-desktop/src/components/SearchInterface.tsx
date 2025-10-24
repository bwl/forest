import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface SearchResult {
  id: string
  title: string
  body: string
  tags: string[]
  similarity: number
}

export function SearchInterface() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    if (!query.trim()) return

    try {
      setLoading(true)
      setError(null)
      const searchResults = await invoke<SearchResult[]>('search_nodes', {
        query,
        limit: 20,
      })
      setResults(searchResults)
    } catch (err) {
      console.error('Search failed:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          type="text"
          className="forest-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your knowledge base..."
        />
        <button
          className="forest-button"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="forest-card" style={{ borderColor: '#d00', color: '#d00' }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <div key={result.id} className="forest-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{result.title}</h3>
                <span style={{ fontSize: '0.875rem', color: '#666', fontFamily: 'monospace' }}>
                  {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <p style={{ color: '#444', marginBottom: '1rem' }}>
                {result.body.length > 200
                  ? result.body.substring(0, 200) + '...'
                  : result.body}
              </p>

              {result.tags.length > 0 && (
                <div>
                  {result.tags.map((tag) => (
                    <span key={tag} className="forest-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && !error && query && (
        <div className="forest-card" style={{ textAlign: 'center', color: '#888' }}>
          <p>No results found for "{query}"</p>
          <p style={{ fontSize: '0.875rem' }}>
            Try a different search term or capture some notes first
          </p>
        </div>
      )}
    </div>
  )
}
