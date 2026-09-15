export type TicketStatus =
  | 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED';

// specification.md §4.4. NEW -> OPEN (row 1) is deliberately absent: it is never a direct
// status-endpoint transition, only the automatic side effect of the first ownership assignment
// (BR-15, implemented in the /owner route). Every other row of the 14-row table maps 1:1 to an
// entry here; a target not present in the current status's list means "reject with 409."
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN'],
  CANCELLED: [],
};

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
