export interface MaintenanceRecord {
  id: number;
  maintenanceType: string;
  performedOn: string;
  mileageKm: number;
  cost: number | null;
  memo: string | null;
}

export interface MaintenanceRecordInput {
  maintenanceType: string;
  performedOn: string;
  mileageKm: number;
  cost: number | null;
  memo: string | null;
}

export interface MaintenanceSummaryEntry {
  maintenanceType: string;
  lastPerformedOn: string | null;
  lastMileageKm: number | null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'bikeMaintenanceAuthToken';

export function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

function isErrorBody(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof (value as { error: unknown }).error === 'string';
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = isErrorBody(data) ? data.error : `リクエストに失敗しました (status: ${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function signup(email: string, password: string): Promise<void> {
  await apiRequest('/auth/signup', { method: 'POST', body: { email, password } });
}

export async function login(email: string, password: string): Promise<string> {
  const data = await apiRequest<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
  return data.token;
}

export async function logout(token: string): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST', token });
}

export async function listRecords(token: string): Promise<MaintenanceRecord[]> {
  return apiRequest<MaintenanceRecord[]>('/maintenance-records', { token });
}

export async function createRecord(token: string, input: MaintenanceRecordInput): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>('/maintenance-records', { method: 'POST', token, body: input });
}

export async function updateRecord(
  token: string,
  id: number,
  input: MaintenanceRecordInput,
): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>(`/maintenance-records/${id}`, { method: 'PATCH', token, body: input });
}

export async function deleteRecord(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/maintenance-records/${id}`, { method: 'DELETE', token });
}

export async function getSummary(token: string): Promise<MaintenanceSummaryEntry[]> {
  return apiRequest<MaintenanceSummaryEntry[]>('/maintenance-records/summary', { token });
}
