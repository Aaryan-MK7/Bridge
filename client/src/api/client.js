import { API_URL } from '../config/api.js';
import { getApiErrorMessage, sanitizeEmployee } from '../lib/contracts.js';

const SESSION_STORAGE_KEY = 'bridge.session';
const UNAUTHORIZED_EVENT = 'bridge:unauthorized';
let accessToken = null;

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function loadStoredSession() {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const employee = sanitizeEmployee(parsed.employee);
    if (!parsed.token || !employee) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return { token: parsed.token, employee };
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function storeSession(session) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  accessToken = session.token;
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  accessToken = null;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

function parseFilename(disposition) {
  if (!disposition) return null;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) return decodeURIComponent(utfMatch[1].replace(/["']/g, ''));
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || null;
}

async function readPayload(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => '');
}

export async function apiRequest(path, options = {}) {
  const {
    body,
    headers: providedHeaders,
    responseType = 'json',
    signal,
    ...requestOptions
  } = options;
  const headers = new Headers(providedHeaders || {});
  headers.set('Accept', responseType === 'blob' ? '*/*' : 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      body: body === undefined || isFormData ? body : JSON.stringify(body),
      credentials: 'include',
      headers,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach Bridge. Check your connection and try again.');
  }

  if (!response.ok) {
    const payload = await readPayload(response);
    if (response.status === 401 && accessToken) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      getApiErrorMessage(payload, `Request failed with status ${response.status}.`),
      { status: response.status, payload },
    );
  }

  if (responseType === 'blob') {
    return {
      blob: await response.blob(),
      filename: parseFilename(response.headers.get('content-disposition')),
    };
  }

  return readPayload(response);
}

export function subscribeToUnauthorized(listener) {
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener);
}

export function downloadBlob(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
