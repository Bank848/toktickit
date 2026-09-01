// Small helpers for the two reference-data lookups CreateTicketPage needs on mount. Not part of
// the plan's literal tickets.ts/attachments.ts contract (those cover tickets and attachments
// only) -- GET /categories and GET /related-systems already existed server-side (W4-1/earlier)
// but had no client wrapper yet, so this file adds one rather than inlining fetch() in the page.
import { authHeaders } from './tickets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface CategoryDto {
  id: number;
  name: string;
}

export interface RelatedSystemDto {
  id: number;
  code: string;
  name: string;
}

export async function fetchCategories(requesterId: string): Promise<CategoryDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories`, {
    headers: authHeaders(requesterId),
  });
  if (!response.ok) throw new Error('Failed to load categories');
  return response.json();
}

export async function fetchRelatedSystems(requesterId: string): Promise<RelatedSystemDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/related-systems`, {
    headers: authHeaders(requesterId),
  });
  if (!response.ok) throw new Error('Failed to load related systems');
  return response.json();
}
