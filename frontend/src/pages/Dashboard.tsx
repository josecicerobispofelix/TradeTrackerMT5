import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  fetchFxRateAuto,
  listFxRates,
  fetchTradeMeta,
  fetchTrades,
  fetchFiscalProfile,
  saveFiscalProfile,
  getFxRate,
  setFxRate,
  fetchFxHistory,
  calculateDarf,
  fetchDarfHistory,
  downloadDarfPdf,
  Trade,
  FiscalProfile,
  FxRate,
  DarfCalcResponse,
  DarfHistoryItem
} from "../api";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const TAX_RATE = 0.15;
const MS_DAY = 24 * 60 * 60 * 1000;

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return monthKey;
  const date = new Date(parsedYear, parsedMonth - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function getMonthRange(monthKey: string) {
  if (!monthKey) return { from: "", to: "" };
  const [year, month] = monthKey.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
    return { from: "", to: "" };
  }
  const start = new Date(parsedYear, parsedMonth - 1, 1);
  const end = new Date(parsedYear, parsedMonth, 0);
  return { from: toDateInput(start), to: toDateInput(end) };
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeProfile(data?: FiscalProfile | null): FiscalProfile {
  return {
    full_name: data?.full_name ?? "",
    cpf: data?.cpf ?? "",
    birth_date: data?.birth_date ?? "",
    cep: data?.cep ?? "",
    street: data?.street ?? "",
    number: data?.number ?? "",
    complement: data?.complement ?? "",
    neighborhood: data?.neighborhood ?? "",
    city: data?.city ?? "",
    state: data?.state ?? "",
    broker: data?.broker ?? "",
    trading_account: data?.trading_account ?? "",
    account_currency: data?.account_currency ?? "USD",
    tax_rate: data?.tax_rate ?? 0.15,
    fx_source: data?.fx_source ?? "manual"
  };
}

function buildDateRange(from: string, to: string) {
  if (!from || !to) return [] as string[];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [] as string[];
  }
  const safeStart = start <= end ? start : end;
  const safeEnd = start <= end ? end : start;
  const days: string[] = [];
  const cursor = new Date(safeStart);
  while (cursor <= safeEnd) {
    days.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatCurrency(value: number, currency: "USD" | "BRL") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(safe);
}

function formatNumber(value: number, digits = 2) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatPercent(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(2)}%`;
}

function buildFxSeries(rates: FxRate[], days = 30): FxRate[] {
  if (!rates.length) return [];
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map(sorted.map((item) => [item.date, item.usd_brl_rate]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  let lastValue = sorted[0].usd_brl_rate;
  const series: FxRate[] = [];

  for (
    const cursor = new Date(start);
    cursor <= today;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = toDateInput(cursor);
    const value = map.get(key);
    if (value != null) {
      lastValue = value;
    }
    series.push({ date: key, usd_brl_rate: lastValue });
  }

  return series;
}

function getHeatColor(value: number, maxAbs: number) {
  const safeMax = maxAbs <= 0 ? 1 : maxAbs;
  const intensity = Math.min(Math.abs(value) / safeMax, 1);
  const alpha = 0.15 + intensity * 0.75;
  if (value >= 0) {
    return `rgba(34, 197, 94, ${alpha})`;
  }
  return `rgba(239, 68, 68, ${alpha})`;
}

function calculateStreaks(trades: Trade[], getNet: (trade: Trade) => number) {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.close_time).getTime() - new Date(b.close_time).getTime()
  );
  let currentWin = 0;
  let currentLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  for (const trade of sorted) {
    const net = getNet(trade);
    if (net > 0) {
      currentWin += 1;
      currentLoss = 0;
    } else if (net < 0) {
      currentLoss += 1;
      currentWin = 0;
    } else {
      currentWin = 0;
      currentLoss = 0;
    }
    maxWin = Math.max(maxWin, currentWin);
    maxLoss = Math.max(maxLoss, currentLoss);
  }
  return { maxWin, maxLoss };
}

function calculateDrawdown(values: number[]) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = value - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return Math.abs(maxDrawdown);
}
function computeMetrics(
  trades: Trade[],
  currency: "USD" | "BRL",
  from: string,
  to: string,
  fxFallback: number | null
) {
  let net = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let costs = 0;
  let wins = 0;
  let losses = 0;
  let maxWin = -Infinity;
  let maxLoss = Infinity;
  const dayKeys = buildDateRange(from, to);
  const dailyMap = new Map<
    string,
    { net: number; trades: number; wins: number; losses: number }
  >();
  const dayOfWeek = DAYS.map((label) => ({
    label,
    net: 0,
    trades: 0
  }));
  const heatmap = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  const getProfitValue = (trade: Trade) => {
    const base = trade.profit;
    if (currency === "USD") return base;
    if (trade.currency?.toUpperCase() === "BRL") return base;
    if (trade.fx_rate != null) return base * trade.fx_rate;
    if (fxFallback != null) return base * fxFallback;
    return base;
  };

  const getCostValue = (trade: Trade) => {
    const base = trade.commission + trade.swap;
    if (currency === "USD") return base;
    if (trade.currency?.toUpperCase() === "BRL") return base;
    if (trade.fx_rate != null) return base * trade.fx_rate;
    if (fxFallback != null) return base * fxFallback;
    return base;
  };

  const getNetValue = (trade: Trade) => getProfitValue(trade) + getCostValue(trade);

  for (const trade of trades) {
    const profitValue = getProfitValue(trade);
    const costValue = getCostValue(trade);
    const netValue = profitValue + costValue;
    net += netValue;
    costs += costValue;
    if (profitValue >= 0) {
      grossProfit += profitValue;
      wins += 1;
      maxWin = Math.max(maxWin, profitValue);
    } else {
      grossLoss += profitValue;
      losses += 1;
      maxLoss = Math.min(maxLoss, profitValue);
    }

    const closeDate = new Date(trade.close_time);
    const dateKey = toDateKey(closeDate);
    const daily = dailyMap.get(dateKey) ?? {
      net: 0,
      trades: 0,
      wins: 0,
      losses: 0
    };
    daily.net += netValue;
    daily.trades += 1;
    if (profitValue > 0) daily.wins += 1;
    if (profitValue < 0) daily.losses += 1;
    dailyMap.set(dateKey, daily);

    const dow = closeDate.getDay();
    const hour = closeDate.getHours();
    if (dayOfWeek[dow]) {
      dayOfWeek[dow].net += netValue;
      dayOfWeek[dow].trades += 1;
    }
    if (heatmap[dow] && heatmap[dow][hour] != null) {
      heatmap[dow][hour] += netValue;
    }
  }

  if (!Number.isFinite(maxWin)) maxWin = 0;
  if (!Number.isFinite(maxLoss)) maxLoss = 0;

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(grossLoss) / losses : 0;
  const profitFactor = grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0;

  const dailyData = dayKeys.map((key) => {
    const daily = dailyMap.get(key) ?? {
      net: 0,
      trades: 0,
      wins: 0,
      losses: 0
    };
    return {
      date: key,
      day: key.slice(8),
      net: daily.net,
      trades: daily.trades,
      wins: daily.wins,
      losses: daily.losses
    };
  });

  let cumulative = 0;
  const equityData = dailyData.map((day) => {
    cumulative += day.net;
    return {
      ...day,
      cumulative
    };
  });

  const drawdown = calculateDrawdown(equityData.map((item) => item.cumulative));

  let heatMax = 0;
  for (const row of heatmap) {
    for (const value of row) {
      heatMax = Math.max(heatMax, Math.abs(value));
    }
  }

  const streaks = calculateStreaks(trades, getProfitValue);

  return {
    net,
    grossProfit,
    grossLoss,
    costs,
    wins,
    losses,
    totalTrades,
    winRate,
    avgWin,
    avgLoss,
    maxWin,
    maxLoss,
    profitFactor,
    payoff,
    drawdown,
    dailyData,
    equityData,
    dayOfWeek,
    heatmap,
    heatMax: heatMax || 1,
    streakWin: streaks.maxWin,
    streakLoss: streaks.maxLoss
  };
}

export default function Dashboard() {
  const now = new Date();
  const initialGoalMonth = toMonthKey(now);
  const navigate = useNavigate();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [from, setFrom] = useState(toDateInput(startOfMonth));
  const [to, setTo] = useState(toDateInput(now));
  const [symbol, setSymbol] = useState("");
  const [account, setAccount] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedHours, setSelectedHours] = useState<number[]>(HOURS);
  const [useBrl, setUseBrl] = useState(true);
  const [goalMonth, setGoalMonth] = useState(initialGoalMonth);
  const [goalNet, setGoalNet] = useState<number>(() => {
    const stored = localStorage.getItem(`ttmt5_goal_net_brl_${initialGoalMonth}`);
    return stored ? Number(stored) : 3000;
  });
  const [fxDate, setFxDate] = useState(toDateInput(now));
  const [fxRateInput, setFxRateInput] = useState("");
  const [fxRate, setFxRateValue] = useState<number | null>(null);
  const [fxStatus, setFxStatus] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxHistory, setFxHistory] = useState<FxRate[]>([]);
  const [fxHistoryLoading, setFxHistoryLoading] = useState(false);
  const fxLineDot = useMemo(
    () =>
      fxHistory.length <= 1
        ? { r: 3, strokeWidth: 2, fill: "#38bdf8" }
        : false,
    [fxHistory.length]
  );

  const [darfMonth, setDarfMonth] = useState(now.getMonth() + 1);
  const [darfYear, setDarfYear] = useState(now.getFullYear());
  const [darfFx, setDarfFx] = useState("");
  const [darfTax, setDarfTax] = useState("");
  const [darfResult, setDarfResult] = useState<DarfCalcResponse | null>(null);
  const [darfHistory, setDarfHistory] = useState<DarfHistoryItem[]>([]);
  const [darfStatus, setDarfStatus] = useState<string | null>(null);
  const [darfLoading, setDarfLoading] = useState(false);

  const [profileCollapsed, setProfileCollapsed] = useState(false);
  const [profile, setProfile] = useState<FiscalProfile>(() => normalizeProfile());
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<string | null>(null);

  useEffect(() => {
    const legacy = localStorage.getItem("ttmt5_goal_net_brl");
    if (legacy && !localStorage.getItem(`ttmt5_goal_net_brl_${initialGoalMonth}`)) {
      localStorage.setItem(`ttmt5_goal_net_brl_${initialGoalMonth}`, legacy);
    }
  }, [initialGoalMonth]);

  useEffect(() => {
    const stored = localStorage.getItem(`ttmt5_goal_net_brl_${goalMonth}`);
    if (stored != null && stored !== "") {
      const value = Number(stored);
      if (Number.isFinite(value)) {
        setGoalNet(value);
        return;
      }
    }
    setGoalNet(3000);
  }, [goalMonth]);

  useEffect(() => {
    localStorage.setItem(`ttmt5_goal_net_brl_${goalMonth}`, String(goalNet));
  }, [goalNet, goalMonth]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const response = await fetchTradeMeta({
        from: from || undefined,
        to: to || undefined
      });
      setSymbols(response.symbols);
      setAccounts(response.accounts);
      if (symbol && !response.symbols.includes(symbol)) {
        setSymbol("");
      }
      if (account && !response.accounts.includes(account)) {
        setAccount("");
      }
    } catch {
      setSymbols([]);
      setAccounts([]);
    } finally {
      setMetaLoading(false);
    }
  }, [from, to, symbol, account]);

  const loadTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTrades({
        from: from || undefined,
        to: to || undefined,
        symbol: symbol || undefined,
        account: account || undefined
      });
      setTrades(response.trades);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to, symbol, account]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileStatus(null);
    try {
      const response = await fetchFiscalProfile();
      const normalized = normalizeProfile(response);
      setProfile(normalized);
      if (normalized.full_name && normalized.cpf) {
        setProfileCollapsed(true);
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message.toLowerCase().includes("perfil fiscal")) {
        setProfileStatus("Perfil fiscal ainda não cadastrado.");
      } else {
        setProfileStatus(message);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadDarfHistory = useCallback(async () => {
    try {
      const response = await fetchDarfHistory();
      setDarfHistory(response.items);
    } catch {
      setDarfHistory([]);
    }
  }, []);

  useEffect(() => {
    loadDarfHistory();
  }, [loadDarfHistory]);

  const buildDarfPayload = () => {
    const fx = Number(darfFx);
    const tax = Number(darfTax);
    return {
      month: Number(darfMonth),
      year: Number(darfYear),
      fx_rate: Number.isFinite(fx) && fx > 0 ? fx : undefined,
      tax_rate: Number.isFinite(tax) && tax > 0 ? tax / 100 : undefined
    };
  };

  const handleCalcDarf = async () => {
    setDarfLoading(true);
    setDarfStatus(null);
    try {
      const payload = buildDarfPayload();
      const result = await calculateDarf(payload);
      setDarfResult(result);
      setDarfStatus(result.message || "Cálculo concluído.");
      loadDarfHistory();
    } catch (err) {
      setDarfResult(null);
      setDarfStatus((err as Error).message);
    } finally {
      setDarfLoading(false);
    }
  };

  const handlePdfDarf = async () => {
    setDarfLoading(true);
    setDarfStatus(null);
    try {
      const payload = buildDarfPayload();
      const blob = await downloadDarfPdf(payload);
      const filename = `DARF_${String(payload.month).padStart(2, "0")}_${payload.year}.pdf`;

      // Baixa diretamente sem abrir nova aba para evitar prompt de "blob link" no WebView2
      const nav: any = window.navigator;
      if (nav && typeof nav.msSaveOrOpenBlob === "function") {
        nav.msSaveOrOpenBlob(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        link.target = "_self";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1000);
      }

      setDarfStatus("PDF gerado.");
    } catch (err) {
      setDarfStatus((err as Error).message);
    } finally {
      setDarfLoading(false);
    }
  };

  const lookupCep = useCallback(async (rawCep: string) => {
    const cep = onlyDigits(rawCep);
    if (cep.length !== 8) {
      setCepStatus("Informe 8 dígitos do CEP.");
      return;
    }
    setCepStatus("Buscando CEP...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        cache: "no-store",
        mode: "cors"
      });
      const data = await response.json();
      if (data.erro) {
        setCepStatus("CEP não encontrado.");
        return;
      }
      setProfile((prev) => ({
        ...prev,
        cep: cep,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state
      }));
      setCepStatus("Endereço preenchido pelo CEP.");
    } catch (err) {
      setCepStatus((err as Error).message);
    }
  }, []);

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileStatus(null);
    try {
      const response = await saveFiscalProfile(profile);
      const normalized = normalizeProfile(response);
      setProfile(normalized);
      setProfileStatus("Perfil fiscal salvo.");
    } catch (err) {
      setProfileStatus((err as Error).message);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTrades();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadTrades]);

  const loadFxRate = useCallback(
    async (date: string) => {
      setFxLoading(true);
      setFxStatus(null);
      try {
        const response = await getFxRate(date);
        setFxRateValue(response.usd_brl_rate);
        setFxRateInput(String(response.usd_brl_rate));
      } catch (err) {
        setFxRateValue(null);
        setFxStatus("Nenhuma taxa salva para esta data.");
      } finally {
        setFxLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadFxRate(fxDate);
  }, [fxDate, loadFxRate]);

  const loadFxHistory = useCallback(async () => {
    setFxHistoryLoading(true);
    try {
      const response = await fetchFxHistory(30);
      setFxHistory(buildFxSeries(response.rates));
    } catch {
      if (fxRate != null) {
        setFxHistory(buildFxSeries([{ date: toDateInput(new Date()), usd_brl_rate: fxRate }]));
      } else {
        setFxHistory([]);
      }
    } finally {
      setFxHistoryLoading(false);
    }
  }, [fxDate, fxRate]);

  useEffect(() => {
    loadFxHistory();
  }, [loadFxHistory]);

  useEffect(() => {
    if (fxRate != null) {
      setDarfFx(fxRate.toFixed(4));
    }
  }, [fxRate]);

  useEffect(() => {
    if (profile?.tax_rate != null) {
      setDarfTax(String(Number(profile.tax_rate) * 100));
    }
  }, [profile?.tax_rate]);

  const currentDarf = useMemo(() => {
    if (darfResult) return darfResult;
    if (darfHistory.length) return darfHistory[0];
    return null;
  }, [darfResult, darfHistory]);

  const handleSaveFx = async () => {
    const value = Number(fxRateInput);
    if (!Number.isFinite(value) || value <= 0) {
        setFxStatus("Informe uma taxa válida.");
      return;
    }
    setFxLoading(true);
    try {
      const response = await setFxRate({ date: fxDate, usd_brl_rate: value });
      setFxRateValue(response.usd_brl_rate);
      setFxRateInput(String(response.usd_brl_rate));
      setFxStatus("Taxa salva.");
    } catch (err) {
      setFxStatus((err as Error).message);
    } finally {
      setFxLoading(false);
    }
  };

  const handleAutoFx = async () => {
    setFxLoading(true);
    setFxStatus(null);
    try {
      const response = await fetchFxRateAuto(fxDate);
      setFxRateValue(response.usd_brl_rate);
      setFxRateInput(String(response.usd_brl_rate));
      setFxStatus("Cotação atualizada automaticamente.");
    } catch (err) {
      setFxStatus((err as Error).message);
    } finally {
      setFxLoading(false);
    }
  };

  const allDaysSelected = selectedDays.length === 7;
  const allHoursSelected = selectedHours.length === 24;

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    );
  };

  const toggleHour = (hour: number) => {
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((item) => item !== hour) : [...prev, hour]
    );
  };

  const filteredTrades = useMemo(() => {
    const dayFilter = selectedDays.length ? selectedDays : DAYS.map((_, idx) => idx);
    const hourFilter = selectedHours.length ? selectedHours : HOURS;
    return trades.filter((trade) => {
      const closeDate = new Date(trade.close_time);
      return dayFilter.includes(closeDate.getDay()) && hourFilter.includes(closeDate.getHours());
    });
  }, [trades, selectedDays, selectedHours]);

  const metrics = useMemo(
    () =>
      computeMetrics(
        filteredTrades,
        useBrl ? "BRL" : "USD",
        from,
        to,
        fxRate
      ),
    [filteredTrades, useBrl, from, to, fxRate]
  );

  const metricsBrl = useMemo(
    () => computeMetrics(filteredTrades, "BRL", from, to, fxRate),
    [filteredTrades, from, to, fxRate]
  );

  const currency: "USD" | "BRL" = useBrl ? "BRL" : "USD";
  const applyTax = (value: number) => (value > 0 ? value * (1 + TAX_RATE) : value);
  const goalGross = applyTax(goalNet);
  const goalNetUsd = fxRate ? goalNet / fxRate : null;
  const goalGrossUsd = fxRate ? goalGross / fxRate : null;
  const grossProgressValue = applyTax(metricsBrl.net);

  const progressNet = goalNet > 0 ? Math.min(metricsBrl.net / goalNet, 1) : 0;
  const progressGross = goalGross > 0 ? Math.min(grossProgressValue / goalGross, 1) : 0;
  const remainingNet = Math.max(goalNet - metricsBrl.net, 0);
  const remainingGross = Math.max(goalGross - grossProgressValue, 0);

  const daysRemaining = useMemo(() => {
    if (!goalMonth) return 0;
    const range = getMonthRange(goalMonth);
    if (!range.from || !range.to) return 0;
    const monthStart = new Date(`${range.from}T00:00:00`);
    const monthEnd = new Date(`${range.to}T00:00:00`);
    const today = new Date();
    if (today > monthEnd) return 0;
    const base = today < monthStart ? monthStart : today;
    const diff = Math.ceil((monthEnd.getTime() - base.getTime()) / MS_DAY);
    return Math.max(diff + 1, 1);
  }, [goalMonth]);

  const goalMonthLabel = useMemo(() => formatMonthLabel(goalMonth), [goalMonth]);

  const handleGoalMonthChange = (value: string) => {
    if (!value) return;
    setGoalMonth(value);
    const range = getMonthRange(value);
    if (!range.from || !range.to) return;
    if (toMonthKey(now) === value) {
      setFrom(range.from);
      setTo(toDateInput(now));
    } else {
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const needPerDayBrl = remainingNet / (daysRemaining || 1);
  const needPerDayUsd = fxRate ? needPerDayBrl / fxRate : null;

  const progressData = metrics.equityData.map((item) => ({
    day: item.day,
    acumulado: item.cumulative,
    metaLiquida: currency === "BRL" ? goalNet : goalNetUsd ?? 0,
    metaBruta: currency === "BRL" ? goalGross : goalGrossUsd ?? 0
  }));

  const profitLossData = [
    { label: "Lucro bruto", value: metrics.grossProfit },
    { label: "Prejuízo bruto", value: Math.abs(metrics.grossLoss) }
  ];

  const winRateData = [
    { label: "Win", value: metrics.winRate * 100 },
    { label: "Loss", value: 100 - metrics.winRate * 100 }
  ];

  const chartTooltipStyle = {
    background: "rgba(7, 12, 18, 0.92)",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    borderRadius: 12,
    boxShadow: "0 18px 30px rgba(0,0,0,0.35)",
    color: "#fff"
  };
  return (
    <div className="section">
      <div className="dashboard-layout">
        <aside className="filter-panel">
          <h4>Painel de filtros</h4>
          <div className="filter-section">
          <label>Período</label>
            <div className="filter-grid">
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  const value = event.target.value;
                  setFrom(value);
                  if (!to && value) setTo(value);
                }}
              />
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  const value = event.target.value;
                  setTo(value);
                  if (!from && value) setFrom(value);
                }}
              />
            </div>
          </div>
          <div className="filter-section">
            <label>Ativo</label>
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
              <option value="">{metaLoading ? "Carregando..." : "Todos"}</option>
              {symbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-section">
            <label>Conta</label>
            <select value={account} onChange={(event) => setAccount(event.target.value)}>
              <option value="">{metaLoading ? "Carregando..." : "Todas"}</option>
              {accounts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-section">
            <label>Dias da semana</label>
            <div className="chip-group">
              <button
                type="button"
                className={`chip ${allDaysSelected ? "active" : ""}`}
                onClick={() =>
                  setSelectedDays(allDaysSelected ? [] : DAYS.map((_, idx) => idx))
                }
              >
                Todos
              </button>
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${selectedDays.includes(index) ? "active" : ""}`}
                  onClick={() => toggleDay(index)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
          <label>Horário</label>
            <div className="chip-group">
              <button
                type="button"
                className={`chip tiny ${allHoursSelected ? "active" : ""}`}
                onClick={() => setSelectedHours(allHoursSelected ? [] : HOURS)}
              >
                Todos
              </button>
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className={`chip tiny ${selectedHours.includes(hour) ? "active" : ""}`}
                  onClick={() => toggleHour(hour)}
                >
                  {hour}h
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <label>Moeda</label>
            <div className="toggle-row">
              <button
                type="button"
                className={`chip ${!useBrl ? "active" : ""}`}
                onClick={() => setUseBrl(false)}
              >
                USD
              </button>
              <button
                type="button"
                className={`chip ${useBrl ? "active" : ""}`}
                onClick={() => setUseBrl(true)}
              >
                BRL
              </button>
            </div>
          </div>
          <div className="filter-actions">
            <button type="button" onClick={loadTrades} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSymbol("");
                setAccount("");
                setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
                setSelectedHours(HOURS);
              }}
            >
              Limpar filtros
            </button>
          </div>
          <div className="helper">Trades filtrados: {filteredTrades.length}</div>
        </aside>

        <div className="dashboard-main">
          <div className="hero">
            <h2>Sua performance</h2>
            <p>
              Analise seus resultados do MetaTrader 5 com filtros completos,
              indicadores-chave e gráficos animados.
            </p>
            <div className="filter-actions" style={{ marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => navigate('/profile')}>
                Abrir perfil fiscal
              </button>
            </div>
          </div>

          {error ? <div className="panel">Erro: {error}</div> : null}
          <div className="cards kpi-grid">
            <div
              className="card kpi-card highlight"
              title="Resultado líquido = lucro + comissão + swap. É o valor final real do período."
            >
              <div className="card-title">Resultado líquido</div>
              <div
                className={`card-value ${metrics.net >= 0 ? "text-success" : "text-danger"}`}
              >
                {formatCurrency(metrics.net, currency)}
              </div>
              <div className="card-sub">{metrics.totalTrades} operacoes</div>
            </div>
            <div
              className="card kpi-card"
              title="Resultado bruto = soma dos lucros das operações vencedoras (sem descontar custos)."
            >
              <div className="card-title">Resultado bruto</div>
              <div className="card-value text-success">
                {formatCurrency(metrics.grossProfit, currency)}
              </div>
              <div className="card-sub">Ganho total</div>
            </div>
            <div
              className="card kpi-card"
              title="Prejuízo bruto = soma das perdas das operações perdedoras (sem custos). Pode ser maior que o capital investido."
            >
              <div className="card-title">Prejuízo bruto</div>
              <div className="card-value text-danger">
                {formatCurrency(Math.abs(metrics.grossLoss), currency)}
              </div>
              <div className="card-sub">Loss total</div>
            </div>
            <div className="card kpi-card">
              <div className="card-title">Custos</div>
              <div className="card-value">
                {formatCurrency(metrics.costs, currency)}
              </div>
              <div className="card-sub">Comissão + swap</div>
            </div>
          </div>

          <div className="cards stat-grid">
            <div className="card small">
              <div className="card-title">Total operacoes</div>
              <div className="card-value">{metrics.totalTrades}</div>
            </div>
            <div className="card small">
              <div className="card-title">Vencedoras</div>
              <div className="card-value text-success">{metrics.wins}</div>
            </div>
            <div className="card small">
              <div className="card-title">Perdedoras</div>
              <div className="card-value text-danger">{metrics.losses}</div>
            </div>
            <div className="card small">
              <div className="card-title">Fator de lucro</div>
              <div className="card-value">{formatNumber(metrics.profitFactor, 2)}</div>
            </div>
            <div className="card small">
              <div className="card-title">Ganho médio</div>
              <div className="card-value text-success">
                {formatCurrency(metrics.avgWin, currency)}
              </div>
            </div>
            <div className="card small">
              <div className="card-title">Perda média</div>
              <div className="card-value text-danger">
                {formatCurrency(metrics.avgLoss, currency)}
              </div>
            </div>
            <div className="card small">
              <div className="card-title">Maior lucro</div>
              <div className="card-value text-success">
                {formatCurrency(metrics.maxWin, currency)}
              </div>
            </div>
            <div className="card small">
              <div className="card-title">Maior prejuízo</div>
              <div className="card-value text-danger">
                {formatCurrency(Math.abs(metrics.maxLoss), currency)}
              </div>
            </div>
            <div className="card small">
              <div className="card-title">Payoff</div>
              <div className="card-value">{formatNumber(metrics.payoff, 2)}</div>
            </div>
            <div className="card small">
              <div className="card-title">Seq. positiva</div>
              <div className="card-value text-success">{metrics.streakWin}</div>
            </div>
            <div className="card small">
              <div className="card-title">Seq. negativa</div>
              <div className="card-value text-danger">{metrics.streakLoss}</div>
            </div>
            <div className="card small">
              <div className="card-title">Máx. drawdown</div>
              <div className="card-value text-danger">
                {formatCurrency(metrics.drawdown, currency)}
              </div>
            </div>
          </div>
          <div className="panel-grid">
            <div className="panel">
              <div className="panel-header">
                <h4>Meta mensal</h4>
                <span>
                  Meta de {goalMonthLabel || "mês selecionado"}. Atualize a meta e o painel
                  recalcula automaticamente.
                </span>
              </div>
              <div className="form-row">
                <label>
                  Mês da meta
                  <input
                    type="month"
                    value={goalMonth}
                    onChange={(event) => handleGoalMonthChange(event.target.value)}
                  />
                </label>
                <label>
                  Meta líquida (BRL)
                  <input
                    type="number"
                    min={0}
                    value={Number.isFinite(goalNet) ? goalNet : 0}
                    onChange={(event) => setGoalNet(Number(event.target.value))}
                  />
                </label>
                <label>
                  Meta bruta (BRL)
                  <input
                    type="text"
                    value={formatCurrency(goalGross, "BRL")}
                    readOnly
                  />
                </label>
                <label>
                  Dias restantes no mês
                  <input type="text" value={`${daysRemaining}`} readOnly />
                </label>
              </div>
              <div className="progress-row">
                <div>
                  <strong>Progresso líquido:</strong>{" "}
                  {formatCurrency(metricsBrl.net, "BRL")} / {formatCurrency(goalNet, "BRL")}
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${progressNet * 100}%` }} />
                </div>
                <div>
                  <strong>Progresso bruto:</strong>{" "}
                  {formatCurrency(grossProgressValue, "BRL")} / {formatCurrency(goalGross, "BRL")}
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${progressGross * 100}%` }} />
                </div>
                <div>
                  <strong>Falta líquida:</strong> {formatCurrency(remainingNet, "BRL")}
                </div>
                <div>
                  <strong>Falta bruto:</strong> {formatCurrency(remainingGross, "BRL")}
                </div>
                <div>
                  <strong>Precisa por dia (BRL):</strong> {formatCurrency(needPerDayBrl, "BRL")}
                </div>
                <div>
                  <strong>Precisa por dia (USD):</strong>{" "}
                  {needPerDayUsd ? formatCurrency(needPerDayUsd, "USD") : "Defina a taxa USD/BRL"}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h4>Taxa USD/BRL</h4>
                <span>Use a taxa diária para converter resultados em BRL.</span>
              </div>
              <div className="form-row">
                <label>
                  Data
                  <input
                    type="date"
                    value={fxDate}
                    onChange={(event) => setFxDate(event.target.value)}
                  />
                </label>
                <label>
                  USD/BRL
                  <input
                    type="number"
                    step="0.0001"
                    value={fxRateInput}
                    onChange={(event) => setFxRateInput(event.target.value)}
                  />
                </label>
                <button type="button" onClick={handleSaveFx} disabled={fxLoading}>
                  {fxLoading ? "Salvando..." : "Salvar taxa"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleAutoFx}
                  disabled={fxLoading}
                >
                  Buscar automático
                </button>
              </div>
              <div className="helper">
                {fxStatus
                  ? fxStatus
                  : fxRate
                    ? `Taxa atual: ${fxRate.toFixed(4)}`
                    : "Sem taxa definida"}
              </div>
              <div className="chart-body" style={{ height: 180, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fxHistory}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) =>
                        new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "2-digit"
                        }).format(new Date(`${value}T00:00:00`))
                      }
                    />
                    <YAxis
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => value.toFixed(4)}
                      labelFormatter={(label) => {
                        const date = new Date(`${label}T00:00:00`);
                        return new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric"
                        }).format(date);
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="usd_brl_rate"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={fxLineDot}
                      isAnimationActive
                      animationDuration={700}
                      name="USD/BRL"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {fxHistoryLoading ? (
                <div className="helper">Carregando histórico...</div>
              ) : fxHistory.length === 0 ? (
                <div className="helper">
                  Sem histórico recente. Salve uma taxa ou use "Buscar automático" para preencher o gráfico.
                </div>
              ) : null}
            </div>
            <div className="panel darf-panel">
              <div className="panel-header">
                <h4>DARF / Imposto</h4>
                <span>Calcule o imposto do mês e gere o PDF da DARF.</span>
              </div>

              <div
                className={`darf-highlight ${currentDarf && currentDarf.tax_due > 0 ? "due" : "clear"}`}
              >
                {currentDarf ? (
                  currentDarf.tax_due > 0 ? (
                    <>
                      <strong>Imposto a pagar:</strong>{" "}
                      {formatCurrency(currentDarf.tax_due, "BRL")} — Alíquota {(
                        currentDarf.tax_rate * 100
                      ).toFixed(2)}%
                    </>
                  ) : (
                    <>
                      <strong>Sem imposto a pagar</strong>{" "}
                      {`(${currentDarf.month.toString().padStart(2, "0")}/${currentDarf.year})`}
                    </>
                  )
                ) : (
                  <>Calcule para ver se há imposto.</>
                )}
              </div>

              <div className="form-row">
                <label>
                  Mês
                  <select
                    value={darfMonth}
                    onChange={(event) => setDarfMonth(Number(event.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                      <option key={month} value={month}>
                        {month.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ano
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={darfYear}
                    onChange={(event) => setDarfYear(Number(event.target.value))}
                  />
                </label>
                <label>
                  USD/BRL (opcional)
                  <input
                    type="number"
                    step="0.0001"
                    value={darfFx}
                    onChange={(event) => setDarfFx(event.target.value)}
                  />
                </label>
                <label>
                  Alíquota % (opcional)
                  <input
                    type="number"
                    step="0.01"
                    value={darfTax}
                    onChange={(event) => setDarfTax(event.target.value)}
                  />
                </label>
                <button type="button" onClick={handleCalcDarf} disabled={darfLoading}>
                  {darfLoading ? "Calculando..." : "Calcular"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handlePdfDarf}
                  disabled={darfLoading}
                >
                  {darfLoading ? "Gerando..." : "Gerar PDF"}
                </button>
              </div>
              {darfResult ? (
                <div className="helper">
                  {`Mês ${darfResult.month.toString().padStart(2, "0")}/${darfResult.year} | Lucro USD: ${formatCurrency(
                    darfResult.profit_usd,
                    "USD"
                  )} | Lucro BRL: ${formatCurrency(darfResult.profit_brl, "BRL")} | Imposto: ${formatCurrency(
                    darfResult.tax_due,
                    "BRL"
                  )} | Alíquota ${(darfResult.tax_rate * 100).toFixed(2)}%`}
                  {darfResult.message ? ` ? ${darfResult.message}` : ""}
                </div>
              ) : null}
              {darfStatus ? <div className="helper">{darfStatus}</div> : null}
              <div className="helper">
                preencha perfil fiscal (NO CANTO SUPERIOR DITEITO) para gerar a DARF
              </div>
              {darfHistory.length ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th className="th-num">Lucro BRL</th>
                        <th className="th-num">Imposto</th>
                        <th className="th-num">Câmbio</th>
                        <th className="th-num">Alíquota</th>
                        <th className="th-num">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {darfHistory.map((item) => (
                        <tr key={`${item.year}-${item.month}`}>
                          <td>{`${item.month.toString().padStart(2, "0")}/${item.year}`}</td>
                          <td className="td-num">{formatCurrency(item.profit_brl, "BRL")}</td>
                          <td className="td-num">{formatCurrency(item.tax_due, "BRL")}</td>
                          <td className="td-num">{item.fx_rate.toFixed(4)}</td>
                          <td className="td-num">{(item.tax_rate * 100).toFixed(2)}%</td>
                          <td className="td-num">{item.trades_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="helper">Nenhum cálculo salvo ainda.</div>
              )}
            </div>
          </div>
          <div className="chart-grid">
            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Evolução patrimonial</h4>
                <span>Lucro acumulado no período selecionado.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={metrics.equityData}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis dataKey="day" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#22d3ee"
                      fill="url(#equityGradient)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={900}
                      name="Acumulado"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Assertividade</h4>
                <span>Percentual de trades vencedores.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={winRateData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={110}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={2}
                      isAnimationActive
                      animationDuration={900}
                    >
                      {winRateData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.label}`}
                          fill={index === 0 ? "#22c55e" : "rgba(148, 163, 184, 0.2)"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#e5e7eb"
                      fontSize="22"
                      fontWeight="600"
                    >
                      {formatPercent(metrics.winRate)}
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Comparativo lucro x prejuízo</h4>
                <span>Somatório de ganhos e perdas.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={profitLossData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Bar dataKey="value" radius={[8, 8, 8, 8]} isAnimationActive animationDuration={800}>
                      {profitLossData.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={
                            entry.label === "Lucro bruto" ? "#22c55e" : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Lucro diário</h4>
                <span>Barras diárias com resultado líquido.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={metrics.dailyData}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis dataKey="day" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Bar dataKey="net" radius={[6, 6, 6, 6]} isAnimationActive animationDuration={800}>
                      {metrics.dailyData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.net >= 0 ? "#22c55e" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Progresso mensal</h4>
                <span>Acumulado vs. meta líquida e bruta.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={progressData}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis dataKey="day" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={900}
                      name="Acumulado"
                    />
                    <Line
                      type="monotone"
                      dataKey="metaLiquida"
                      stroke="#38bdf8"
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive
                      animationDuration={900}
                      name="Meta líquida"
                    />
                    <Line
                      type="monotone"
                      dataKey="metaBruta"
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive
                      animationDuration={900}
                      name="Meta bruta"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Dia da semana</h4>
                <span>Resultado líquido por dia.</span>
              </div>
              <div className="chart-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={metrics.dayOfWeek}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis dataKey="label" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#9aa4b2", fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value, currency)}
                    />
                    <Bar dataKey="net" radius={[6, 6, 6, 6]} isAnimationActive animationDuration={800}>
                      {metrics.dayOfWeek.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={entry.net >= 0 ? "#22c55e" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h4>Mapa de calor: dia x horário</h4>
              <span>Identifique os horários mais positivos e negativos.</span>
            </div>
            <div className="heatmap">
              <div className="heatmap-header">
                <div />
                {HOURS.map((hour) => (
                  <span key={`h-${hour}`}>{hour}</span>
                ))}
              </div>
              {metrics.heatmap.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="heatmap-row">
                  <div className="heatmap-label">{DAYS[rowIndex]}</div>
                  <div className="heatmap-cells">
                    {row.map((value, colIndex) => (
                      <div
                        key={`cell-${rowIndex}-${colIndex}`}
                        className="heatmap-cell"
                        style={{
                          backgroundColor: getHeatColor(value, metrics.heatMax)
                        }}
                        title={`${DAYS[rowIndex]} ${colIndex}h: ${formatCurrency(value, currency)}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
