import { useState } from 'react';
import { ForestAPI, SearchResult } from './lib/forest-api';
import { Dashboard } from './components/Dashboard';

// Initialize API client (default to localhost)
const api = new ForestAPI('http://localhost:3000');

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const searchResults = await api.search(query);
      setResults(searchResults);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Make sure Forest server is running on localhost:3000');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          🌲 Forest Desktop
        </h1>

        {/* Dashboard Stats */}
        <Dashboard />

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your knowledge base..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results.map((result) => (
            <div
              key={result.node.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {result.node.title}
                </h2>
                <span className="text-sm text-gray-500 font-mono">
                  {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <p className="text-gray-700 mb-4 line-clamp-3">
                {result.node.body}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {result.node.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                {new Date(result.node.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && !error && (
          <div className="text-center text-gray-500 mt-12">
            <p>Search your Forest knowledge base</p>
            <p className="text-sm mt-2">
              Make sure Forest server is running: <code className="bg-gray-200 px-2 py-1 rounded">forest serve</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
