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

export async function uploadAttachment(
  requesterId: string,
  ticketId: string,
  file: File,
): Promise<AttachmentDto> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/attachments`, {
    method: 'POST',
    headers: { 'x-dev-user-id': requesterId },
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
