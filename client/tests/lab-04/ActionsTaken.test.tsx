import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ActionsTakenSection } from '../../src/components/ActionsTakenSection';
import { ActionsTakenReadOnlySection } from '../../src/components/ActionsTakenReadOnlySection';
import { StaffTicketDetailPage } from '../../src/pages/StaffTicketDetailPage';
import { TicketDetailPage } from '../../src/pages/TicketDetailPage';
import { AuthProvider } from '../../src/context/AuthContext';
import * as staffActionsApi from '../../src/api/staffActions';
import * as actionsApi from '../../src/api/actions';
import * as staffTicketsApi from '../../src/api/staffTickets';
import * as ticketsApi from '../../src/api/tickets';
import * as authApi from '../../src/api/auth';
import * as attachmentsApi from '../../src/api/attachments';
import * as commentsApi from '../../src/api/comments';
import { ActionApiError } from '../../src/api/actions';
import type { ActionTakenDto } from '../../src/api/actions';

const TICKET_ID = 'tkt-1';

function action(overrides: Partial<ActionTakenDto> = {}): ActionTakenDto {
  return {
    id: 'a-1', ticketId: TICKET_ID,
    performedBy: { id: 'staff-1', displayName: 'Pakorn W.' }, lastEditedBy: null,
    actionAt: '2026-09-20T10:00:00.000Z', description: 'Replaced the network cable.',
    result: 'RESOLVED', followUpRequired: false, followUpNote: null, attachmentNotes: null,
    etag: '"2026-09-20T10:05:00.000Z"',
    createdAt: '2026-09-20T10:05:00.000Z', updatedAt: '2026-09-20T10:05:00.000Z',
    ...overrides,
  };
}

function apiError(status: number, code: string, message = 'server message') {
  return new ActionApiError(message, status, [], code);
}

const KEY_1 = '11111111-1111-4111-8111-111111111111';
const KEY_2 = '22222222-2222-4222-8222-222222222222';
const KEY_3 = '33333333-3333-4333-8333-333333333333';

function stubKeys(...keys: string[]) {
  const spy = vi.spyOn(crypto, 'randomUUID');
  keys.forEach((k) => spy.mockImplementationOnce(() => k as `${string}-${string}-${string}-${string}-${string}`));
  return spy;
}

async function openCreateForm() {
  await waitFor(() => screen.getByText(/no actions taken yet/i));
  fireEvent.click(screen.getByRole('button', { name: /record action taken/i }));
}

function fillDescription(text: string) {
  fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: text } });
}

