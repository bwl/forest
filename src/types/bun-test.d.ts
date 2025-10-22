declare module 'bun:test' {
  export function describe(name: string, handler: () => void | Promise<void>): void;
  export function it(name: string, handler: () => void | Promise<void>): void;
  export function expect(actual: unknown): any;
}
