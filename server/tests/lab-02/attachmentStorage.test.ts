import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalDiskStorage } from '../../src/lib/attachmentStorage';

const root = path.join(__dirname, '__tmp-storage__');
const storage = new LocalDiskStorage(root);

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('LocalDiskStorage', () => {
  it('save writes the buffer under a generated key and read returns the same bytes', async () => {
    const key = await storage.save(Buffer.from('hello world'));
    const bytes = await storage.read(key);
    expect(bytes.toString()).toBe('hello world');
  });

  it('save generates a different key per call, never reusing one', async () => {
    const a = await storage.save(Buffer.from('a'));
    const b = await storage.save(Buffer.from('b'));
    expect(a).not.toBe(b);
  });

  it('remove deletes the file; a second remove on the same key does not throw', async () => {
    const key = await storage.save(Buffer.from('x'));
    await storage.remove(key);
    await expect(storage.read(key)).rejects.toThrow();
    await expect(storage.remove(key)).resolves.not.toThrow();
  });
});
