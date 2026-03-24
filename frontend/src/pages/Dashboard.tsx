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



  saveDarfPdfFile,



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



const LAST_PDF_DIR_KEY = "ttmt5_last_pdf_dir";



const LAST_PDF_PATH_KEY = "ttmt5_last_pdf_path";







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
function formatCurrencySignAfterSymbol(value: number, currency: "USD" | "BRL") {
  const safe = Number.isFinite(value) ? value : 0;
  const prefix = currency === "USD" ? "US$" : "R$";
  const formattedNumber = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(safe));
  const signChunk = safe < 0 ? " -" : " ";
  return `${prefix}${signChunk}${formattedNumber}`;
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







function getDirPath(path: string) {



  const norm = path.replace(/\\/g, "/");



  const idx = norm.lastIndexOf("/");



  return idx >= 0 ? norm.slice(0, idx) : "";



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

  const heatmapCount = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  const heatmapWins = Array.from({ length: 7 }, () =>
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



    const daily =
      dailyMap.get(dateKey) ??
      {
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
      heatmapCount[dow][hour] += 1;
      if (netValue > 0) {
        heatmapWins[dow][hour] += 1;
      }
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



    const daily =
      dailyMap.get(key) ??
      {
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

  // Novas metricas para day trader
  const avgDurationMin: number = trades.length > 0
    ? Math.round(trades.reduce((sum, t) =>
        sum + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()), 0)
        / trades.length / 60000)
    : 0;

  const totalTradingDays = dailyMap.size;
  const profitableDaysCount = Array.from(dailyMap.values()).filter(d => d.net > 0).length;
  const profitableDaysPct: number = totalTradingDays > 0 ? profitableDaysCount / totalTradingDays : 0;

  const breakevenWinRate: number = payoff > 0 ? 1 / (1 + payoff) : 0.5;

  const tradedDaysList = dayOfWeek.filter(d => d.trades > 0);
  const bestDay = tradedDaysList.length > 0
    ? tradedDaysList.reduce((b, d) => d.net > b.net ? d : b)
    : null;
  const worstDay = tradedDaysList.length > 0
    ? tradedDaysList.reduce((w, d) => d.net < w.net ? d : w)
    : null;

  const hourAggData: { hour: number; net: number; trades: number }[] = [];
  for (let h = 0; h < 24; h++) {
    let hNet = 0, hTrades = 0;
    for (let dw = 0; dw < 7; dw++) { hNet += heatmap[dw][h]; hTrades += heatmapCount[dw][h]; }
    if (hTrades > 0) hourAggData.push({ hour: h, net: hNet, trades: hTrades });
  }
  const bestHour = hourAggData.length > 0 ? hourAggData.reduce((b, h) => h.net > b.net ? h : b) : null;
  const worstHour = hourAggData.length > 0 ? hourAggData.reduce((w, h) => h.net < w.net ? h : w) : null;

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

    heatmapCount,

    heatmapWins,

    heatMax: heatMax || 1,



    streakWin: streaks.maxWin,



    streakLoss: streaks.maxLoss,
    avgDurationMin,
    profitableDaysPct,
    breakevenWinRate,
    bestDay,
    worstDay,
    bestHour,
    worstHour



  };



}







export default function Dashboard() {



  const now = new Date();



  const initialGoalMonth = toMonthKey(now);



  const navigate = useNavigate();



  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);



  const [clockNow, setClockNow] = useState(new Date());

  const [from, setFrom] = useState(toDateInput(startOfMonth));



  const [to, setTo] = useState(toDateInput(now));



  const [symbol, setSymbol] = useState("");



  const [account, setAccount] = useState("");



  const [symbols, setSymbols] = useState<string[]>([]);



  const [accounts, setAccounts] = useState<string[]>([]);



  const [metaLoading, setMetaLoading] = useState(false);



  const [trades, setTrades] = useState<Trade[]>([]);
  const [goalTrades, setGoalTrades] = useState<Trade[]>([]);



  const [loading, setLoading] = useState(false);



  const [error, setError] = useState<string | null>(null);



  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);



  const [selectedHours, setSelectedHours] = useState<number[]>(HOURS);



  const [useBrl, setUseBrl] = useState(false);

  const applyPreset = (preset: "today" | "week" | "month") => {
    const today = new Date();
    const todayStr = toDateInput(today);
    if (preset === "today") {
      setFrom(todayStr);
      setTo(todayStr);
      return;
    }
    if (preset === "week") {
      const dow = today.getDay(); // 0 dom, 1 seg
      const mondayOffset = (dow + 6) % 7;
      const start = new Date(today);
      start.setDate(today.getDate() - mondayOffset);
      setFrom(toDateInput(start));
      setTo(todayStr);
      return;
    }
    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFrom(toDateInput(start));
      setTo(todayStr);
    }
  };



  const [goalMonth, setGoalMonth] = useState(initialGoalMonth);
  const goalRange = useMemo(() => getMonthRange(goalMonth), [goalMonth]);
  const [goalUpdatedAt, setGoalUpdatedAt] = useState<string | null>(null);



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

  const fxStats = useMemo(() => {
    if (!fxHistory.length) {
      return {
        latest: null,
        max: null,
        min: null,
        changeAbs: null,
        changePct: null
      };
    }
    const values = fxHistory
      .map((item) => item.usd_brl_rate)
      .filter((v) => Number.isFinite(v));
    if (!values.length) {
      return {
        latest: null,
        max: null,
        min: null,
        changeAbs: null,
        changePct: null
      };
    }
    const latest = values[values.length - 1];
    const first = values[0];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const changeAbs = first ? latest - first : null;
    const changePct = first ? (changeAbs / first) * 100 : null;
    return { latest, max, min, changeAbs, changePct };
  }, [fxHistory]);







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



  const [profileLoaded, setProfileLoaded] = useState(false);



  const [lastPdfPath, setLastPdfPath] = useState<string | null>(() =>



    localStorage.getItem(LAST_PDF_PATH_KEY)



  );



  const hasFiscalProfile = useMemo(



    () => Boolean(profile?.full_name?.trim() && profile?.cpf?.trim()),



    [profile]



  );







  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    const { from: goalFrom, to: goalTo } = goalRange;
    if (!goalFrom || !goalTo) {
      setGoalTrades([]);
      return;
    }
    const loadGoalTrades = async () => {
      try {
        const response = await fetchTrades({
          from: goalFrom,
          to: goalTo,
          symbol: symbol || undefined,
          account: account || undefined
        });
        setGoalTrades(response.trades);
      } catch {
        setGoalTrades([]);
      }
    };
    loadGoalTrades();
  }, [goalRange.from, goalRange.to, symbol, account]);







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



      setProfileLoaded(true);



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



      const statusMessage = (result.message || "Cálculo concluído.").trim();



      const isNoTax =



        result.tax_due <= 0 &&



        statusMessage.toLowerCase().includes("não há imposto a pagar");



      setDarfStatus(isNoTax ? null : statusMessage);



      loadDarfHistory();



    } catch (err) {



      setDarfResult(null);



      setDarfStatus((err as Error).message);



    } finally {



      setDarfLoading(false);



    }



  };







  const handleOpenPdfFolder = async () => {



    if (!lastPdfPath) return;



    const api: any = (window as any).pywebview?.api;
    const dir = getDirPath(lastPdfPath) || lastPdfPath;
    const fileUrl = `file:///${dir.replace(/\\/g, "/")}`;

    // 1) Bridge desktop



    if (api?.open_path) {



      try {



        const result = await api.open_path(lastPdfPath);



        if (!result?.success) {



          throw new Error(result?.error || "Não foi possível abrir a pasta do PDF.");



        }



        return;



      } catch (err) {



        setDarfStatus((err as Error).message);



      }



    }



    // 2) Endpoint HTTP (backend)



    try {



      const res = await fetch("/api/open-path", {



        method: "POST",



        headers: { "Content-Type": "application/json" },



        body: JSON.stringify({ path: lastPdfPath })



      });



      const data = await res.json();



      if (data?.success) return;



      if (data?.error) throw new Error(data.error);



    } catch (err) {



      setDarfStatus((err as Error).message);



    }



    // 3) Fallback final: file://



    try {

      const w = window.open(fileUrl, "_blank");

      if (!w) throw new Error("Popup bloqueado ao abrir a pasta do PDF.");

      setDarfStatus(null);

    } catch (err) {

      setDarfStatus((err as Error).message || "Não foi possível abrir a pasta do PDF.");

    }



  };







  const handlePdfDarf = async () => {



    setDarfLoading(true);



    setDarfStatus(null);



    try {



      const payload = buildDarfPayload();



      // Tenta salvar direto via backend (escreve em Downloads)



      const filename = `DARF_${String(payload.month).padStart(2, "0")}_${payload.year}.pdf`;



      const lastPdfDir = localStorage.getItem(LAST_PDF_DIR_KEY) || undefined;







      // Se houver pywebview com diálogo de salvar, prioriza



      const api: any = (window as any).pywebview?.api;



      if (api?.save_pdf_prompt) {



        try {



          const blobPrompt = await downloadDarfPdf(payload);



          const buffer = await blobPrompt.arrayBuffer();



          const bytes = new Uint8Array(buffer);



          let binary = "";



          for (let i = 0; i < bytes.byteLength; i += 1) {



            binary += String.fromCharCode(bytes[i]);



          }



          const base64 = window.btoa(binary);



          const response = await api.save_pdf_prompt(base64, filename, lastPdfDir);



          if (response?.success) {



            if (response.path) {



              setLastPdfPath(response.path);



              localStorage.setItem(LAST_PDF_PATH_KEY, response.path);



              const dir = getDirPath(response.path);



              if (dir) localStorage.setItem(LAST_PDF_DIR_KEY, dir);



            }



            setDarfStatus(null); // evita duplicar com "Último PDF"



            return;



          }



          // se usuário cancelou, segue fluxo automático



        } catch (promptErr) {



          console.error("Falha ao salvar com diálogo", promptErr);



        }



      }







      // Sem diálogo: salva automático via backend em Downloads



      try {



        const saved = await saveDarfPdfFile(payload);



        setDarfStatus(null); // evita duplicar com "Último PDF"



        if (saved.path) {



          setLastPdfPath(saved.path);



          localStorage.setItem(LAST_PDF_PATH_KEY, saved.path);



          const dir = getDirPath(saved.path);



          if (dir) localStorage.setItem(LAST_PDF_DIR_KEY, dir);



        }



        return;



      } catch (saveErr) {



        console.error("Falha ao salvar PDF via backend automático", saveErr);



      }







      // ltimo fallback: download direto (blob)



      const blob = await downloadDarfPdf(payload);







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



    const api: any = (window as any).pywebview?.api;



    if (api?.ping) {



      api.ping("dashboard-ready").catch(() => {});



    }



  }, []);







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

  const goalFilteredTrades = useMemo(() => {
    const dayFilter = selectedDays.length ? selectedDays : DAYS.map((_, idx) => idx);
    const hourFilter = selectedHours.length ? selectedHours : HOURS;
    const source = goalTrades.length ? goalTrades : trades;
    return source.filter((trade) => {
      const closeTimeRaw = trade.close_time ?? "";
      const closeDateKey = closeTimeRaw.slice(0, 10);
      if (goalRange.from && closeDateKey < goalRange.from) return false;
      if (goalRange.to && closeDateKey > goalRange.to) return false;
      const closeDate = new Date(closeTimeRaw.replace(" ", "T"));
      if (Number.isNaN(closeDate.getTime())) return false;
      return dayFilter.includes(closeDate.getDay()) && hourFilter.includes(closeDate.getHours());
    });
  }, [goalTrades, trades, goalRange.from, goalRange.to, selectedDays, selectedHours]);







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

  const goalMetrics = useMemo(



    () => computeMetrics(goalFilteredTrades, useBrl ? "BRL" : "USD", goalRange.from, goalRange.to, fxRate),



    [goalFilteredTrades, useBrl, goalRange.from, goalRange.to, fxRate]



  );

  const goalMetricsBrl = useMemo(



    () => computeMetrics(goalFilteredTrades, "BRL", goalRange.from, goalRange.to, fxRate),



    [goalFilteredTrades, goalRange.from, goalRange.to, fxRate]



  );

  const [heatmapMetric, setHeatmapMetric] = useState<"profit" | "winrate">("profit");
  const [minTradesFilter, setMinTradesFilter] = useState<number>(1);

  const heatmapRowAvg = useMemo(
    () => metrics.heatmap.map((row) => (row.length ? row.reduce((a, b) => a + b, 0) / row.length : 0)),
    [metrics.heatmap]
  );

  const heatmapColAvg = useMemo(() => {
    if (!metrics.heatmap.length) return [];
    const cols = metrics.heatmap[0].length;
    const sums = Array.from({ length: cols }, () => 0);
    const count = metrics.heatmap.length;
    metrics.heatmap.forEach((row) => {
      row.forEach((value, idx) => {
        sums[idx] += value;
      });
    });
    return sums.map((sum) => sum / count);
  }, [metrics.heatmap]);

  const heatmapOverallAvg = useMemo(() => {
    let total = 0;
    let count = 0;
    metrics.heatmap.forEach((row) => {
      row.forEach((value) => {
        total += value;
        count += 1;
      });
    });
    return count ? total / count : 0;
  }, [metrics.heatmap]);

  const heatmapMinMax = useMemo(() => {
    if (heatmapMetric === "profit") {
      let min = 0;
      let max = 0;
      metrics.heatmap.forEach((row) => {
        row.forEach((value) => {
          if (value < min) min = value;
          if (value > max) max = value;
        });
      });
      return { min, max };
    }
    // winrate: 0% a 100%
    return { min: 0, max: 100 };
  }, [metrics.heatmap, heatmapMetric]);

  const heatmapHighlight = useMemo(() => {
    const items: { r: number; c: number; v: number }[] = [];
    metrics.heatmap.forEach((row, r) =>
      row.forEach((value, c) => {
        items.push({ r, c, v: value });
      })
    );
    const top = items
      .filter((item) => item.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);
    const bottom = items
      .filter((item) => item.v < 0)
      .sort((a, b) => a.v - b.v)
      .slice(0, 3);
    return {
      top: new Set(top.map((item) => `${item.r}-${item.c}`)),
      bottom: new Set(bottom.map((item) => `${item.r}-${item.c}`))
    };
  }, [metrics.heatmap]);








  const currency: "USD" | "BRL" = useBrl ? "BRL" : "USD";



  const applyTax = (value: number) => (value > 0 ? value * (1 + TAX_RATE) : value);



  const goalGross = applyTax(goalNet);



  const goalNetUsd = fxRate ? goalNet / fxRate : null;



  const goalGrossUsd = fxRate ? goalGross / fxRate : null;



  const goalNetTarget = useBrl ? goalNet : goalNetUsd ?? 0;



  const goalGrossTarget = useBrl ? goalGross : goalGrossUsd ?? 0;



  const goalProgressValue = useBrl ? goalMetricsBrl.net : goalMetrics.net;



  const goalGrossProgressValue = applyTax(goalProgressValue);



  // barra preenche apenas de 0 a 100%; se ficar negativo, zera para mostrar esvaziando
  const goalProgressNet =
    goalNetTarget > 0 ? Math.min(Math.max(goalProgressValue / goalNetTarget, 0), 1) : 0;



  const goalProgressGross =



    goalGrossTarget > 0
      ? Math.min(Math.max(goalGrossProgressValue / goalGrossTarget, 0), 1)
      : 0;



  const goalRemainingNet = Math.max(goalNetTarget - goalProgressValue, 0);

  const goalRemainingGross = Math.max(goalGrossTarget - goalGrossProgressValue, 0);



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
    setGoalUpdatedAt(
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );



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







  const needPerDayBase = goalRemainingNet / (daysRemaining || 1);



  const needPerDayAlt = fxRate



    ? {



        currency: useBrl ? "USD" : "BRL",



        value: useBrl ? needPerDayBase / fxRate : needPerDayBase * fxRate



      }



    : null;







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
            <div className="chip-group" style={{ marginTop: 8 }}>
              <button type="button" className="chip tiny" onClick={() => applyPreset("today")}>Hoje</button>
              <button type="button" className="chip tiny" onClick={() => applyPreset("week")}>Semana</button>
              <button type="button" className="chip tiny" onClick={() => applyPreset("month")}>Mês</button>
            </div>
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



            <h2>SUA PERFORMANCE</h2>



            <p>



              Analise seus resultados do MetaTrader 5 com filtros completos,



              indicadores-chave e gráficos animados.



            </p>



          </div>








          {/* ── Relógio de Mercado ───────────────────────────────────── */}
          {(() => {
            const tzOff = (tz: string): number => {
              const utc = new Date(clockNow.toLocaleString('en-US', { timeZone: 'UTC' }));
              const loc = new Date(clockNow.toLocaleString('en-US', { timeZone: tz }));
              return Math.round((loc.getTime() - utc.getTime()) / 3600000);
            };

            const londonOff = tzOff('Europe/London');
            const nyOff     = tzOff('America/New_York');
            const sydneyOff = tzOff('Australia/Sydney');

            const toBRT = (lh: number, off: number) => ((lh - off - 3) % 24 + 24) % 24;

            const sydS = toBRT(8,  sydneyOff);
            const sydE = toBRT(17, sydneyOff);
            const tokS = 21;
            const tokE = 6;
            const lonS = toBRT(7,  londonOff);
            const lonE = toBRT(16, londonOff);
            const nyS  = toBRT(8,  nyOff);
            const nyE  = toBRT(17, nyOff);
            const ovS  = Math.max(lonS, nyS);
            const ovE  = Math.min(lonE, nyE);

            const h   = clockNow.getHours();
            const min = clockNow.getMinutes();
            const dow = clockNow.getDay();

            const pad = (n: number) => String(n).padStart(2, '0');
            const timeStr = `${pad(h)}:${pad(min)}`;

            const isOpenRange = (s: number, e: number) =>
              s < e ? h >= s && h < e : h >= s || h < e;

            const forexOpen =
              dow !== 6 &&
              !(dow === 0 && h < sydS) &&
              !(dow === 5 && h >= nyE);

            const sessions = [
              { name: 'Sydney',    emoji: '🦘', start: sydS, end: sydE, color: '#22c55e',
                desc: 'Asiática' },
              { name: 'Tóquio',    emoji: '🗼', start: tokS, end: tokE, color: '#22c55e',
                desc: 'Asiática' },
              { name: 'Londres',   emoji: '🎡', start: lonS, end: lonE, color: '#3b82f6',
                desc: londonOff === 1 ? 'Europeia • BST' : 'Europeia • GMT' },
              { name: 'Nova York', emoji: '🗽', start: nyS,  end: nyE,  color: '#ef4444',
                desc: nyOff === -4   ? 'Americana • EDT' : 'Americana • EST' },
            ];

            const overlapOpen = forexOpen && ovS < ovE && isOpenRange(ovS, ovE);

            // Minutos até a próxima abertura de uma hora (BRT)
            const minsTo = (startH: number) => {
              const sm = startH * 60, nm = h * 60 + min;
              return sm > nm ? sm - nm : 24 * 60 - nm + sm;
            };
            const fmt = (startH: number) => {
              const m = minsTo(startH);
              if (m < 60) return `em ${m}min`;
              const hh = Math.floor(m / 60), mm = m % 60;
              return mm > 0 ? `em ${hh}h${pad(mm)}` : `em ${hh}h`;
            };
            type Candidate = { key: string; startH: number; open: boolean };
            const candidates: Candidate[] = [
              ...sessions.map(s => ({ key: s.name, startH: s.start, open: forexOpen && isOpenRange(s.start, s.end) })),
              { key: 'overlap', startH: ovS, open: overlapOpen },
            ];
            const closed = candidates.filter(c => !c.open);
            const nextKey = closed.length > 0
              ? closed.reduce((b, c) => minsTo(c.startH) < minsTo(b.startH) ? c : b).key
              : null;

            return (
              <div className="panel market-clock-panel">
                <div className="panel-header">
                  <h4>🕒 Horário de mercado</h4>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '15px', fontWeight: 700, opacity: 0.9 }}>
                    {timeStr} BRT  
                    <span style={{ fontSize: '12px', fontWeight: 600, color: forexOpen ? 'var(--accent)' : '#94a3b8' }}>
                      {forexOpen ? '● Forex aberto' : '● Forex fechado'}
                    </span>
                  </span>
                </div>

                <div className="market-sessions">
                  {sessions.map(s => {
                    const open = forexOpen && isOpenRange(s.start, s.end);
                    const isNext = !open && nextKey === s.name;
                    return (
                      <div key={s.name} className={`market-session ${open ? 'open' : 'closed'}${isNext ? ' next' : ''}`}>
                        <div className="ms-header">
                          <span className="ms-flag">{s.emoji}</span>
                          <span className="ms-name">{s.name}</span>
                          <span className="ms-badge" style={{ background: open ? s.color + '33' : isNext ? 'rgba(251,191,36,0.15)' : undefined, color: open ? s.color : isNext ? '#fbbf24' : undefined }}>
                            {open ? 'aberto' : isNext ? 'próximo' : 'fechado'}
                          </span>
                        </div>
                        <div className="ms-hours">{s.start}h → {s.end}h</div>
                        <div className="ms-desc">{open ? s.desc : isNext ? fmt(s.start) : s.desc}</div>
                      </div>
                    );
                  })}

                  <div className={`market-session overlap ${overlapOpen ? 'open' : 'closed'}${nextKey === 'overlap' ? ' next' : ''}`}>
                    <div className="ms-header">
                      <span className="ms-flag">🔥</span>
                      <span className="ms-name">Londres + NY</span>
                      <span className="ms-badge" style={{ background: overlapOpen ? '#f59e0b33' : 'rgba(148,163,184,0.1)', color: overlapOpen ? '#f59e0b' : '#94a3b8' }}>
                        {overlapOpen ? 'AGORA' : fmt(ovS)}
                      </span>
                    </div>
                    <div className="ms-hours">{ovS}h → {ovE}h</div>
                    <div className="ms-desc">Melhor horário • +50% do volume</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {error ? <div className="panel">Erro: {error}</div> : null}



          <div className="cards stat-grid">



            <div
              className="card small"
              title="Quantidade total de operações (ganhadoras + perdedoras) no período filtrado."
            >



              <div className="card-title">Total operações</div>



              <div className="card-value">{metrics.totalTrades}</div>



            </div>



            <div
              className="card small"
              title="Número de operações com resultado positivo."
            >



              <div className="card-title">Vencedoras</div>



              <div className="card-value text-success">{metrics.wins}</div>



            </div>



            <div
              className="card small"
              title="Número de operações com resultado negativo."
            >



              <div className="card-title">Perdedoras</div>



              <div className="card-value text-danger">{metrics.losses}</div>



            </div>



            <div
              className="card small"
              title="Fator de lucro: ganho bruto dividido pelo prejuízo bruto (|loss|). >1 indica sistema lucrativo."
            >



              <div className="card-title">Fator de lucro</div>



              <div className="card-value">{formatNumber(metrics.profitFactor, 2)}
                <span style={{
                  marginLeft: 6, fontSize: '11px', fontWeight: 700,
                  color: metrics.profitFactor >= 1.5 ? 'var(--accent)' : metrics.profitFactor >= 1.0 ? '#f59e0b' : '#ef4444'
                }}>
                  {metrics.profitFactor >= 1.5 ? 'otimo' : metrics.profitFactor >= 1.0 ? 'ok' : 'ruim'}
                </span></div>



            </div>



            <div
              className="card small"
              title="Ganho médio das operações vencedoras (já em BRL/USD conforme seleção)."
            >



              <div className="card-title">Ganho médio</div>



              <div className="card-value text-success">



                {formatCurrency(metrics.avgWin, currency)}



              </div>



            </div>



            <div
              className="card small"
              title="Perda média das operações perdedoras."
            >



              <div className="card-title">Perda média</div>



              <div className="card-value text-danger">



                {formatCurrency(metrics.avgLoss, currency)}



              </div>



            </div>



            <div
              className="card small"
              title="Maior lucro obtido em uma única operação."
            >



              <div className="card-title">Maior lucro</div>



              <div className="card-value text-success">



                {formatCurrency(metrics.maxWin, currency)}



              </div>



            </div>



            <div
              className="card small"
              title="Maior prejuízo em uma única operação."
            >



              <div className="card-title">Maior Prejuízo</div>



              <div className="card-value text-danger">



                {formatCurrency(Math.abs(metrics.maxLoss), currency)}



              </div>



            </div>



            <div
              className="card small"
              title="Payoff: ganho médio dividido pela perda média. >1 significa ganhos médios maiores que perdas médias."
            >



              <div className="card-title">Payoff</div>



              <div className="card-value">{formatNumber(metrics.payoff, 2)}
                <span style={{
                  marginLeft: 6, fontSize: '11px', fontWeight: 700,
                  color: metrics.payoff >= 1.5 ? 'var(--accent)' : metrics.payoff >= 1.0 ? '#f59e0b' : '#ef4444'
                }}>
                  {metrics.payoff >= 1.5 ? 'otimo' : metrics.payoff >= 1.0 ? 'ok' : 'ruim'}
                </span></div>



            </div>



            <div
              className="card small"
              title="Maior sequência de vitórias consecutivas."
            >



              <div className="card-title">Seq. positiva</div>



              <div className="card-value text-success">{metrics.streakWin}</div>



            </div>



            <div
              className="card small"
              title="Maior sequência de perdas consecutivas."
            >



              <div className="card-title">Seq. negativa</div>



              <div className="card-value text-danger">{metrics.streakLoss}</div>



            </div>



            <div
              className="card small"
              title="Máximo drawdown: maior queda acumulada desde um pico de capital."
            >



              <div className="card-title">Máx. drawdown</div>



              <div className="card-value text-danger">



                {formatCurrency(metrics.drawdown, currency)}



              </div>



            </div>



          

            <div
              className="card small"
              title="Tempo medio entre abertura e fechamento de cada operacao."
            >
              <div className="card-title">Duracao media</div>
              <div className="card-value">
                {metrics.avgDurationMin < 60
                  ? `${metrics.avgDurationMin}min`
                  : `${Math.floor(metrics.avgDurationMin / 60)}h ${metrics.avgDurationMin % 60}min`}
              </div>
            </div>

            <div
              className="card small"
              title="Percentual de dias operados com resultado positivo. Acima de 60% indica boa consistencia."
            >
              <div className="card-title">Dias lucrativos</div>
              <div className="card-value" style={{
                color: metrics.profitableDaysPct >= 0.6 ? 'var(--accent)' : metrics.profitableDaysPct >= 0.4 ? '#f59e0b' : '#ef4444'
              }}>
                {formatPercent(metrics.profitableDaysPct)}
              </div>
            </div>

            <div
              className="card small"
              title="Taxa de acerto minima para a estrategia ser lucrativa dado o payoff atual. Se sua taxa real for menor, voce perde no longo prazo."
            >
              <div className="card-title">Breakeven</div>
              <div className="card-value" style={{
                color: metrics.winRate >= metrics.breakevenWinRate ? 'var(--accent)' : '#ef4444'
              }}>
                {formatPercent(metrics.breakevenWinRate)}
                <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: 4 }}>
                  {metrics.winRate >= metrics.breakevenWinRate ? 'ok' : 'atencao'}
                </span>
              </div>
            </div>
