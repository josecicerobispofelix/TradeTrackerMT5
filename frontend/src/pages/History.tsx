import { useEffect, useState } from "react";
import { fetchTradeMeta, fetchTrades, Trade } from "../api";
import TradeTable from "../components/TradeTable";

function formatCurrency(value: number, currency: "BRL" | "USD") {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency
  });
}

export default function History() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [symbol, setSymbol] = useState("");
  const [account, setAccount] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMeta = async () => {
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
    };
    loadMeta();
  }, [from, to]);

  const handleSearch = async () => {
    if (!from && !to && !symbol && !account) {
      setTrades([]);
      return;
    }
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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [from, to, symbol, account]);

  const totalUsd = trades.reduce((acc, trade) => acc + trade.net_profit, 0);
  const totalBrl = trades.reduce(
    (acc, trade) => acc + (trade.net_profit_brl ?? 0),
    0
  );
  const hasBrl = trades.some((trade) => trade.net_profit_brl != null);
  const usdPositive = totalUsd >= 0;
  const brlPositive = totalBrl >= 0;
  const sameDay = from && to && from === to;

  return (
    <div className="section">
      <div className="hero">
        <h2>Histórico de operações</h2>
        <p>Filtre por período, ativo ou conta para analisar as operações.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>Filtros</h4>
          <span>Use os filtros e clique em aplicar.</span>
        </div>
        <div className="form-row">
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(event) => {
                const value = event.target.value;
                setFrom(value);
                if (!to && value) {
                  setTo(value);
                }
              }}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={to}
              onChange={(event) => {
                const value = event.target.value;
                setTo(value);
                if (!from && value) {
                  setFrom(value);
                }
              }}
            />
          </label>
          <label>
            Ativo
            <select
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              <option value="">{metaLoading ? "Carregando..." : "Todos"}</option>
              {symbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conta
            <select
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            >
              <option value="">{metaLoading ? "Carregando..." : "Todas"}</option>
              {accounts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleSearch}>
            Aplicar filtros
          </button>
        </div>
      </div>

      {loading ? <div className="panel">Carregando...</div> : null}
      {error ? <div className="panel">Erro: {error}</div> : null}

      {trades.length > 0 ? (
        <>
          <TradeTable trades={trades} />
          <div className="panel">
            <div className="panel-header">
              <h4>{sameDay ? "Resumo do dia" : "Resumo do período"}</h4>
              <span>
                {sameDay ? `Data: ${from}` : "Totais do período filtrado"}
              </span>
            </div>
            <div className="progress-row">
              <div>
                <strong>Total (USD):</strong> {formatCurrency(totalUsd, "USD")}
              </div>
              <div>
                <strong>Total (BRL):</strong>{" "}
                {hasBrl ? formatCurrency(totalBrl, "BRL") : "Indisponível"}
              </div>
              <div>
                <strong>Resultado (USD):</strong>{" "}
                <span className={usdPositive ? "tag success" : "tag danger"}>
                  {usdPositive ? "Positivo" : "Negativo"}
                </span>
              </div>
              <div>
                <strong>Resultado (BRL):</strong>{" "}
                {hasBrl ? (
                  <span className={brlPositive ? "tag success" : "tag danger"}>
                    {brlPositive ? "Positivo" : "Negativo"}
                  </span>
                ) : (
                  "Indisponível"
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="panel">Nenhum trade encontrado.</div>
      )}
    </div>
  );
}
