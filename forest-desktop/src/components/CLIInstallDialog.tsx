import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CliInstallInfo {
  cli_path: string;
  bin_dir: string;
  instructions: string;
}

interface CLIInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CLIInstallDialog({ isOpen, onClose }: CLIInstallDialogProps) {
  const [info, setInfo] = useState<CliInstallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<string>('');
  const [selectedShell, setSelectedShell] = useState<'zsh' | 'bash' | 'fish'>('zsh');

  useEffect(() => {
    if (isOpen) {
      loadInstallInfo();
    }
  }, [isOpen]);

  const loadInstallInfo = async () => {
    try {
      setLoading(true);
      const installInfo = await invoke<CliInstallInfo>('get_cli_install_info');
      setInfo(installInfo);
    } catch (error) {
      console.error('Failed to load CLI install info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoInstall = async () => {
    try {
      setInstalling(true);
      setResult('');
      const message = await invoke<string>('auto_install_cli_path', { shell: selectedShell });
      setResult(message);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setInstalling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Install Forest CLI</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : info ? (
            <div className="space-y-6">
              {/* Auto Install Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Quick Install</h3>
                <p className="text-gray-300 text-sm">
                  Automatically add the Forest CLI to your shell's PATH:
                </p>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedShell}
                    onChange={(e) => setSelectedShell(e.target.value as any)}
                    className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                    disabled={installing}
                  >
                    <option value="zsh">Zsh (~/.zshrc)</option>
                    <option value="bash">Bash (~/.bashrc)</option>
                    <option value="fish">Fish (config.fish)</option>
                  </select>

                  <button
                    onClick={handleAutoInstall}
                    disabled={installing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors"
                  >
                    {installing ? 'Installing...' : 'Auto Install'}
                  </button>
                </div>

                {result && (
                  <div className={`p-3 rounded text-sm font-mono ${
                    result.startsWith('✓') || result.includes('already')
                      ? 'bg-green-900/30 text-green-300 border border-green-700'
                      : 'bg-red-900/30 text-red-300 border border-red-700'
                  }`}>
                    {result}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700" />

              {/* Manual Instructions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Manual Installation</h3>
                <p className="text-gray-300 text-sm">
                  Copy and paste the appropriate command into your shell configuration file:
                </p>

                <div className="space-y-2">
                  <div className="bg-gray-800 rounded p-4 relative group">
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                      {info.instructions}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(info.instructions)}
                      className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* CLI Path Info */}
                <div className="space-y-2">
                  <div className="text-sm text-gray-400">
                    <strong>CLI Binary Location:</strong>
                  </div>
                  <div className="bg-gray-800 rounded p-3 flex items-center justify-between group">
                    <code className="text-sm text-gray-300 font-mono">{info.cli_path}</code>
                    <button
                      onClick={() => copyToClipboard(info.cli_path)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-400">
                    <strong>Binary Directory:</strong>
                  </div>
                  <div className="bg-gray-800 rounded p-3 flex items-center justify-between group">
                    <code className="text-sm text-gray-300 font-mono">{info.bin_dir}</code>
                    <button
                      onClick={() => copyToClipboard(info.bin_dir)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-red-400">Failed to load installation info</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
