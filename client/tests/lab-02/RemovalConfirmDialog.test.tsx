import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { createRef } from 'react';
import { RemovalConfirmDialog } from '../../src/components/RemovalConfirmDialog';

function renderDialog(overrides: Partial<{ onCancel: () => void; onConfirm: (reason: string) => void }> = {}) {
  const triggerButton = document.createElement('button');
  triggerButton.textContent = 'Remove';
  document.body.appendChild(triggerButton);
  triggerButton.focus();

  const triggerRef = createRef<HTMLElement>();
  // @ts-expect-error -- assigning to a ref's .current directly for the test's own trigger element
  triggerRef.current = triggerButton;

  const onCancel = overrides.onCancel ?? vi.fn();
  const onConfirm = overrides.onConfirm ?? vi.fn();

  const utils = render(
    <RemovalConfirmDialog filename="invoice.pdf" onCancel={onCancel} onConfirm={onConfirm} triggerRef={triggerRef} />,
  );

  return { ...utils, onCancel, onConfirm, triggerButton };
}

describe('RemovalConfirmDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('moves focus into the dialog on open', () => {
    renderDialog();
    const focusable = screen.getByRole('dialog').querySelectorAll('button, textarea');
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('wraps Tab from the last focusable element to the first, and Shift+Tab from the first to the last', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    // Remove starts disabled (empty reason), so Cancel -- not Remove -- is the last element the
    // trap can actually focus; the trap's focusable list is a mount-time snapshot per the plan.
    const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Confirm until the reason is non-empty', () => {
    renderDialog();
    const confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: /^remove$/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason for removal/i), { target: { value: 'Wrong file' } });
    expect(confirmButton).toBeEnabled();
  });

  it('returns focus to triggerRef element on close, via both Cancel and Confirm paths', () => {
    const onCancel = vi.fn();
    const { triggerButton, unmount } = renderDialog({ onCancel });
    unmount();
    expect(document.activeElement).toBe(triggerButton);

    document.body.innerHTML = '';
    const onConfirm = vi.fn();
    const second = renderDialog({ onConfirm });
    second.unmount();
    expect(document.activeElement).toBe(second.triggerButton);
  });
});
