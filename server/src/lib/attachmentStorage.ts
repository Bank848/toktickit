import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface AttachmentStorage {
  save(bytes: Buffer): Promise<string>; // returns a storage key
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

// D-20b: Lab 2 defaults to local disk. The interface is what Lab 3's SeaweedFS adapter (D-06)
// implements next -- route code below only ever calls these three methods, never touches fs
// directly, so swapping the implementation later is a one-file change.
export class LocalDiskStorage implements AttachmentStorage {
  constructor(private readonly root: string) {}

  async save(bytes: Buffer): Promise<string> {
    await fs.mkdir(this.root, { recursive: true });
    const key = randomUUID();
    await fs.writeFile(this.resolve(key), bytes);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private resolve(key: string): string {
    // key comes only from randomUUID() above, never from user input, so no path-traversal
    // surface exists here -- still validate the shape defensively in case a future caller
    // passes a stored key back in from the database.
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('Invalid storage key');
    return path.join(this.root, key);
  }
}

export const attachmentStorage = new LocalDiskStorage(
  path.join(__dirname, '..', '..', 'storage', 'attachments')
);
