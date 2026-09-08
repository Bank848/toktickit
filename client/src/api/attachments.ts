import { ApiError } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface AttachmentDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; displayName: string };
  status: 'ACTIVE' | 'REMOVED';
  downloadUrl: string | null;
  removal: { reason: string; removedAt: string; removedBy: { id: string; displayName: string } } | null;
}

export async function uploadAttachment(ticketId: string, file: File): Promise<AttachmentDto> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error?.message ?? `Failed to upload ${file.name}`,
      response.status,
      body?.error?.fieldErrors ?? [],
    );
  }
  return response.json();
}

async function throwAttachmentError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error?.message ?? fallbackMessage, response.status, body?.error?.fieldErrors ?? []);
}

export async function fetchAttachments(ticketId: string): Promise<AttachmentDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/attachments`, {
    credentials: 'include',
  });
  if (!response.ok) {
    return throwAttachmentError(response, 'Failed to load attachments');
  }
  return response.json();
}

export async function removeAttachment(attachmentId: string, reason: string): Promise<AttachmentDto> {
  const response = await fetch(`${API_BASE_URL}/api/v1/attachments/${attachmentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    return throwAttachmentError(response, 'Failed to remove attachment');
  }
  return response.json();
}
