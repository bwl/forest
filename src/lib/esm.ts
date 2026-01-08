/**
 * ESM helper utilities
 * Provides __dirname and __filename replacements for ESM modules
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire as nodeCreateRequire } from 'module';

/**
 * Get the directory name of the current module (replaces __dirname)
 * @param meta - import.meta from the calling module
 * @returns Directory path of the current module
 *
 * @example
 * ```ts
 * import { getDirname } from './esm.js';
 * const __dirname = getDirname(import.meta);
 * ```
 */
export function getDirname(meta: ImportMeta): string {
  return dirname(fileURLToPath(meta.url));
}

/**
 * Get the file name of the current module (replaces __filename)
 * @param meta - import.meta from the calling module
 * @returns File path of the current module
 *
 * @example
 * ```ts
 * import { getFilename } from './esm.js';
 * const __filename = getFilename(import.meta);
 * ```
 */
export function getFilename(meta: ImportMeta): string {
  return fileURLToPath(meta.url);
}

/**
 * Create a require function for importing CommonJS modules (replaces require())
 * @param meta - import.meta from the calling module
 * @returns A require function that can import CJS modules
 *
 * @example
 * ```ts
 * import { createRequire } from './esm.js';
 * const require = createRequire(import.meta);
 * const cjsModule = require('some-cjs-module');
 * ```
 */
export function createRequire(meta: ImportMeta): NodeRequire {
  return nodeCreateRequire(meta.url);
}
