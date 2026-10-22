const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname.endsWith(".onrender.com")
    ? "https://task-manager-qszt.onrender.com"
    : "http://localhost:3000");

// Helper to fetch with a timeout and automatic retry (crucial for Render free-tier cold starts)
async function fetchWithRetry(url, options = {}, maxRetries = 2, delayMs = 2000) {
  const method = (options.method || "GET").toUpperCase();
  const isSafeToRetry = method === "GET" || method === "HEAD";
  const timeoutMs = options.timeoutMs || (isSafeToRetry ? 30000 : 25000);
  const retries = isSafeToRetry ? maxRetries : 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        throw err;
      }
      // Wait before retrying (Render takes ~30-50s to wake from sleep)
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetchWithRetry(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    console.warn("[API] Connection attempt failed:", err.message);
    throw new Error(
      "Unable to connect to the server. The free backend may still be waking up. Please retry in a few moments."
    );
  }

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(new Event("session-expired"));

    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const err = new Error(
      data?.message || "Something went wrong. Please try again."
    );
    err.code = data?.code;
    err.status = response.status;
    throw err;
  }

  if (options.responseType === "blob") {
    return await response.blob();
  }

  const data = await response.json().catch(() => null);
  return data;
}

// Helper for fetching binary data (blobs) with auth headers
export async function apiBlob(path) {
  return apiRequest(path, { responseType: "blob" });
}

// Helper for sending FormData (file uploads) without setting Content-Type manually
export async function apiUpload(path, formData, method = "POST") {
  const token = localStorage.getItem("token");

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetchWithRetry(
      `${API_URL}${path}`,
      {
        method,
        headers,
        body: formData,
        timeoutMs: 35000,
      },
      1,
      2500
    );
  } catch (err) {
    console.warn("[API] Upload failed:", err.message);
    throw new Error(
      "Unable to upload to the server. Please check your connection and retry."
    );
  }

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("session-expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const err = new Error(
      data?.message || "Something went wrong. Please try again."
    );
    err.code = data?.code;
    err.status = response.status;
    throw err;
  }

  const data = await response.json().catch(() => null);
  return data;
}