describe('ActionsTakenSection (staff)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('CMP-01 shows an empty state when there are zero records', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => expect(screen.getByText('No Actions Taken yet.')).toBeInTheDocument());
  });

  it('CMP-02 lists existing records with performer, result badge, and follow-up badge', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([
      action({ followUpRequired: true, followUpNote: 'Call back tomorrow.' }),
    ]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => expect(screen.getByText('Replaced the network cable.')).toBeInTheDocument());
    const row = screen.getByTestId('action-row');
    expect(within(row).getByText('Pakorn W.')).toBeInTheDocument();
    expect(within(row).getByText('Resolved')).toBeInTheDocument();
    expect(within(row).getByText(/follow-up required/i)).toBeInTheDocument();
    expect(within(row).getByText(/call back tomorrow/i)).toBeInTheDocument();
  });

  it('CMP-02 keeps the order the server returned (oldest first) and does not re-sort', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([
      action({ id: 'a-1', description: 'First', createdAt: '2026-09-20T10:05:00.000Z' }),
      action({ id: 'a-2', description: 'Second', createdAt: '2026-09-20T09:00:00.000Z' }),
    ]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => screen.getByText('First'));
    const rows = screen.getAllByTestId('action-row');
    expect(within(rows[0]).getByText('First')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Second')).toBeInTheDocument();
  });

  it('CMP-03 creates a new Action Taken and appends it to the list without a reload', async () => {
    const fetchSpy = vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action({ id: 'a-old', description: 'Older record' })]);
    const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction').mockResolvedValue(action({ id: 'a-new', description: 'Brand new record' }));
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => screen.getByText('Older record'));

    fireEvent.click(screen.getByRole('button', { name: /record action taken/i }));
    fillDescription('Brand new record');
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'ESCALATED' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText('Brand new record')).toBeInTheDocument());
    expect(postSpy).toHaveBeenCalledTimes(1);
    const payload = postSpy.mock.calls[0][1];
    expect(payload).toMatchObject({ description: 'Brand new record', result: 'ESCALATED', followUpRequired: false });
    expect(payload.actionAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(payload).not.toHaveProperty('performedById');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const rows = screen.getAllByTestId('action-row');
    expect(within(rows[1]).getByText('Brand new record')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^description/i)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Action Taken recorded.');
  });

  it('CMP-04 disables Save when Follow-Up Required is checked and the note is empty', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction');
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await openCreateForm();
    fillDescription('Escalated to vendor.');
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByLabelText(/^follow-up note/i)).toHaveAccessibleDescription(/note is required/i);
    expect(postSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^follow-up note/i), { target: { value: 'Vendor will call.' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('CMP-05 lets staff edit a record, sends its etag as If-Match, and shows Edited by', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action()]);
    const patchSpy = vi.spyOn(staffActionsApi, 'updateStaffAction').mockResolvedValue(
      action({
        description: 'Replaced the cable and the switch port.',
        lastEditedBy: { id: 'staff-2', displayName: 'Suda N.' },
        etag: '"2026-09-21T08:00:00.000Z"',
      }),
    );
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => screen.getByText('Replaced the network cable.'));

    fireEvent.click(within(screen.getByTestId('action-row')).getByRole('button', { name: /edit/i }));
    fillDescription('Replaced the cable and the switch port.');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    expect(patchSpy).toHaveBeenCalledWith(TICKET_ID, 'a-1', expect.any(Object), '"2026-09-20T10:05:00.000Z"');
    await waitFor(() => expect(screen.getByText('Replaced the cable and the switch port.')).toBeInTheDocument());
    expect(screen.getByText(/edited by suda n\./i)).toBeInTheDocument();
    expect(within(screen.getByTestId('action-row')).getByText('Pakorn W.')).toBeInTheDocument();
  });

  it('CMP-06 disables the Record button and every Edit button when the ticket is locked', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action()]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={true} />);
    await waitFor(() => screen.getByText('Replaced the network cable.'));
    expect(screen.getByRole('button', { name: /record action taken/i })).toBeDisabled();
    expect(within(screen.getByTestId('action-row')).getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.getByText(/closed or cancelled/i)).toBeInTheDocument();
  });

  it('CMP-06 a server TICKET_LOCKED answer shows a safe message and disables Save, Record and Edit', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    vi.spyOn(staffActionsApi, 'postStaffAction').mockRejectedValue(apiError(409, 'TICKET_LOCKED', 'raw server text'));
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await openCreateForm();
    fillDescription('Late fix.');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/closed or cancelled/i);
    expect(alert).not.toHaveTextContent('raw server text');
    expect(screen.getByLabelText(/^description/i)).toHaveValue('Late fix.');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('button', { name: /record action taken/i })).toBeDisabled();
  });

  it('CMP-07 shows an error alert, keeps the form open, and keeps the values when create fails', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    vi.spyOn(staffActionsApi, 'postStaffAction').mockRejectedValue(apiError(500, 'INTERNAL_ERROR', 'Failed to save'));
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await openCreateForm();
    fillDescription('Attempted a fix.');
    fireEvent.change(screen.getByLabelText(/^result/i), { target: { value: 'ESCALATED' } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));
    fireEvent.change(screen.getByLabelText(/^follow-up note/i), { target: { value: 'Check again Monday.' } });
    fireEvent.change(screen.getByLabelText(/attachment notes/i), { target: { value: 'Photo in shared drive.' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to save'));
    expect(screen.getByLabelText(/^description/i)).toHaveValue('Attempted a fix.');
    expect(screen.getByLabelText(/^result/i)).toHaveValue('ESCALATED');
    expect(screen.getByLabelText(/^follow-up note/i)).toHaveValue('Check again Monday.');
    expect(screen.getByLabelText(/attachment notes/i)).toHaveValue('Photo in shared drive.');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('CMP-08 shows attachment notes as plain text on the staff row', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([
      action({ attachmentNotes: 'Photo of the damaged cable <b>bold</b> shared via email.' }),
    ]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => screen.getByText('Replaced the network cable.'));
    const row = screen.getByTestId('action-row');
    expect(within(row).getByText(/photo of the damaged cable <b>bold<\/b> shared via email/i)).toBeInTheDocument();
    expect(row.querySelector('b')).toBeNull();
  });

  it('CMP-09 disables Save when Action Date/Time is cleared and never calls postStaffAction', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction');
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await openCreateForm();
    fillDescription('Some fix.');
    fireEvent.change(screen.getByLabelText(/action date\/time/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: /record action taken/i }));
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('shows a Retry button when the staff list fails to load', async () => {
    const fetchSpy = vi.spyOn(staffActionsApi, 'fetchStaffActions')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to load Actions Taken.'));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no actions taken yet/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('labels every required field and marks it required for assistive technology', async () => {
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
    render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
    await openCreateForm();
    for (const name of [/^action date\/time/i, /^description/i, /^result/i]) {
      expect(screen.getByLabelText(name)).toBeRequired();
    }
    expect(screen.getByLabelText(/attachment notes \(optional\)/i)).not.toBeRequired();
    expect(screen.getByLabelText(/attachment notes/i)).toHaveAccessibleDescription(/no file is uploaded/i);
  });

  describe('create Idempotency-Key (api-spec 4.5)', () => {
    it('reuses the same key when Save is retried after a lost response', async () => {
      stubKeys(KEY_1, KEY_2);
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
      const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(action({ id: 'a-new', description: 'Retried record' }));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openCreateForm();
      fillDescription('Retried record');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server/i));
      expect(screen.getByLabelText(/^description/i)).toHaveValue('Retried record');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(screen.getByText('Retried record')).toBeInTheDocument());
      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(postSpy.mock.calls[0][2]).toBe(KEY_1);
      expect(postSpy.mock.calls[1][2]).toBe(KEY_1);
    });

    it('reuses the same key after a 5xx and treats a 200 replay as success', async () => {
      stubKeys(KEY_1);
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
      const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction')
        .mockRejectedValueOnce(apiError(503, 'UNAVAILABLE', 'Service unavailable'))
        .mockResolvedValueOnce(action({ id: 'a-new', description: 'Stored by the first attempt' }));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openCreateForm();
      fillDescription('Stored by the first attempt');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => screen.getByRole('alert'));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(screen.getAllByTestId('action-row')).toHaveLength(1));
      expect(postSpy.mock.calls.map((c) => c[2])).toEqual([KEY_1, KEY_1]);
    });

    it('gives a new form open a new key, after Cancel and after a successful save', async () => {
      stubKeys(KEY_1, KEY_2, KEY_3);
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
      const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction')
        .mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR', 'boom'))
        .mockResolvedValue(action({ id: 'a-new' }));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);

      await openCreateForm();
      fillDescription('First form');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => screen.getByRole('alert'));
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      fireEvent.click(screen.getByRole('button', { name: /record action taken/i }));
      fillDescription('Second form');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(screen.queryByLabelText(/^description/i)).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /record action taken/i }));
      fillDescription('Third form');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(3));

      expect(postSpy.mock.calls.map((c) => c[2])).toEqual([KEY_1, KEY_2, KEY_3]);
    });

    it('IDEMPOTENCY_KEY_REUSED explains the situation; Reload checks the list and the next Save uses a fresh key', async () => {
      stubKeys(KEY_1, KEY_2);
      const fetchSpy = vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
      const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction')
        .mockRejectedValueOnce(apiError(409, 'IDEMPOTENCY_KEY_REUSED', 'raw text'))
        .mockResolvedValueOnce(action({ id: 'a-new', description: 'Edited text' }));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openCreateForm();
      fillDescription('Edited text');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/may already have been saved/i);
      expect(alert).not.toHaveTextContent('raw text');
      fireEvent.click(within(alert).getByRole('button', { name: /reload/i }));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(screen.getByLabelText(/^description/i)).toHaveValue('Edited text');

      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
      expect(postSpy.mock.calls[1][2]).toBe(KEY_2);
    });

    it('does not send a second request when Save is submitted twice before the first finishes', async () => {
      stubKeys(KEY_1);
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([]);
      let resolvePost: (value: ActionTakenDto) => void = () => {};
      const postSpy = vi.spyOn(staffActionsApi, 'postStaffAction').mockReturnValue(
        new Promise((resolve) => { resolvePost = resolve; }),
      );
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openCreateForm();
      fillDescription('Double click');
      const form = screen.getByRole('form', { name: /record action taken/i });
      fireEvent.submit(form);
      fireEvent.submit(form);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /^save$/i })).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByLabelText(/^description/i)).toBeDisabled();
      resolvePost(action({ id: 'a-new', description: 'Double click' }));
      await waitFor(() => expect(screen.getByText('Double click')).toBeInTheDocument());
    });
  });

  describe('edit If-Match (api-spec 4.4)', () => {
    async function openEditForm() {
      await waitFor(() => screen.getByText('Replaced the network cable.'));
      fireEvent.click(within(screen.getByTestId('action-row')).getByRole('button', { name: /edit/i }));
    }

    it('STALE_UPDATE keeps the form and typed values, shows the reload message, and Reload refetches', async () => {
      const fetchSpy = vi.spyOn(staffActionsApi, 'fetchStaffActions')
        .mockResolvedValueOnce([action()])
        .mockResolvedValueOnce([action({ description: 'Changed by someone else', etag: '"2026-09-22T00:00:00.000Z"' })]);
      const patchSpy = vi.spyOn(staffActionsApi, 'updateStaffAction')
        .mockRejectedValueOnce(apiError(409, 'STALE_UPDATE', 'raw text'))
        .mockResolvedValueOnce(action({ description: 'My edit', etag: '"2026-09-23T00:00:00.000Z"' }));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openEditForm();
      fillDescription('My edit');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This record was changed by someone else. Reload to see the latest version.');
      expect(screen.getByLabelText(/^description/i)).toHaveValue('My edit');

      fireEvent.click(within(alert).getByRole('button', { name: /reload/i }));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByText('Changed by someone else')).toBeInTheDocument());
      expect(screen.getByLabelText(/^description/i)).toHaveValue('My edit');

      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(2));
      expect(patchSpy.mock.calls[0][3]).toBe('"2026-09-20T10:05:00.000Z"');
      expect(patchSpy.mock.calls[1][3]).toBe('"2026-09-22T00:00:00.000Z"');
    });

    it('PRECONDITION_REQUIRED (428) shows a clear message with a Reload button and keeps the values', async () => {
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action()]);
      vi.spyOn(staffActionsApi, 'updateStaffAction').mockRejectedValue(apiError(428, 'PRECONDITION_REQUIRED', 'An If-Match header is required'));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openEditForm();
      fillDescription('Typed text');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/reload and try again/i);
      expect(within(alert).getByRole('button', { name: /reload/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^description/i)).toHaveValue('Typed text');
    });

    it('TICKET_LOCKED on edit disables Save and keeps the typed values', async () => {
      vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action()]);
      vi.spyOn(staffActionsApi, 'updateStaffAction').mockRejectedValue(apiError(409, 'TICKET_LOCKED'));
      render(<ActionsTakenSection ticketId={TICKET_ID} ticketLocked={false} />);
      await openEditForm();
      fillDescription('Typed text');
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await screen.findByRole('alert');
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
      expect(screen.getByLabelText(/^description/i)).toHaveValue('Typed text');
    });
  });
});

