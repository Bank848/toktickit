import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  filename: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function RemovalConfirmDialog({ filename, onCancel, onConfirm, triggerRef }: Props) {
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Query fresh on every keypress rather than once at mount -- a querySelectorAll result is a
    // static snapshot, not a live list, so a mount-time query would keep excluding Remove from the
    // tab order even after it becomes enabled (reason goes from empty to non-empty without this
    // effect re-running, since reason isn't a dependency). Excluding [disabled] still matters: a
    // disabled element can't actually receive focus in a real browser.
    function getFocusable(): HTMLElement[] {
      return Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([disabled])',
        ) ?? [],
      );
    }

    getFocusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus(); // return focus to the control that opened the dialog
    };
  }, [onCancel, triggerRef]);

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={`Remove ${filename}`}
            ref={dialogRef}
          >
            <div className="modal-header border-0 pb-0">
              <h2 className="modal-title h5 mb-0 d-flex align-items-center gap-2">
                <Icon name="exclamation-triangle-fill" className="text-danger" />
                Remove attachment
              </h2>
            </div>
            <div className="modal-body">
              <p className="mb-3">
                Remove <strong>{filename}</strong>? This cannot be undone.
              </p>
              <label htmlFor="removal-reason" className="form-label is-required">
                Reason for removal
              </label>
              <textarea
                id="removal-reason"
                className="form-control"
                rows={3}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="form-text text-end">{reason.length}/200</div>
            </div>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-tertiary" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={reason.trim().length === 0}
                aria-disabled={reason.trim().length === 0}
                onClick={() => onConfirm(reason.trim())}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
