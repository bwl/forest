import { afterEach, describe, expect, it } from 'bun:test';
import { createServer } from '../index';

const originalApiKey = process.env.FOREST_API_KEY;
const originalAllowUnauthenticatedPublic = process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC;

function restoreEnv() {
  if (originalApiKey === undefined) {
    delete process.env.FOREST_API_KEY;
  } else {
    process.env.FOREST_API_KEY = originalApiKey;
  }

  if (originalAllowUnauthenticatedPublic === undefined) {
    delete process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC;
  } else {
    process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC = originalAllowUnauthenticatedPublic;
  }
}

describe('server bind safety', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('defaults to localhost', () => {
    delete process.env.FOREST_API_KEY;
    delete process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC;

    const server = createServer();

    expect(server.hostname).toBe('127.0.0.1');
  });

  it('refuses unauthenticated public binds by default', () => {
    delete process.env.FOREST_API_KEY;
    delete process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC;

    expect(() => createServer({ hostname: '0.0.0.0' })).toThrow(
      'Refusing to serve unauthenticated Forest API',
    );
  });

  it('allows public binds when bearer auth is configured', () => {
    process.env.FOREST_API_KEY = 'test-key';
    delete process.env.FOREST_ALLOW_UNAUTHENTICATED_PUBLIC;

    const server = createServer({ hostname: '0.0.0.0' });

    expect(server.hostname).toBe('0.0.0.0');
  });
});