describe('staffActions API layer', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const payload = {
    actionAt: '2026-09-20T10:00:00.000Z', description: 'Fix', result: 'RESOLVED' as const, followUpRequired: false,
  };

  it('POST sends the Idempotency-Key header and no performedById', async () => {
    const fetchMock = stubFetch(action(), 201);
    await staffActionsApi.postStaffAction(TICKET_ID, payload, KEY_1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/staff\/tickets\/tkt-1\/actions$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe(KEY_1);
    expect(JSON.parse(init.body)).not.toHaveProperty('performedById');
  });

  it('POST accepts a 200 replay as success', async () => {
    stubFetch(action(), 200);
    await expect(staffActionsApi.postStaffAction(TICKET_ID, payload, KEY_1)).resolves.toMatchObject({ id: 'a-1' });
  });

  it('PATCH sends the record etag unchanged as If-Match', async () => {
    const fetchMock = stubFetch(action());
    await staffActionsApi.updateStaffAction(TICKET_ID, 'a-1', payload, '"2026-09-20T10:05:00.000Z"');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/actions\/a-1$/);
    expect(init.method).toBe('PATCH');
    expect(init.headers['If-Match']).toBe('"2026-09-20T10:05:00.000Z"');
    expect(JSON.parse(init.body)).not.toHaveProperty('performedById');
  });

  it('turns an error envelope into an ActionApiError with the code', async () => {
    stubFetch({ error: { code: 'STALE_UPDATE', message: 'stale' } }, 409);
    await expect(staffActionsApi.updateStaffAction(TICKET_ID, 'a-1', payload, '"x"')).rejects.toMatchObject({
      status: 409, code: 'STALE_UPDATE', message: 'stale',
    });
  });
});

