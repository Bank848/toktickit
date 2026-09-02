import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAttachments, removeAttachment, uploadAttachment, type AttachmentDto } from '../api/attachments';
import { RemovalConfirmDialog } from './RemovalConfirmDialog';
import { Icon } from './Icon';

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

      <div className="mb-3">
        <label htmlFor="attachment-upload-input" className="form-label">
          Add attachment
        </label>
        <div className="attachment-picker">
          <input
            id="attachment-upload-input"
            type="file"
            className="form-control"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            disabled={uploadDisabled}
            onChange={handleFileInput}
          />
          <p className="form-text mb-0">
            JPG, PNG, WEBP or PDF, up to 5 MB, maximum {MAX_ACTIVE_ATTACHMENTS} files ({count} of{' '}
            {MAX_ACTIVE_ATTACHMENTS} used)
          </p>
        </div>
        {uploadError && (
          <div role="alert" className="alert alert-danger mt-2">
            <Icon name="exclamation-triangle-fill" />
            <p>{uploadError}</p>
          </div>
        )}
      </div>

      {listState === 'loading' && (
        <p className="text-body-secondary d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading attachments…
        </p>
      )}

      {listState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <Icon name="exclamation-triangle-fill" />
          <div>
            <p>Failed to load attachments.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadAttachments}>
              <Icon name="arrow-repeat" className="me-1" />
              Retry
            </button>
          </div>
        </div>
      )}

      {listState === 'loaded' && attachments.length === 0 && uploading.length === 0 && (
        <p className="text-body-secondary">No attachments yet.</p>
      )}

      {listState === 'loaded' && (attachments.length > 0 || uploading.length > 0) && (
        <ul className="list-group">
          {attachments.map((attachment) => {
            const isRemoved = attachment.status === 'REMOVED';
            const isOwnUpload = attachment.uploadedBy.id === requesterId;
            return (
              <li
                key={attachment.id}
                data-testid="attachment-row"
                className={`list-group-item d-flex flex-wrap align-items-center gap-2${isRemoved ? ' attachment-removed' : ''}`}
              >
                <span className="attachment-name">
                  <Icon name="paperclip" className="me-1" />
                  {attachment.originalFilename}
                </span>
                <span className="text-body-secondary small">{formatSize(attachment.sizeBytes)}</span>
                <span className="text-body-secondary small">{attachment.uploadedBy.displayName}</span>
                <span className="text-body-secondary small">{new Date(attachment.createdAt).toLocaleString()}</span>
                {isRemoved && (
                  <span className="badge badge-tone-neutral">
                    <Icon name="dash-circle-fill" />
                    Removed
                  </span>
                )}
                {isRemoved && attachment.removal && (
                  <span className="text-body-secondary small w-100">
                    Reason: {attachment.removal.reason} — removed by {attachment.removal.removedBy.displayName} on{' '}
                    {new Date(attachment.removal.removedAt).toLocaleString()}
                  </span>
                )}
                <span className="ms-md-auto d-flex gap-2">
                  {!isRemoved && attachment.downloadUrl && (
                    <a className="btn btn-outline-primary btn-sm" href={attachment.downloadUrl}>
                      Download
                    </a>
                  )}
                  {isRemoved && (
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled aria-disabled="true">
                      Download
                    </button>
                  )}
                  {!isRemoved && isOwnUpload && ticketStatus !== 'CLOSED' && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      ref={(el) => {
                        triggerRefs.current[attachment.id] = el;
                      }}
                      onClick={() => openRemovalDialog(attachment)}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            );
          })}
          {uploading.map((filename) => (
            <li
              key={`uploading-${filename}`}
              data-testid="attachment-row-uploading"
              aria-busy="true"
              className="list-group-item d-flex align-items-center gap-2 text-body-secondary"
            >
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
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
