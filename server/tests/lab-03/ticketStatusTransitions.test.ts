import { describe, it, expect } from 'vitest';
import { isValidTransition, STATUS_TRANSITIONS, type TicketStatus } from '../../src/services/ticketStatusTransitions';

describe('isValidTransition', () => {
  const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS) as TicketStatus[];

  it.each(ALL_STATUSES)('matches STATUS_TRANSITIONS exactly for every "from" status: %s', (from) => {
    for (const to of ALL_STATUSES) {
      const expected = STATUS_TRANSITIONS[from].includes(to);
      expect(isValidTransition(from, to)).toBe(expected);
    }
  });

  it('accepts every one of the 13 direct rows from specification.md §4.4', () => {
    const directRows: Array<[TicketStatus, TicketStatus]> = [
      ['NEW', 'CANCELLED'],
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'WAITING_FOR_REQUESTER'],
      ['OPEN', 'CANCELLED'],
      ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
      ['IN_PROGRESS', 'RESOLVED'],
      ['WAITING_FOR_REQUESTER', 'IN_PROGRESS'],
      ['WAITING_FOR_REQUESTER', 'RESOLVED'],
      ['WAITING_FOR_REQUESTER', 'CANCELLED'],
      ['RESOLVED', 'CLOSED'],
      ['RESOLVED', 'REOPENED'],
      ['CLOSED', 'REOPENED'],
      ['REOPENED', 'OPEN'],
    ];
    for (const [from, to] of directRows) {
      expect(isValidTransition(from, to)).toBe(true);
    }
  });

  it('rejects every outgoing transition from CANCELLED (fully terminal, no escape row)', () => {
    for (const to of ALL_STATUSES) {
      expect(isValidTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('never accepts NEW as a target status (row 1 is automatic-only, never a direct transition)', () => {
    for (const from of ALL_STATUSES) {
      expect(isValidTransition(from, 'NEW')).toBe(false);
    }
  });
});