describe('ActionsTakenReadOnlySection (Requester)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('CMP-11 shows an empty state when there are zero records', async () => {
    vi.spyOn(actionsApi, 'fetchActions').mockResolvedValue([]);
    render(<ActionsTakenReadOnlySection ticketId={TICKET_ID} />);
    await waitFor(() => expect(screen.getByText('No Actions Taken yet.')).toBeInTheDocument());
  });

  it('CMP-12 renders every field including Edited by, with no create or edit control', async () => {
    vi.spyOn(actionsApi, 'fetchActions').mockResolvedValue([
      action({
        followUpRequired: true, followUpNote: 'We will call you back tomorrow.', attachmentNotes: 'Photo on file.',
        lastEditedBy: { id: 'staff-2', displayName: 'Suda N.' },
      }),
    ]);
    render(<ActionsTakenReadOnlySection ticketId={TICKET_ID} />);
    await waitFor(() => expect(screen.getByText('Replaced the network cable.')).toBeInTheDocument());
    const row = screen.getByTestId('action-row-readonly');
    expect(within(row).getByText('Pakorn W.')).toBeInTheDocument();
    expect(within(row).getByText('Resolved')).toBeInTheDocument();
    expect(within(row).getByText(/follow-up required/i)).toBeInTheDocument();
    expect(within(row).getByText(/we will call you back tomorrow/i)).toBeInTheDocument();
    expect(within(row).getByText(/photo on file/i)).toBeInTheDocument();
    expect(within(row).getByText(/edited by suda n\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record action taken/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('CMP-13 shows an error alert with Retry when the list fetch fails', async () => {
    const fetchSpy = vi.spyOn(actionsApi, 'fetchActions')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([]);
    render(<ActionsTakenReadOnlySection ticketId={TICKET_ID} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to load Actions Taken.'));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no actions taken yet/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('Ticket detail page integration', () => {
  const STAFF_DETAIL = {
    id: TICKET_ID, ticketNo: 'TCK-2026-0001', summary: 'VPN down', description: 'Cannot connect.',
    category: { id: 1, name: 'Network' }, relatedSystem: null, status: 'OPEN',
    requestedPriority: 'HIGH', itPriority: 'HIGH', createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z', attachmentCount: 0,
    requester: { id: 'r1', displayName: 'Nattapong R.' }, owner: { id: 'owner-1', displayName: 'Jane Staff' },
    resolutionSummary: null, version: 0,
  };

  function renderStaffPage() {
    return render(
      <MemoryRouter initialEntries={[`/staff/tickets/${TICKET_ID}`]}>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function mockStaffPage(status: string) {
    vi.restoreAllMocks();
    vi.spyOn(staffTicketsApi, 'fetchStaffTicketDetail').mockResolvedValue({ ...STAFF_DETAIL, status } as never);
    vi.spyOn(staffTicketsApi, 'fetchAssignableOwners').mockResolvedValue([]);
    vi.spyOn(staffTicketsApi, 'fetchStaffComments').mockResolvedValue([]);
    vi.spyOn(staffTicketsApi, 'fetchStaffNotes').mockResolvedValue([]);
    vi.spyOn(staffTicketsApi, 'fetchStaffTicketAttachments').mockResolvedValue([]);
    vi.spyOn(staffActionsApi, 'fetchStaffActions').mockResolvedValue([action()]);
  }

  it('CMP-14 the staff detail page renders the Actions Taken section', async () => {
    mockStaffPage('OPEN');
    renderStaffPage();
    const heading = await screen.findByRole('heading', { name: 'Actions Taken' });
    expect(heading).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Replaced the network cable.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /record action taken/i })).toBeEnabled();
  });

  it.each(['CLOSED', 'CANCELLED'])('CMP-15 a %s ticket disables the Record button on the detail page', async (status) => {
    mockStaffPage(status);
    renderStaffPage();
    await waitFor(() => screen.getByText('Replaced the network cable.'));
    expect(screen.getByRole('button', { name: /record action taken/i })).toBeDisabled();
    expect(within(screen.getByTestId('action-row')).getByRole('button', { name: /edit/i })).toBeDisabled();
  });

  it('CMP-19 the Requester detail page shows the read-only section below Comments', async () => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchMe').mockResolvedValue({
      id: 'req-1', email: 'r1@test.dev', displayName: 'Ariya', role: 'REQUESTER', mustChangePassword: false,
    });
    vi.spyOn(ticketsApi, 'fetchTicketDetail').mockResolvedValue({
      ...STAFF_DETAIL, requester: { id: 'req-1', displayName: 'Ariya' }, status: 'NEW', version: 1,
    } as never);
    vi.spyOn(attachmentsApi, 'fetchAttachments').mockResolvedValue([]);
    vi.spyOn(commentsApi, 'fetchComments').mockResolvedValue([]);
    vi.spyOn(actionsApi, 'fetchActions').mockResolvedValue([action({ description: 'Visible to the requester' })]);
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/tickets/${TICKET_ID}`]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('Visible to the requester')).toBeInTheDocument());
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.indexOf('Actions Taken')).toBeGreaterThan(headings.indexOf('Comments'));
    expect(screen.queryByRole('button', { name: /record action taken/i })).not.toBeInTheDocument();
  });
});
