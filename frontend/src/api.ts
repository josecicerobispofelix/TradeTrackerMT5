const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:8000");

export type UploadResponse = {
  file_already_imported: boolean;
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  account?: string | null;
  message: string;
};

export type DailySummary = {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  net_profit: number;
  profit_factor?: number | null;
  fx_rate?: number | null;
  net_profit_brl?: number | null;
};

export type SummaryResponse = {
  month: string;
  total_trades: number;
  total_net_profit: number;
  total_net_profit_brl?: number | null;
  daily: DailySummary[];
};

export type Trade = {
  id: number;
  account: string;
  symbol: string;
  side: string;
  volume: number;
  open_time: string;
  close_time: string;
  open_price: number;
  close_price: number;
  profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  net_profit_brl?: number | null;
  fx_rate?: number | null;
  currency?: string | null;
  deal_id?: string | null;
};

export type TradeListResponse = {
  trades: Trade[];
  total: number;
};

export type TradeMetaResponse = {
  symbols: string[];
  accounts: string[];
  suggested_account?: string | null;
  suggested_broker?: string | null;
};

export type FxRate = {
  date: string;
  usd_brl_rate: number;
};

export type FxRateListResponse = {
  rates: FxRate[];
};

export type FiscalProfile = {
  id?: number;
  user_id?: number;
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  broker?: string | null;
  trading_account?: string | null;
  account_currency?: string | null;
  tax_rate?: number | null;
  fx_source?: string | null;
};

export type DarfCalcRequest = {
  month: number;
  year: number;
  fx_rate?: number | null;
  tax_rate?: number | null;
};

export type DarfCalcResponse = {
  month: number;
  year: number;
  trades_count: number;
  profit_usd: number;
  profit_brl: number;
  fx_rate: number;
  tax_rate: number;
  tax_due: number;
  currency: string;
  message?: string | null;
};

export type DarfHistoryItem = {
  month: number;
  year: number;
  trades_count: number;
  profit_usd: number;
  profit_brl: number;
  fx_rate: number;
  tax_rate: number;
  tax_due: number;
  currency: string;
};

export type DarfHistoryResponse = {
  items: DarfHistoryItem[];
};

export type LicenseStatus = {
  activated: boolean;
  machine_code: string;
};

function normalizeErrorMessage(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }
  if (Array.isArray(payload)) {
    const parts = payload
      .map((item) => normalizeErrorMessage(item))
      .filter((item) => item.trim().length > 0);
    if (parts.length > 0) {
      return parts.join(" | ");
    }
    return "";
  }
  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (obj.detail !== undefined) {
      return normalizeErrorMessage(obj.detail);
    }
    if (obj.message !== undefined) {
      return normalizeErrorMessage(obj.message);
    }
    if (obj.msg !== undefined) {
      return normalizeErrorMessage(obj.msg);
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  return String(payload);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options
  });
  if (!response.ok) {
    let message = "Erro na API";
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        const normalized = normalizeErrorMessage(data);
        if (normalized) {
          message = normalized;
        } else {
          message = text;
        }
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export type User = {
  id: number;
  email: string;
};

export type AuthMessage = {
  message: string;
  reset_token?: string;
};

export type MessageResponse = {
  message: string;
};

export async function uploadReport(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData
  });
}

export async function deleteAllUploads(): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/upload/all", {
    method: "DELETE"
  });
}

export async function fetchSummary(month: string): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>(`/api/summary?month=${month}`);
}

export async function fetchTrades(params: {
  from?: string;
  to?: string;
  symbol?: string;
  account?: string;
}): Promise<TradeListResponse> {
  const search = new URLSearchParams();
  if (params.from) search.append("from", params.from);
  if (params.to) search.append("to", params.to);
  if (params.symbol) search.append("symbol", params.symbol);
  if (params.account) search.append("account", params.account);
  return apiFetch<TradeListResponse>(`/api/trades?${search.toString()}`);
}

export async function fetchTradeMeta(params?: {
  from?: string;
  to?: string;
}): Promise<TradeMetaResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.append("from", params.from);
  if (params?.to) search.append("to", params.to);
  const query = search.toString();
  return apiFetch<TradeMetaResponse>(
    `/api/trades/meta${query ? `?${query}` : ""}`
  );
}

export async function getFxRate(date?: string): Promise<FxRate> {
  const search = date ? `?date=${date}` : "";
  return apiFetch<FxRate>(`/api/fx-rate${search}`);
}

export async function listFxRates(params?: {
  from?: string;
  to?: string;
}): Promise<FxRateListResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.append("from", params.from);
  if (params?.to) search.append("to", params.to);
  const query = search.toString();
  return apiFetch<FxRateListResponse>(
    `/api/fx-rate/list${query ? `?${query}` : ""}`
  );
}

export async function fetchFxHistory(days = 30): Promise<FxRateListResponse> {
  const search = new URLSearchParams();
  if (days) search.append("days", String(days));
  return apiFetch<FxRateListResponse>(`/api/fx-rate/history?${search.toString()}`);
}

export async function setFxRate(payload: FxRate): Promise<FxRate> {
  return apiFetch<FxRate>("/api/fx-rate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function fetchFxRateAuto(date?: string): Promise<FxRate> {
  const search = date ? `?date=${date}` : "";
  return apiFetch<FxRate>(`/api/fx-rate/auto${search}`);
}

export async function fetchFiscalProfile(): Promise<FiscalProfile> {
  return apiFetch<FiscalProfile>("/api/fiscal-profile");
}

export async function saveFiscalProfile(
  payload: FiscalProfile
): Promise<FiscalProfile> {
  return apiFetch<FiscalProfile>("/api/fiscal-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function calculateDarf(
  payload: DarfCalcRequest
): Promise<DarfCalcResponse> {
  return apiFetch<DarfCalcResponse>("/api/darf/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function fetchDarfHistory(): Promise<DarfHistoryResponse> {
  return apiFetch<DarfHistoryResponse>("/api/darf/history");
}

export async function downloadDarfPdf(
  payload: DarfCalcRequest
): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/darf/pdf`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "Erro ao gerar PDF";
    if (text) {
      try {
        const data = JSON.parse(text);
        const normalized = normalizeErrorMessage(data);
        if (normalized) {
          message = normalized;
        } else {
          message = text;
        }
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  return response.blob();
}

export async function saveDarfPdfFile(
  payload: DarfCalcRequest
): Promise<{ path: string; filename: string }> {
  return apiFetch<{ path: string; filename: string }>("/api/darf/pdf/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  return apiFetch<LicenseStatus>("/api/license/status");
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  return apiFetch<LicenseStatus>("/api/license/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ key })
  });
}

export async function registerUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function logoutUser(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", {
    method: "POST"
  });
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export async function requestPasswordReset(email: string): Promise<AuthMessage> {
  return apiFetch<AuthMessage>("/api/auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(payload: {
  token: string;
  new_password: string;
}): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
