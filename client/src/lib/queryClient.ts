import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authStorage, getAuthHeaders } from "./auth";

async function throwIfResNotOk(res: Response, urlForContext?: string) {
  if (!res.ok) {
    // Handle auth errors specifically
    if (res.status === 401 || res.status === 403) {
      const url = String(urlForContext || '');
      const isAuthEndpoint = /\/api\/auth\//.test(url);
      if (!isAuthEndpoint) {
        authStorage.clear();
        // Redirect to root where the router will render the LoginPage.
        // This avoids hitting a non-existent /login route (404).
        window.location.href = '/';
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // For GET requests to API endpoints, append a cache-busting query param
  let requestUrl = url;
  if (method.toUpperCase() === 'GET' && /^\/?api\//.test(url.replace(/^\//, ''))) {
    const sep = url.includes('?') ? '&' : '?';
    requestUrl = `${url}${sep}_ts=${Date.now()}`;
  }
  const res = await fetch(requestUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    // Ensure we always bypass browser cache on API calls
    cache: 'no-store',
  });

  await throwIfResNotOk(res, requestUrl);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL and add cache-busting for GETs
    let qUrl = queryKey.join("/") as string;
    if (/^\/?api\//.test(qUrl.replace(/^\//, ''))) {
      const sep = qUrl.includes('?') ? '&' : '?';
      qUrl = `${qUrl}${sep}_ts=${Date.now()}`;
    }
    const res = await fetch(qUrl, {
      headers: getAuthHeaders(),
      // Bypass cache for default queryFn as well
      cache: 'no-store',
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res, qUrl);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Upload a single file to /api/uploads using multipart/form-data
export async function apiUploadFile(file: File): Promise<{ url: string; mime: string; size: number; originalName: string }>
{
  const form = new FormData();
  form.append("file", file);
  const uploadUrl = `${window.location.origin}/api/uploads`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      // DO NOT set Content-Type for multipart; browser will set boundary
      ...getAuthHeaders(),
    } as any,
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${t}`);
  }
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!/application\/json/.test(ct)) {
    // Likely got an HTML page (e.g., dev server fallback). Surface details.
    const snippet = text.slice(0, 120);
    throw new Error(`Unexpected response from /api/uploads. Expected JSON but got '${ct}'. Snippet: ${snippet}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from /api/uploads: ${(e as Error).message}`);
  }
}
