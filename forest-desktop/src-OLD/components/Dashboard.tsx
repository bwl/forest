import { useEffect, useState } from 'react';
import { ForestAPI, Stats } from '../lib/forest-api';

const api = new ForestAPI('http://localhost:3000');

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((err) => {
        console.error('Failed to load stats:', err);
        setError('Failed to load stats');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">Loading stats...</div>;
  }

  if (error || !stats) {
    return <div className="text-center text-red-500">{error || 'No stats available'}</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-green-600">
          {stats.nodes.total}
        </div>
        <div className="text-gray-600 text-sm">Total Nodes</div>
        <div className="text-xs text-gray-400 mt-1">
          {stats.nodes.withEmbeddings} with embeddings
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-blue-600">
          {stats.edges.accepted}
        </div>
        <div className="text-gray-600 text-sm">Connections</div>
        <div className="text-xs text-gray-400 mt-1">
          {stats.edges.suggested} suggested
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-purple-600">
          {stats.tags.total}
        </div>
        <div className="text-gray-600 text-sm">Tags</div>
      </div>
    </div>
  );
}
