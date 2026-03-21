import type { ApiErrorBody } from "./types";

const API_PREFIX = "/api/v1";

/** When set, requests go to `VITE_API_BASE_URL` + `/api/v1`; otherwise same-origin (Vite proxy in dev). */
function originBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  return raw ? raw.replace(/\/$/, "") : "";
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${originBase()}${API_PREFIX}${p}`;
}

const ACCESS_KEY = "cute_cat_access";
const REFRESH_KEY = "cute_cat_refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<void> | null = null;

async function refreshAccess(): Promise<void> {
  const rt = getRefreshToken();
  if (!rt) throw new Error("NO_REFRESH");
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) {
    clearTokens();
    throw new Error("REFRESH_FAILED");
  }
  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  setTokens(data.accessToken, data.refreshToken);
}

/** Single-flight refresh to avoid parallel 401 storms. */
function ensureRefreshed(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshAccess().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    const e = body.error;
    if (e?.message) {
      return new ApiRequestError(res.status, e.code ?? "ERROR", e.message, e.details);
    }
  } catch {
    /* ignore */
  }
  return new ApiRequestError(res.status, "HTTP_ERROR", res.statusText || "Request failed");
}

export interface HttpOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Authenticated JSON fetch. On 401, rotates refresh once and retries (except for /auth/refresh).
 */
export async function httpJson<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { body, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const at = getAccessToken();
  if (at) headers.set("Authorization", `Bearer ${at}`);

  const url = apiUrl(path);
  const doFetch = () =>
    fetch(url, {
      ...rest,
      headers,
      body:
        body !== undefined && body !== null && !(body instanceof FormData)
          ? JSON.stringify(body)
          : (body as BodyInit | null | undefined),
    });

  let res = await doFetch();
  if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    try {
      await ensureRefreshed();
      headers.set("Authorization", `Bearer ${getAccessToken()}`);
      res = await fetch(url, {
        ...rest,
        headers,
        body:
          body !== undefined && body !== null && !(body instanceof FormData)
            ? JSON.stringify(body)
            : (body as BodyInit | null | undefined),
      });
    } catch {
      throw new ApiRequestError(401, "UNAUTHORIZED", "Session expired");
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Public health check (no auth). */
export async function fetchHealth(): Promise<{ status: string }> {
  const base = originBase();
  const url = base ? `${base}/api/v1/health` : "/api/v1/health";
  const res = await fetch(url);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { status: string };
}
