import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../LangContext";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  exportTradesCsv,
  fetchTradeMeta,
  fetchTrades,
  fetchTradeTotals,
  fetchTradeChart,
  Trade,
  TradeTotalsResponse,
  TradeChartDay,
} from "../api";
import TradeTable from "../components/TradeTable";

const PAGE_SIZE = 50;
type SortKey = "close_time" | "symbol" | "side" | "volume" | "open_price" | "close_price" | "profit" | "commission" | "swap" | "net_profit";

function formatCurrency(value: number, currency: "BRL" | "USD") {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const hasFilters = (from: string, to: string, symbol: string, account: string) =>
  !!(from || to || symbol || account);

export default function History() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [symbol, setSymbol] = useState(searchParams.get("symbol") ?? "");
  const [account, setAccount] = useState(searchParams.get("account") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? "close_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as "asc" | "desc") ?? "desc");

  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<TradeTotalsResponse | null>(null);
  const [chartData, setChartData] = useState<TradeChartDay[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state → URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (symbol) params.symbol = symbol;
    if (account) params.account = account;
    if (page > 1) params.page = String(page);
    if (sortKey !== "close_time") params.sort = sortKey;
    if (sortDir !== "desc") params.dir = sortDir;
    setSearchParams(params, { replace: true });
  }, [from, to, symbol, account, page, sortKey, sortDir]);

  // Load meta
  useEffect(() => {
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        const response = await fetchTradeMeta({ from: from || undefined, to: to || undefined });
        setSymbols(response.symbols);
        setAccounts(response.accounts);
        if (symbol && !response.symbols.includes(symbol)) setSymbol("");
        if (account && !response.accounts.includes(account)) setAccount("");
      } catch {
        setSymbols([]);
        setAccounts([]);
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, [from, to]);

  // Reset page on filter/sort change
  useEffect(() => {
    setPage(1);
  }, [from, to, symbol, account, sortKey, sortDir]);

  // Load trades + totals + chart
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!hasFilters(from, to, symbol, account)) {
        setTrades([]);
        setTotal(0);
        setTotals(null);
        setChartData([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = {
          from: from || undefined,
          to: to || undefined,
          symbol: symbol || undefined,
          account: account || undefined,
        };
        const [tradesRes, totalsRes, chartRes] = await Promise.all([
          fetchTrades({ ...params, page, page_size: PAGE_SIZE, sort_by: sortKey, sort_dir: sortDir }),
          fetchTradeTotals(params),
          fetchTradeChart(params),
        ]);
        setTrades(tradesRes.trades);
        setTotal(tradesRes.total);
        setTotals(totalsRes);
        setChartData(chartRes.daily);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [from, to, symbol, account, page, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportTradesCsv({
        from: from || undefined,
        to: to || undefined,
        symbol: symbol || undefined,
        account: account || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const sameDay = from && to && from === to;
  const usdPositive = (totals?.total_usd ?? 0) >= 0;
  const brlPositive = (totals?.total_brl ?? 0) >= 0;

  return (
    <div className="section">
      <div className="hero">
        <h2>{t("history_title")}</h2>
        <p>{t("history_subtitle")}</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t("history_filters")}</h4>
          <span>{t("history_filter_hint")}</span>
        </div>
        <div className="form-row">
          <label>
            {t("history_from")}
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); if (!to && e.target.value) setTo(e.target.value); }}
            />
          </label>
          <label>
            {t("history_to")}
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); if (!from && e.target.value) setFrom(e.target.value); }}
            />
          </label>
          <label>
            {t("history_asset")}
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              <option value="">{metaLoading ? t("history_loading") : t("history_all_assets")}</option>
              {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            {t("history_account")}
            <select value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">{metaLoading ? t("history_loading") : t("history_all_accs")}</option>
              {accounts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => handlePageChange(1)}>{t("history_apply")}</button>
        </div>
      </div>

      {loading ? <div className="panel">{t("history_loading")}</div> : null}
      {error ? <div className="panel">{t("common_error")} {error}</div> : null}

      {!loading && chartData.length > 1 ? (
        <div className="panel">
          <div className="panel-header">
            <h4>{t("history_chart")}</h4>
            <span>{t("history_chart_sub")}</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11 }}
                  stroke="rgba(148,163,184,0.4)"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.4)" width={60} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                    name === "profit_usd" ? t("history_daily_usd") : t("history_accum_usd")
                  ]}
                  labelFormatter={(label) => new Date(label + "T00:00:00").toLocaleDateString("pt-BR")}
                  contentStyle={{ background: "var(--surface)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
                <Bar
                  dataKey="profit_usd"
                  fill="rgba(34,197,94,0.6)"
                  radius={[3, 3, 0, 0]}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative_usd"
                  stroke="var(--accent)"
                  fill="rgba(0,200,255,0.08)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {!loading && trades.length > 0 ? (
        <>
          <TradeTable
            trades={trades}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onPageChange={handlePageChange}
            onExportCsv={handleExportCsv}
            exporting={exporting}
          />
          {totals ? (
            <div className="panel">
              <div className="panel-header">
                <h4>{sameDay ? t("history_day_summary") : t("history_period_sum")}</h4>
                <span>{totals.count.toLocaleString("pt-BR")} {t("history_ops_total")}</span>
              </div>
              <div className="progress-row">
                <div>
                  <strong>{t("common_total")}</strong>{" "}
                  {formatCurrency(totals.total_usd, "USD")}{" "}
                  <span className={usdPositive ? "tag success" : "tag danger"}>
                    {usdPositive ? t("history_positive") : t("history_negative")}
                  </span>
                </div>
                {totals.total_brl != null && (
                  <div>
                    <strong>{t("common_total_brl")}</strong>{" "}
                    {formatCurrency(totals.total_brl, "BRL")}{" "}
                    <span className={brlPositive ? "tag success" : "tag danger"}>
                      {brlPositive ? t("history_positive") : t("history_negative")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : !loading ? (
        <div className="panel">{t("history_no_trades")}</div>
      ) : null}
    </div>
  );
}
