import '@testing-library/jest-dom/vitest';

// Newer Node versions ship an experimental global `localStorage` that's
// unusable without a `--localstorage-file` flag, and it shadows jsdom's own
// working implementation. Swap in a minimal in-memory Storage so tests that
// touch localStorage (mockClient's `store` surface) don't depend on which
// one won that race.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
