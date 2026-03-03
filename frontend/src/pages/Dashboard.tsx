import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchTradeMeta,
  fetchTrades,
  getFxRate,
  setFxRate,
  Trade
} from "../api";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const TAX_RATE = 0.2;
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

  const getNetValue = (trade: Trade) => {
    if (currency === "USD") return trade.net_profit;
    if (trade.net_profit_brl != null) return trade.net_profit_brl;
    if (trade.fx_rate != null) return trade.net_profit * trade.fx_rate;
    if (fxFallback != null) return trade.net_profit * fxFallback;
    return trade.net_profit;
  };

  const getCostValue = (trade: Trade) => {
    const base = trade.commission + trade.swap;
    if (currency === "USD") return base;
    if (trade.fx_rate != null) return base * trade.fx_rate;
    if (fxFallback != null) return base * fxFallback;
    return base;
  };

  for (const trade of trades) {
    const netValue = getNetValue(trade);
    const costValue = getCostValue(trade);
    net += netValue;
    costs += costValue;
    if (netValue >= 0) {
      grossProfit += netValue;
      wins += 1;
      maxWin = Math.max(maxWin, netValue);
    } else {
      grossLoss += netValue;
      losses += 1;
      maxLoss = Math.min(maxLoss, netValue);
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
    if (netValue > 0) daily.wins += 1;
    if (netValue < 0) daily.losses += 1;
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

  const streaks = calculateStreaks(trades, getNetValue);

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
  const [goalNet, setGoalNet] = useState<number>(() => {
    const stored = localStorage.getItem("ttmt5_goal_net_brl");
    return stored ? Number(stored) : 3000;
  });
  const [fxDate, setFxDate] = useState(toDateInput(now));
  const [fxRateInput, setFxRateInput] = useState("");
  const [fxRate, setFxRateValue] = useState<number | null>(null);
  const [fxStatus, setFxStatus] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("ttmt5_goal_net_brl", String(goalNet));
  }, [goalNet]);

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
  const goalGross = goalNet / (1 - TAX_RATE);
  const goalNetUsd = fxRate ? goalNet / fxRate : null;
  const goalGrossUsd = fxRate ? goalGross / fxRate : null;

  const progressNet = goalNet > 0 ? Math.min(metricsBrl.net / goalNet, 1) : 0;
  const progressGross =
    goalGross > 0 ? Math.min(metricsBrl.grossProfit / goalGross, 1) : 0;
  const remainingNet = Math.max(goalNet - metricsBrl.net, 0);
  const remainingGross = Math.max(goalGross - metricsBrl.grossProfit, 0);

  const daysRemaining = useMemo(() => {
    if (!to) return 0;
    const base = new Date(`${to}T00:00:00`);
    const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const diff = Math.ceil((monthEnd.getTime() - base.getTime()) / MS_DAY);
    return Math.max(diff + 1, 1);
  }, [to]);

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
          </div>

          {error ? <div className="panel">Erro: {error}</div> : null}
          <div className="cards kpi-grid">
            <div className="card kpi-card">
              <div className="card-title">Resultado líquido</div>
              <div
                className={`card-value ${metrics.net >= 0 ? "text-success" : "text-danger"}`}
              >
                {formatCurrency(metrics.net, currency)}
              </div>
              <div className="card-sub">{metrics.totalTrades} operacoes</div>
            </div>
            <div className="card kpi-card">
              <div className="card-title">Resultado bruto</div>
              <div className="card-value text-success">
                {formatCurrency(metrics.grossProfit, currency)}
              </div>
              <div className="card-sub">Ganho total</div>
            </div>
            <div className="card kpi-card">
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
                <span>Atualize a meta e o painel recalcula automaticamente.</span>
              </div>
              <div className="form-row">
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
                  {formatCurrency(metricsBrl.grossProfit, "BRL")} / {formatCurrency(goalGross, "BRL")}
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${progressGross * 100}%` }} />
                </div>
                <div>
                  <strong>Falta líquido:</strong> {formatCurrency(remainingNet, "BRL")}
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
            </div>
          </div>
          <div className="chart-grid">
            <div className="panel chart-card">
              <div className="panel-header">
                <h4>Evolucao patrimonial</h4>
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
                <span>Somatorio de ganhos e perdas.</span>
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
