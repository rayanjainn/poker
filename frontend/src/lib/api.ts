const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
      }
    }
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    register: (data: {
      username: string;
      email: string;
      password: string;
      display_name?: string;
    }) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { username: string; password: string }) =>
      request("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
    guest: () => request("/api/auth/guest", { method: "POST" }),
  },
  users: {
    me: () => request("/api/users/me"),
  },
  tables: {
    list: () => request("/api/tables"),
    create: (data: {
      name: string;
      is_private: boolean;
      small_blind: number;
      big_blind: number;
      min_buy_in: number;
      max_buy_in: number;
      max_players: number;
      variant?: string;
    }) => request("/api/tables", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => request(`/api/tables/${id}`),
  },
  leaderboard: {
    get: () => request("/api/leaderboard"),
  },
  fairness: {
    verify: (handId: string) => request(`/api/fairness/${handId}`),
  },
};
