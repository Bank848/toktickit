export interface FieldError {
  field: string;
  message: string;
}

export interface ValidatedCreateTicketRequest {
  summary: string;
  description: string;
  categoryId: number;
  relatedSystemId: number | null;
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

type ValidationResult =
  | { ok: true; value: ValidatedCreateTicketRequest }
  | { ok: false; errors: FieldError[] };

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export function validateCreateTicketRequest(body: Record<string, unknown>): ValidationResult {
  const errors: FieldError[] = [];

  const rawSummary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (typeof body.summary !== 'string' || rawSummary.length < 5 || rawSummary.length > 150) {
    errors.push({ field: 'summary', message: 'summary must be 5-150 characters' });
  }

  const rawDescription = typeof body.description === 'string' ? body.description.trim() : '';
  if (typeof body.description !== 'string' || rawDescription.length < 10 || rawDescription.length > 5000) {
    errors.push({ field: 'description', message: 'description must be 10-5000 characters' });
  }

  const categoryId = body.categoryId;
  if (typeof categoryId !== 'number' || !Number.isInteger(categoryId)) {
    errors.push({ field: 'categoryId', message: 'categoryId is required and must be an integer' });
  }

  let relatedSystemId: number | null = null;
  if (body.relatedSystemId !== undefined && body.relatedSystemId !== null) {
    if (typeof body.relatedSystemId !== 'number' || !Number.isInteger(body.relatedSystemId)) {
      errors.push({ field: 'relatedSystemId', message: 'relatedSystemId must be an integer' });
    } else {
      relatedSystemId = body.relatedSystemId;
    }
  }

  const requestedPriority = body.requestedPriority;
  if (typeof requestedPriority !== 'string' || !(PRIORITIES as readonly string[]).includes(requestedPriority)) {
    errors.push({
      field: 'requestedPriority',
      message: `requestedPriority must be one of ${PRIORITIES.join(', ')}`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      summary: rawSummary,
      description: rawDescription,
      categoryId: categoryId as number,
      relatedSystemId,
      requestedPriority: requestedPriority as ValidatedCreateTicketRequest['requestedPriority'],
    },
  };
}
