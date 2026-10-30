export const ACTION_INCLUDE = {
  performedBy: { select: { id: true, displayName: true } },
  lastEditedBy: { select: { id: true, displayName: true } },
} as const;

// Lists are oldest first; the id tiebreak keeps rows with an identical createdAt in a stable order.
export const ACTION_ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];

// The validator value of a record (api-spec.md 4.4): updatedAt as a quoted ISO-8601 string.
export function actionEtag(updatedAt: Date): string {
  return `"${updatedAt.toISOString()}"`;
}

export function serializeAction(action: {
  id: string; ticketId: string; actionAt: Date; description: string; result: string;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  createdAt: Date; updatedAt: Date;
  performedBy: { id: string; displayName: string };
  lastEditedBy: { id: string; displayName: string } | null;
}) {
  return {
    id: action.id, ticketId: action.ticketId, performedBy: action.performedBy, lastEditedBy: action.lastEditedBy,
    actionAt: action.actionAt, description: action.description, result: action.result,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
    etag: actionEtag(action.updatedAt),
    createdAt: action.createdAt, updatedAt: action.updatedAt,
  };
}
