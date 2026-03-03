const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
};

export type FxRate = {
  date: string;
  usd_brl_rate: number;
};

export type FxRateListResponse = {
  rates: FxRate[];
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    let message = "Erro na API";
    try {
      const data = await response.json();
      message = data.detail || JSON.stringify(data);
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function uploadReport(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData
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
