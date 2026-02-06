/**
 * Remote mode helpers for CLI commands.
 *
 * Re-exports `isRemoteMode()` from config and provides a `getClient()`
 * singleton so every command shares the same ForestClient instance.
 */

import { loadConfig, isRemoteMode } from '../../lib/config';
import { ForestClient } from '../../lib/client';

export { isRemoteMode };

let _client: ForestClient | null = null;

/**
 * Return the shared ForestClient instance.  Throws if remote mode is not
 * configured (caller should guard with `isRemoteMode()` first).
 */
export function getClient(): ForestClient {
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
