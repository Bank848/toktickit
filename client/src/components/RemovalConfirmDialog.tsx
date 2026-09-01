import { useEffect, useRef, useState } from 'react';

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
    // Excludes disabled elements (the plan's literal selector didn't) -- a disabled Remove
    // button can never actually receive focus in a real browser, so leaving it in the tab-order
    // list would make the trap "wrap" onto an element focus() silently no-ops on, breaking the
    // cycle. Cancel is genuinely the last focusable element while the reason field is empty.
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([disabled])',
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
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
    <div role="dialog" aria-modal="true" aria-label={`Remove ${filename}`} ref={dialogRef}>
      <label htmlFor="removal-reason">Reason for removal</label>
      <textarea
        id="removal-reason"
        value={reason}
        maxLength={200}
        onChange={(e) => setReason(e.target.value)}
      />
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" disabled={reason.trim().length === 0} onClick={() => onConfirm(reason.trim())}>
        Remove
      </button>
    </div>
  );
}
