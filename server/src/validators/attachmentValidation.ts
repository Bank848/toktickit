// file-type@17+ is ESM-only and cannot be `require()`d from this CommonJS project, so this
// deviates from the plan's `import { fileTypeFromBuffer } from 'file-type'` -- pinned to
// file-type@16.5.4 (last CJS-compatible release), whose export is named `fromBuffer`.
import { fromBuffer as fileTypeFromBuffer } from 'file-type';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

export async function isAllowedAttachment(
  originalFilename: string,
  declaredMimeType: string,
  buffer: Buffer
): Promise<boolean> {
  const extension = originalFilename.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(extension)) return false;
  if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) return false;

  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed) return false;
  // The sniffed MIME must agree with what the extension implies, not just be "some allowed type"
  // -- a .pdf that is actually a renamed .png must still be rejected, since the declared
  // extension and the real content disagree.
  return sniffed.mime === EXTENSION_TO_MIME[extension];
}
