import { useState } from "react";
import { Trade } from "../api";

type SortKey = keyof Trade | "duration" | "net_profit_brl";

type TradeTableProps = {
  trades: Trade[];
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(openTime: string, closeTime: string) {
  const start = new Date(openTime).getTime();
  const end = new Date(closeTime).getTime();
  const diff = Math.max(0, end - start);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export default function TradeTable({ trades }: TradeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("close_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = [...trades].sort((a, b) => {
    const dir = direction === "asc" ? 1 : -1;
    if (sortKey === "duration") {
      const aDur = new Date(a.close_time).getTime() - new Date(a.open_time).getTime();
      const bDur = new Date(b.close_time).getTime() - new Date(b.open_time).getTime();
      return (aDur - bDur) * dir;
    }
    const aVal = (a as any)[sortKey];
    const bVal = (b as any)[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * dir;
    }
    return String(aVal ?? "").localeCompare(String(bVal ?? "")) * dir;
  });

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h4>Trades ({trades.length})</h4>
        <span>Ordene clicando nos títulos</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("close_time")}>Fechamento</th>
              <th onClick={() => toggleSort("symbol")}>Ativo</th>
              <th onClick={() => toggleSort("side")}>Tipo</th>
              <th className="th-num" onClick={() => toggleSort("volume")}>
                Volume
              </th>
              <th className="th-num" onClick={() => toggleSort("open_price")}>
                Preço Abertura
              </th>
              <th className="th-num" onClick={() => toggleSort("close_price")}>
                Preço Fechamento
              </th>
              <th className="th-num" onClick={() => toggleSort("profit")}>
                Lucro (USD)
              </th>
              <th className="th-num" onClick={() => toggleSort("commission")}>
                Comissão
              </th>
              <th className="th-num" onClick={() => toggleSort("swap")}>
                Swap
              </th>
              <th className="th-num" onClick={() => toggleSort("duration")}>
                Duração
              </th>
              <th className="th-num" onClick={() => toggleSort("net_profit")}>
                Líquido (USD)
              </th>
              <th className="th-num" onClick={() => toggleSort("net_profit_brl")}>
                Líquido (BRL)
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade) => {
              const net = trade.net_profit;
              const netBrl = trade.net_profit_brl;
              return (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.close_time)}</td>
                  <td>{trade.symbol}</td>
                  <td>
                    <span
                      className={`tag ${net >= 0 ? "success" : "danger"}`}
                    >
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-num">{formatNumber(trade.volume, 2)}</td>
                  <td className="td-num">{formatNumber(trade.open_price, 5)}</td>
                  <td className="td-num">{formatNumber(trade.close_price, 5)}</td>
                  <td className="td-num">{formatNumber(trade.profit, 2)}</td>
                  <td className="td-num">{formatNumber(trade.commission, 2)}</td>
                  <td className="td-num">{formatNumber(trade.swap, 2)}</td>
                  <td className="td-num">
                    {formatDuration(trade.open_time, trade.close_time)}
                  </td>
                  <td className="td-num">{formatNumber(net, 2)}</td>
                  <td className="td-num">
                    {netBrl != null ? formatNumber(netBrl, 2) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



