const DEFAULT_DIRECTUS_URL = "https://apipre.mueblesavenida.com";
const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL || DEFAULT_DIRECTUS_URL).replace(/\/+$/, "");
const SESSION_KEY = "torneos_mtg_directus_session";

export function getDirectusUrl() {
  return DIRECTUS_URL;
}

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function directusError(payload, fallback) {
  const message = payload?.errors?.[0]?.message || payload?.message || fallback;
  const error = new Error(message);
  error.payload = payload;
  return error;
}

export async function login(email, password) {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, mode: "json" })
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw directusError(payload, "No se pudo iniciar sesion.");
  }

  const session = {
    accessToken: payload.data.access_token,
    refreshToken: payload.data.refresh_token,
    expiresAt: Date.now() + Number(payload.data.expires || 0)
  };
  saveSession(session);
  return session;
}

export async function refreshSession(session) {
  if (!session?.refreshToken) return null;

  const response = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken, mode: "json" })
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    clearSession();
    return null;
  }

  const nextSession = {
    accessToken: payload.data.access_token,
    refreshToken: payload.data.refresh_token,
    expiresAt: Date.now() + Number(payload.data.expires || 0)
  };
  saveSession(nextSession);
  return nextSession;
}

export async function logout(session) {
  if (session?.refreshToken) {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken, mode: "json" })
    }).catch(() => {});
  }
  clearSession();
}

export async function directusRequest(path, options = {}, session, onSessionChange) {
  let activeSession = session;

  if (activeSession?.expiresAt && activeSession.expiresAt - Date.now() < 30000) {
    activeSession = await refreshSession(activeSession);
    onSessionChange?.(activeSession);
  }

  const headers = {
    Accept: "application/json",
    ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(activeSession?.accessToken ? { Authorization: `Bearer ${activeSession.accessToken}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await parseResponse(response);

  if (response.status === 401) {
    clearSession();
    onSessionChange?.(null);
    throw directusError(payload, "La sesion ha caducado.");
  }

  if (!response.ok) {
    throw directusError(payload, "Directus ha devuelto un error.");
  }

  return payload;
}

export function listItems(collection, query, session, onSessionChange) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return directusRequest(`/items/${collection}${suffix}`, {}, session, onSessionChange).then((payload) => payload.data || []);
}

export function createItem(collection, data, session, onSessionChange) {
  return directusRequest(`/items/${collection}`, { method: "POST", body: data }, session, onSessionChange).then((payload) => payload.data);
}

export function updateItem(collection, id, data, session, onSessionChange) {
  return directusRequest(`/items/${collection}/${id}`, { method: "PATCH", body: data }, session, onSessionChange).then((payload) => payload.data);
}

export function deleteItem(collection, id, session, onSessionChange) {
  return directusRequest(`/items/${collection}/${id}`, { method: "DELETE" }, session, onSessionChange);
}
