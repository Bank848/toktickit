import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAttachments, removeAttachment, uploadAttachment, type AttachmentDto } from '../api/attachments';
import { RemovalConfirmDialog } from './RemovalConfirmDialog';

const MAX_ACTIVE_ATTACHMENTS = 5;

interface Props {
  ticketId: string;
  requesterId: string;
  ticketStatus: string;
}

type ListState = 'loading' | 'loaded' | 'error';

function activeCount(attachments: AttachmentDto[]): number {
  return attachments.filter((a) => a.status === 'ACTIVE').length;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AttachmentSection({ ticketId, requesterId, ticketStatus }: Props) {
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [uploading, setUploading] = useState<string[]>([]); // staged filenames currently uploading
  const [uploadError, setUploadError] = useState('');
  const [removalTarget, setRemovalTarget] = useState<AttachmentDto | null>(null);

  // Tracks the button that opened the removal dialog per-attachment so focus returns correctly.
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeRemovalTriggerRef = useRef<HTMLElement>(null);

  const loadAttachments = useCallback(() => {
    setListState('loading');
    fetchAttachments(requesterId, ticketId)
      .then((data) => {
        setAttachments(data);
        setListState('loaded');
      })
      .catch(() => {
        setListState('error');
      });
  }, [requesterId, ticketId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const count = activeCount(attachments);
  const uploadDisabled = count >= MAX_ACTIVE_ATTACHMENTS || ticketStatus === 'CLOSED';

  async function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setUploadError('');
    for (const file of files) {
      setUploading((prev) => [...prev, file.name]);
      try {
        const created = await uploadAttachment(requesterId, ticketId, file);
        setAttachments((prev) => [...prev, created]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Failed to upload ${file.name}`);
      } finally {
        setUploading((prev) => {
          const index = prev.indexOf(file.name);
          if (index === -1) return prev;
          const next = [...prev];
          next.splice(index, 1);
          return next;
        });
      }
    }
  }

  function openRemovalDialog(attachment: AttachmentDto) {
    activeRemovalTriggerRef.current = triggerRefs.current[attachment.id] ?? null;
    setRemovalTarget(attachment);
  }

  function closeRemovalDialog() {
    setRemovalTarget(null);
  }

  async function confirmRemoval(reason: string) {
    if (!removalTarget) return;
    const updated = await removeAttachment(requesterId, removalTarget.id, reason);
    setAttachments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setRemovalTarget(null);
  }

  return (
    <section aria-labelledby="attachments-heading">
      <h2 id="attachments-heading">Attachments</h2>

      <div>
        <label htmlFor="attachment-upload-input">Add attachment</label>
        <input
          id="attachment-upload-input"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          disabled={uploadDisabled}
          onChange={handleFileInput}
        />
        <p>
          JPG, PNG, WEBP or PDF, up to 5 MB, maximum {MAX_ACTIVE_ATTACHMENTS} files ({count} of{' '}
          {MAX_ACTIVE_ATTACHMENTS} used)
        </p>
        {uploadError && <p role="alert">{uploadError}</p>}
      </div>

      {listState === 'loading' && <p>Loading attachments…</p>}

      {listState === 'error' && (
        <div role="alert">
          <p>Failed to load attachments.</p>
          <button type="button" onClick={loadAttachments}>
            Retry
          </button>
        </div>
      )}

      {listState === 'loaded' && attachments.length === 0 && uploading.length === 0 && <p>No attachments yet.</p>}

      {listState === 'loaded' && (attachments.length > 0 || uploading.length > 0) && (
        <ul>
          {attachments.map((attachment) => {
            const isRemoved = attachment.status === 'REMOVED';
            const isOwnUpload = attachment.uploadedBy.id === requesterId;
            return (
              <li
                key={attachment.id}
                data-testid="attachment-row"
                style={isRemoved ? { color: '#6c757d' } : undefined}
              >
                <span>{attachment.originalFilename}</span>{' '}
                <span>{formatSize(attachment.sizeBytes)}</span>{' '}
                <span>{attachment.uploadedBy.displayName}</span>{' '}
                <span>{new Date(attachment.createdAt).toLocaleString()}</span>{' '}
                {isRemoved && (
                  <span className="badge text-bg-secondary">
                    <span aria-hidden="true">■ </span>Removed
                  </span>
                )}
                {isRemoved && attachment.removal && (
                  <span>
                    {' '}
                    Reason: {attachment.removal.reason} — removed by {attachment.removal.removedBy.displayName} on{' '}
                    {new Date(attachment.removal.removedAt).toLocaleString()}
                  </span>
                )}
                {!isRemoved && attachment.downloadUrl && (
                  <a href={attachment.downloadUrl}>Download</a>
                )}
                {isRemoved && (
                  <button type="button" disabled>
                    Download
                  </button>
                )}
                {!isRemoved && isOwnUpload && ticketStatus !== 'CLOSED' && (
                  <button
                    type="button"
                    ref={(el) => {
                      triggerRefs.current[attachment.id] = el;
                    }}
                    onClick={() => openRemovalDialog(attachment)}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
          {uploading.map((filename) => (
            <li key={`uploading-${filename}`} data-testid="attachment-row-uploading" aria-busy="true">
              <span>{filename}</span> <span>Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      {removalTarget && (
        <RemovalConfirmDialog
          filename={removalTarget.originalFilename}
          onCancel={closeRemovalDialog}
          onConfirm={confirmRemoval}
          triggerRef={activeRemovalTriggerRef}
        />
      )}
    </section>
  );
}