</div>




          <div className="panel insights-panel">
            <div className="panel-header">
              <h4>Insights da estrategia</h4>
              <span>Pontos fortes e fracos identificados automaticamente nos seus dados.</span>
            </div>
            <div className="insights-grid">
              <div className="insight-card">
                <div className="insight-label">Melhor dia</div>
                <div className="insight-value text-success">
                  {metrics.bestDay ? metrics.bestDay.label : '—'}
                </div>
                <div className="insight-sub">
                  {metrics.bestDay ? formatCurrency(metrics.bestDay.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Pior dia</div>
                <div className="insight-value text-danger">
                  {metrics.worstDay ? metrics.worstDay.label : '—'}
                </div>
                <div className="insight-sub">
                  {metrics.worstDay ? formatCurrency(metrics.worstDay.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Melhor horario</div>
                <div className="insight-value text-success">
                  {metrics.bestHour != null ? `${metrics.bestHour.hour}h` : '—'}
                </div>
                <div className="insight-sub">
                  {metrics.bestHour != null ? formatCurrency(metrics.bestHour.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Pior horario</div>
                <div className="insight-value text-danger">
                  {metrics.worstHour != null ? `${metrics.worstHour.hour}h` : '—'}
                </div>
                <div className="insight-sub">
                  {metrics.worstHour != null ? formatCurrency(metrics.worstHour.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Taxa de acerto</div>
                <div className="insight-value" style={{
                  color: metrics.winRate >= metrics.breakevenWinRate ? 'var(--accent)' : '#ef4444'
                }}>
                  {formatPercent(metrics.winRate)}
                </div>
                <div className="insight-sub">
                  {metrics.winRate >= metrics.breakevenWinRate
                    ? `Acima do minimo (${formatPercent(metrics.breakevenWinRate)})`
                    : `Abaixo do minimo (${formatPercent(metrics.breakevenWinRate)})`}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Consistencia</div>
                <div className="insight-value" style={{
                  color: metrics.profitableDaysPct >= 0.6 ? 'var(--accent)' : metrics.profitableDaysPct >= 0.4 ? '#f59e0b' : '#ef4444'
                }}>
                  {formatPercent(metrics.profitableDaysPct)}
                </div>
                <div className="insight-sub">dias positivos</div>
              </div>
            </div>
          </div>

          <div className="panel-grid">



            <div className="panel fx-panel">



              <div className="panel-header">



                <h4>Meta mensal</h4>



                <span>



                  Meta de {goalMonthLabel || "mês selecionado"}. Atualize a meta e o painel recalcula automaticamente. {goalUpdatedAt ? `Atualizado às ${goalUpdatedAt}.` : ""}



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



                  Dias restantes no Mês



                  <input type="text" value={`${daysRemaining}`} readOnly />



                </label>



              </div>




              <div className="goal-summary">
                <div className="goal-chip">
                  <span className="goal-label">Meta líquida</span>
                  <span className="goal-value">
                    {formatCurrency(goalNetTarget, currency)}
                  </span>
                </div>

                <div className="goal-chip">
                  <span className="goal-label">Já realizado</span>
                  <span
                    className={`goal-value ${goalProgressValue >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatCurrency(goalProgressValue, currency)}
                  </span>
                  <span className="goal-note">{(goalProgressNet * 100).toFixed(0)}% da meta</span>
                </div>

                <div className="goal-chip">
                  <span className="goal-label">Por atingir</span>
                  <span className="goal-value">{formatCurrency(goalRemainingNet, currency)}</span>
                  <span className="goal-note">
                    {formatCurrency(needPerDayBase, currency)} / dia • {daysRemaining}{" "}
                    {daysRemaining === 1 ? "dia" : "dias"} restantes
                  </span>
                  <span className="goal-note">
                    {needPerDayAlt
                      ? `${formatCurrency(needPerDayAlt.value, needPerDayAlt.currency)} / dia`
                      : "Defina a taxa USD/BRL para ver na outra moeda"}
                  </span>
                </div>
              </div>

              <div className="goal-bars">
                <div className="goal-bar">
                  <div className="goal-bar-header">
                    <span className="goal-bar-label">Progresso líquido</span>
                    <span className="goal-bar-value">
                      {formatCurrency(goalProgressValue, currency)} / {formatCurrency(goalNetTarget, currency)}
                    </span>
                  </div>
                  <div className="goal-bar-track">
                    <span style={{ ["--progress" as const]: goalProgressNet }} />
                  </div>
                </div>

                <div className="goal-bar ghost">
                  <div className="goal-bar-header">
                    <span className="goal-bar-label">Progresso bruto</span>
                    <span className="goal-bar-value">
                      {formatCurrency(goalGrossProgressValue, currency)} / {formatCurrency(goalGrossTarget, currency)}
                    </span>
                  </div>
                  <div className="goal-bar-track">
                    <span style={{ ["--progress" as const]: goalProgressGross }} />
                  </div>
                </div>
              </div>
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



                <h4>Comparativo lucro x Prejuízo</h4>



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



                <span>Acumulado vs. Meta líquida e bruta.</span>



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



                <span>resultado líquido por dia.</span>



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



              <div className="panel-header panel-header-center">



                <h4 className="heatmap-title">Mapa de calor: dia x horário</h4>



                <span>Identifique os horários mais positivos e negativos.</span>



              </div>



            <div className="heatmap-controls">
              <div className="heatmap-legend">
                <div className="heatmap-legend-bar">
                    <span className="legend-min">
                      {heatmapMetric === "profit"
                        ? (() => {
                            const minVal = heatmapMinMax.min || 0;
                            if (minVal === 0) return formatCurrency(0, currency);
                            return formatCurrencySignAfterSymbol(minVal, currency);
                          })()
                        : "0%"}
                    </span>
                  <div className="heatmap-legend-gradient">
                    <span className="heatmap-legend-zero">
                      {heatmapMetric === "profit" ? "0" : "50%"}
                    </span>
                  </div>
                  <span className="legend-max">
                    {heatmapMetric === "profit"
                      ? formatCurrency(heatmapMinMax.max, currency)
                      : "100%"}
                  </span>
                </div>
                <div className="heatmap-legend-note center-note">
                  Cor = {heatmapMetric === "profit" ? "lucro médio" : "win rate"}; número = trades; tooltip mostra lucro, trades e win rate.
                </div>
              </div>

              <div className="heatmap-toggles">
                <div className="toggle-row">
                  <button
                    type="button"
                    className={`chip tiny ${heatmapMetric === "profit" ? "active" : ""}`}
                    onClick={() => setHeatmapMetric("profit")}
                  >
                    Lucro
                  </button>
                  <button
                    type="button"
                    className={`chip tiny ${heatmapMetric === "winrate" ? "active" : ""}`}
                    onClick={() => setHeatmapMetric("winrate")}
                  >
                    Win rate
                  </button>
                </div>
                <div className="toggle-row">
                  <label className="mini-label slider-label">
                    Mínimo de trades
                    <div className="slider-row">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={minTradesFilter}
                        onChange={(e) => setMinTradesFilter(Math.max(0, Number(e.target.value)))}
                      />
                      <span className="slider-value">{minTradesFilter}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="heatmap">

              <div className="heatmap-header">

                <div />

                {HOURS.map((hour) => (
                  <span key={`h-${hour}`}>{`${hour}h`}</span>
                ))}

                <span className="heatmap-avg-label">Média</span>

              </div>

              {metrics.heatmap.map((row, rowIndex) => (

                <div key={`row-${rowIndex}`} className="heatmap-row">

                  <div className="heatmap-label">{DAYS[rowIndex]}</div>

                  <div className="heatmap-cells">

                    {row.map((value, colIndex) => {

                      const count = metrics.heatmapCount?.[rowIndex]?.[colIndex] ?? 0;

                      const wins = metrics.heatmapWins?.[rowIndex]?.[colIndex] ?? 0;

                      const winRate = count ? (wins / count) * 100 : null;

                      const key = `${rowIndex}-${colIndex}`;

                      const isTop = heatmapHighlight.top.has(key);

                      const isBottom = heatmapHighlight.bottom.has(key);

                      const visible = count >= minTradesFilter;
                      const cellColor = visible
                        ? getHeatColor(
                            heatmapMetric === "profit" ? value : (winRate ?? 0),
                            heatmapMetric === "profit" ? metrics.heatMax : 100
                          )
                        : "rgba(255, 255, 255, 0.04)";

                      return (

                        <div

                          key={`cell-${rowIndex}-${colIndex}`}

                          className={`heatmap-cell${visible ? "" : " muted"}${isTop ? " heatmap-cell-top" : ""}${isBottom ? " heatmap-cell-bottom" : ""}`}

                          style={{

                            backgroundColor: cellColor

                          }}

                          title={
                            visible
                              ? `${DAYS[rowIndex]} ${colIndex}h\nTrades: ${count}\nLucro médio: ${formatCurrency(
                                  value,
                                  currency
                                )}\nWin rate: ${
                                  winRate != null ? `${winRate.toFixed(0)}%` : "n/d"
                                }`
                              : "Amostra insuficiente para atingir o mínimo de trades."
                          }

                        >

                          {visible && count ? <span className="heatmap-count">{count}</span> : null}

                        </div>

                      );

                    })}

                  </div>

                  <div
                    className="heatmap-avg"
                    title={`Média de ${DAYS[rowIndex]}`}
                  >
                    {formatCurrency(heatmapRowAvg[rowIndex] || 0, currency)}
                  </div>

                </div>

              ))}

              <div className="heatmap-row heatmap-footer">
                <div className="heatmap-label">Média</div>
                <div className="heatmap-cells">
                  {heatmapColAvg.map((value, colIndex) => (
                    <div
                      key={`col-avg-${colIndex}`}
                      className="heatmap-cell avg"
                      style={{ backgroundColor: getHeatColor(value, metrics.heatMax) }}
                      title={`Média das ${colIndex}h: ${formatCurrency(value, currency)}`}
                    />
                  ))}
                </div>
                <div className="heatmap-avg" title="Média geral">
                  {formatCurrency(heatmapOverallAvg, currency)}
                </div>
              </div>

            </div>

          </div>

          <div className="dashboard-footer">
            Desenvolvido por Cicero Bispo
          </div>

        </div>



      </div>



    </div>



  );



}























