import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AttachmentSection } from '../../src/components/AttachmentSection';
import * as attachmentsApi from '../../src/api/attachments';
import type { AttachmentDto } from '../../src/api/attachments';

const REQUESTER_ID = 'req-1';
const TICKET_ID = 'tkt-1';

function activeAttachment(overrides: Partial<AttachmentDto> = {}): AttachmentDto {
  return {
    id: 'att-1',
    originalFilename: 'invoice.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdAt: '2026-09-01T00:00:00.000Z',
    uploadedBy: { id: REQUESTER_ID, displayName: 'Ariya' },
    status: 'ACTIVE',
    downloadUrl: 'http://localhost:4000/api/v1/attachments/att-1/content',
    removal: null,
    ...overrides,
  };
}

function removedAttachment(overrides: Partial<AttachmentDto> = {}): AttachmentDto {
  return {
    ...activeAttachment(),
    id: 'att-2',
    status: 'REMOVED',
    downloadUrl: null,
    removal: {
      reason: 'Wrong file',
      removedAt: '2026-09-02T00:00:00.000Z',
      removedBy: { id: REQUESTER_ID, displayName: 'Ariya' },
    },
    ...overrides,
  };
}

function renderSection(ticketStatus = 'NEW') {
  return render(
    <AttachmentSection ticketId={TICKET_ID} requesterId={REQUESTER_ID} ticketStatus={ticketStatus} />,
  );
}

describe('AttachmentSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty state when there are zero attachments ever', async () => {
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([]);
    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/no attachments yet/i)).toBeInTheDocument();
    });
  });

  it('renders an Active row with a working Download link and a Remove button for the current requester\'s own upload', async () => {
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([activeAttachment()]);
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    });
    const row = screen.getByText('invoice.pdf').closest('[data-testid="attachment-row"]') as HTMLElement;
    expect(within(row).getByRole('link', { name: /download/i })).toHaveAttribute(
      'href',
      'http://localhost:4000/api/v1/attachments/att-1/content',
    );
    expect(within(row).getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('hides the Remove button for an attachment uploaded by a different requester', async () => {
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([
      activeAttachment({ uploadedBy: { id: 'someone-else', displayName: 'Narin' } }),
    ]);
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    });
    const row = screen.getByText('invoice.pdf').closest('[data-testid="attachment-row"]') as HTMLElement;
    expect(within(row).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('renders a Removed row de-emphasized, with reason/remover/date and a disabled download control', async () => {
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([removedAttachment()]);
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    });
    const row = screen.getByText('invoice.pdf').closest('[data-testid="attachment-row"]') as HTMLElement;
    expect(within(row).getAllByText(/removed/i).length).toBeGreaterThan(0);
    expect(within(row).getByText(/wrong file/i)).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    const disabledDownload = within(row).getByRole('button', { name: /download/i });
    expect(disabledDownload).toBeDisabled();
  });

  it('shows an inline error with Retry, not a partial list, when the attachment list fetch fails', async () => {
    const fetchSpy = vi
      .spyOn(attachmentsApi, 'fetchAttachments')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([activeAttachment()]);
    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('disables the upload control at 5 active attachments and shows "5 of 5 used"', async () => {
    const five = Array.from({ length: 5 }, (_, i) => activeAttachment({ id: `att-${i}`, originalFilename: `file${i}.pdf` }));
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue(five);
    renderSection();

    await waitFor(() => {
      expect(screen.getByText(/5 of 5 used/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/add attachment/i)).toBeDisabled();
  });

  it('opens the removal dialog and, on confirm, replaces the row with the server-returned removed DTO without refetching the whole list', async () => {
    const fetchSpy = vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([activeAttachment()]);
    const removeSpy = vi
      .spyOn(attachmentsApi, 'removeAttachment')
      .mockResolvedValue(removedAttachment({ id: 'att-1' }));
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    });
    const row = screen.getByText('invoice.pdf').closest('[data-testid="attachment-row"]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /remove/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/reason for removal/i), { target: { value: 'Wrong file' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^remove$/i }));

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith(REQUESTER_ID, 'att-1', 'Wrong file');
    });
    await waitFor(() => {
      expect(screen.getAllByText(/removed/i).length).toBeGreaterThan(0);
    });
    // Only the initial mount fetch, not a refetch after removal.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
