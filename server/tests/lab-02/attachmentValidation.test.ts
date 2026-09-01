import { describe, it, expect } from 'vitest';
import { isAllowedAttachment } from '../../src/validators/attachmentValidation';

// Minimal, real magic-byte signatures for each format, padded with filler bytes so file-type's
// sniffer has enough buffer to read past the signature.
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32),
]);
const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.4', 'ascii'), Buffer.alloc(32)]);

describe('isAllowedAttachment', () => {
  it('accepts a valid PDF (extension, declared MIME, and magic bytes agree)', async () => {
    await expect(isAllowedAttachment('report.pdf', 'application/pdf', PDF_BYTES)).resolves.toBe(true);
  });

  it('accepts a valid JPEG', async () => {
    await expect(isAllowedAttachment('photo.jpg', 'image/jpeg', JPEG_BYTES)).resolves.toBe(true);
  });

  it('accepts a valid PNG', async () => {
    await expect(isAllowedAttachment('screenshot.png', 'image/png', PNG_BYTES)).resolves.toBe(true);
  });

  it('accepts a valid WEBP', async () => {
    await expect(isAllowedAttachment('image.webp', 'image/webp', WEBP_BYTES)).resolves.toBe(true);
  });

  it('rejects a disallowed extension without needing to inspect the buffer', async () => {
    await expect(isAllowedAttachment('virus.exe', 'application/octet-stream', Buffer.alloc(0))).resolves.toBe(
      false
    );
  });

  it('rejects a .pdf-named file that actually contains PNG bytes (sniff disagrees with extension)', async () => {
    await expect(isAllowedAttachment('fake.pdf', 'application/pdf', PNG_BYTES)).resolves.toBe(false);
  });

  it('rejects a .jpg-named file whose declared MIME is not in the allowed set', async () => {
    await expect(
      isAllowedAttachment('photo.jpg', 'application/octet-stream', JPEG_BYTES)
    ).resolves.toBe(false);
  });
});
