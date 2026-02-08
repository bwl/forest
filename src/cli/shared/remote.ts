/**
 * Remote mode helpers for CLI commands.
 *
 * Provides `getBackend()` which returns a ForestClient (remote) or
 * LocalBackend (local) implementing the same IForestBackend interface.
 */

import { loadConfig, isRemoteMode } from '../../lib/config';
import { ForestClient } from '../../lib/client';
import { LocalBackend } from '../../lib/local-backend';
import type { IForestBackend } from '../../lib/backend';

export type { IForestBackend };

let _client: ForestClient | null = null;
let _localBackend: LocalBackend | null = null;

function getClient(): ForestClient {
  if (_client) return _client;

  const config = loadConfig();
  if (!config.serverUrl) {
    throw new Error('Remote mode is not configured. Run `forest config` to set serverUrl.');
  }

  _client = new ForestClient({
    baseUrl: config.serverUrl,
    apiKey: config.apiKey,
  });
  return _client;
}

/**
 * Return an IForestBackend: ForestClient if remote mode is configured,
 * LocalBackend otherwise.  Singletons are cached per mode.
 */
export function getBackend(): IForestBackend {
  if (isRemoteMode()) {
    return getClient();
  }

  if (!_localBackend) {
    _localBackend = new LocalBackend();
  }
  return _localBackend;
}
