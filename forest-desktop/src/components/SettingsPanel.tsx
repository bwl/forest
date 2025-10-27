import { useState } from 'react'
import { useStats } from '../queries/forest'
import { invoke } from '@tauri-apps/api/core'
import { useKeyboard } from '../hooks/useKeyboard'

interface CliInstallInfo {
  cli_path: string
  bin_dir: string
  instructions: string
}

interface Props {
  onClose: () => void
}

type Tab = 'general' | 'cli' | 'graph' | 'database'

export function SettingsPanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const { data: stats } = useStats()

  // CLI Tools state
  const [cliInfo, setCliInfo] = useState<CliInstallInfo | null>(null)
  const [cliLoading, setCliLoading] = useState(false)
  const [selectedShell, setSelectedShell] = useState<'zsh' | 'bash' | 'fish'>('zsh')
  const [cliInstallResult, setCliInstallResult] = useState<string>('')
  const [installingCli, setInstallingCli] = useState(false)

  // Close on Escape
  useKeyboard((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  // Load CLI info when CLI tab is opened
  const loadCliInfo = async () => {
    if (cliInfo) return // Already loaded
    try {
      setCliLoading(true)
      const info = await invoke<CliInstallInfo>('get_cli_install_info')
      setCliInfo(info)
    } catch (error) {
      console.error('Failed to load CLI info:', error)
    } finally {
      setCliLoading(false)
    }
  }

  const handleAutoInstallCli = async () => {
    try {
      setInstallingCli(true)
      setCliInstallResult('')
      const message = await invoke<string>('auto_install_cli_path', { shell: selectedShell })
      setCliInstallResult(message)
    } catch (error) {
      setCliInstallResult(`Error: ${error}`)
    } finally {
      setInstallingCli(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'cli') {
      loadCliInfo()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="glass-panel rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-50">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="w-48 border-r border-slate-700/50 p-4 space-y-1">
            <button
              onClick={() => handleTabChange('general')}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                activeTab === 'general'
                  ? 'bg-blue-600/30 text-blue-100 border border-blue-400/50'
                  : 'text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              General
            </button>
            <button
              onClick={() => handleTabChange('cli')}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                activeTab === 'cli'
                  ? 'bg-blue-600/30 text-blue-100 border border-blue-400/50'
                  : 'text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              CLI Tools
            </button>
            <button
              onClick={() => handleTabChange('graph')}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                activeTab === 'graph'
                  ? 'bg-blue-600/30 text-blue-100 border border-blue-400/50'
                  : 'text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => handleTabChange('database')}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                activeTab === 'database'
                  ? 'bg-blue-600/30 text-blue-100 border border-blue-400/50'
                  : 'text-slate-300 hover:bg-slate-700/30'
              }`}
            >
              Database
            </button>
          </nav>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-50 mb-4">About Forest</h3>
                  <div className="space-y-3 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Version:</span>
                      <span className="font-mono">0.4.4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Database:</span>
                      <span className="font-mono text-sm">SQLite</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Embeddings:</span>
                      <span className="font-mono text-sm">all-MiniLM-L6-v2 (384d)</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700/50 pt-6">
                  <h3 className="text-lg font-semibold text-slate-50 mb-3">Keyboard Shortcuts</h3>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex justify-between">
                      <span>Open command palette:</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">⌘K</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Close panel/dialog:</span>
                      <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cli' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-50 mb-4">CLI Tools</h3>

                {cliLoading ? (
                  <div className="text-slate-400">Loading CLI information...</div>
                ) : cliInfo ? (
                  <>
                    {/* Auto Install Section */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-medium text-slate-100 mb-2">Quick Install</h4>
                        <p className="text-slate-400 text-sm mb-4">
                          Automatically add the Forest CLI to your shell's PATH:
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={selectedShell}
                          onChange={(e) => setSelectedShell(e.target.value as any)}
                          className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 focus:border-blue-500 outline-none"
                          disabled={installingCli}
                        >
                          <option value="zsh">Zsh (~/.zshrc)</option>
                          <option value="bash">Bash (~/.bashrc)</option>
                          <option value="fish">Fish (config.fish)</option>
                        </select>

                        <button
                          onClick={handleAutoInstallCli}
                          disabled={installingCli}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded transition-colors"
                        >
                          {installingCli ? 'Installing...' : 'Auto Install'}
                        </button>
                      </div>

                      {cliInstallResult && (
                        <div
                          className={`p-3 rounded text-sm font-mono ${
                            cliInstallResult.startsWith('✓') || cliInstallResult.includes('already')
                              ? 'bg-green-900/30 text-green-300 border border-green-700'
                              : 'bg-red-900/30 text-red-300 border border-red-700'
                          }`}
                        >
                          {cliInstallResult}
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-700/50" />

                    {/* Manual Instructions */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-medium text-slate-100 mb-2">Manual Installation</h4>
                        <p className="text-slate-400 text-sm mb-4">
                          Copy and paste the appropriate command into your shell configuration file:
                        </p>
                      </div>

                      <div className="bg-slate-800 rounded p-4 relative group">
                        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                          {cliInfo.instructions}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(cliInfo.instructions)}
                          className="absolute top-2 right-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Copy
                        </button>
                      </div>

                      {/* CLI Path Info */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm text-slate-400 mb-2">
                            <strong>CLI Binary Location:</strong>
                          </div>
                          <div className="bg-slate-800 rounded p-3 flex items-center justify-between group">
                            <code className="text-sm text-slate-300 font-mono">{cliInfo.cli_path}</code>
                            <button
                              onClick={() => copyToClipboard(cliInfo.cli_path)}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-slate-400 mb-2">
                            <strong>Binary Directory:</strong>
                          </div>
                          <div className="bg-slate-800 rounded p-3 flex items-center justify-between group">
                            <code className="text-sm text-slate-300 font-mono">{cliInfo.bin_dir}</code>
                            <button
                              onClick={() => copyToClipboard(cliInfo.bin_dir)}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-red-400">Failed to load CLI information</div>
                )}
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-50 mb-4">Graph Statistics</h3>

                {stats ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-panel rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-blue-400 mb-1">{stats.nodes}</div>
                      <div className="text-sm text-slate-400">Total Nodes</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-green-400 mb-1">{stats.edges}</div>
                      <div className="text-sm text-slate-400">Accepted Edges</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.suggested}</div>
                      <div className="text-sm text-slate-400">Pending Suggestions</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400">Loading statistics...</div>
                )}

                <div className="border-t border-slate-700/50 pt-6">
                  <h4 className="text-lg font-medium text-slate-100 mb-3">Graph Health</h4>
                  <p className="text-slate-400 text-sm">
                    Your knowledge graph is growing! Keep capturing ideas and reviewing edge proposals
                    to strengthen connections.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-50 mb-4">Database</h3>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">
                      <strong>Database Location:</strong>
                    </div>
                    <div className="bg-slate-800 rounded p-3">
                      <code className="text-sm text-slate-300 font-mono break-all">
                        ~/Library/Application Support/com.ettio.forest.desktop/forest.db
                      </code>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Override with FOREST_DB_PATH environment variable
                    </p>
                  </div>

                  <div className="border-t border-slate-700/50 pt-4">
                    <h4 className="text-lg font-medium text-slate-100 mb-3">Database Actions</h4>
                    <div className="space-y-2">
                      <button
                        className="btn bg-slate-700 hover:bg-slate-600 text-slate-200 w-full text-left"
                        onClick={() => {
                          // Future: Open database location in Finder
                          alert('Open in Finder - Coming soon!')
                        }}
                      >
                        📂 Open Database Location
                      </button>
                      <button
                        className="btn bg-slate-700 hover:bg-slate-600 text-slate-200 w-full text-left"
                        onClick={() => {
                          // Future: Backup database
                          alert('Backup Database - Coming soon!')
                        }}
                      >
                        💾 Backup Database
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
