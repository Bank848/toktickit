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

export async function fetchCategories(): Promise<CategoryDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to load categories');
  return response.json();
}

export async function fetchRelatedSystems(): Promise<RelatedSystemDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/related-systems`, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to load related systems');
  return response.json();
}
