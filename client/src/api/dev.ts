const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface DevRequester {
  id: string;
  email: string;
  displayName: string;
}

export async function fetchDevRequesters(): Promise<DevRequester[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dev/requesters`);
  if (!response.ok) throw new Error('Failed to load Development Requesters');
  return response.json();
}

export async function selectDevRequester(userId: string): Promise<DevRequester> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dev/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error('Failed to select Development Requester');
  return response.json();
}
