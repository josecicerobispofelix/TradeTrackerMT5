import { useState } from "react";
import { Trade, updateTradeNote } from "../api";
import { useLang } from "../LangContext";

type SortKey =
  | "close_time" | "symbol" | "side" | "volume"
  | "open_price" | "close_price" | "profit" | "commission"
  | "swap" | "net_profit";

type TradeTableProps = {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onPageChange: (page: number) => void;
  onExportPdf?: () => Promise<void>;
  exporting?: boolean;
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
  const diff = Math.max(0, new Date(closeTime).getTime() - new Date(openTime).getTime());
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

function NoteCell({ tradeId, initialNote }: { tradeId: number; initialNote: string | null | undefined }) {
  const { t } = useLang();
  const [value, setValue] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(true);

  const handleBlur = async () => {
    const trimmed = value.trim();
    const original = (initialNote ?? "").trim();
    if (trimmed === original) return;
    try {
      await updateTradeNote(tradeId, trimmed || null);
      setSaved(true);
    } catch {
      // silently ignore
    }
  };

  return (
    <textarea
      className="note-cell"
      value={value}
      onChange={(e) => { setValue(e.target.value); setSaved(false); }}
      onBlur={handleBlur}
      placeholder={t("tt_note_ph")}
      rows={1}
      title={saved ? t("tt_note_saved") : t("tt_note_unsaved")}
    />
  );
}

export default function TradeTable({
  trades,
  total,
  page,
  pageSize,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  onExportPdf,
  exporting,
}: TradeTableProps) {
  const { t } = useLang();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="sort-icon">⇅</span>;
    return <span className="sort-icon active">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="panel">
      <div className="panel-header">
        <h4>{t("tt_trades")} ({total.toLocaleString("pt-BR")})</h4>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "13px", opacity: 0.7 }}>{t("tt_sort_hint")}</span>
          {onExportPdf && (
            <button className="btn-secondary" onClick={onExportPdf} disabled={exporting}>
              {exporting ? t("tt_exporting") : t("tt_export_pdf")}
            </button>
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => onSort("close_time")}>{t("tt_close")} {sortIcon("close_time")}</th>
              <th onClick={() => onSort("symbol")}>{t("tt_asset")} {sortIcon("symbol")}</th>
              <th onClick={() => onSort("side")}>{t("tt_type")} {sortIcon("side")}</th>
              <th className="th-num" onClick={() => onSort("volume")}>Volume {sortIcon("volume")}</th>
              <th className="th-num" onClick={() => onSort("open_price")}>{t("tt_open_price")} {sortIcon("open_price")}</th>
              <th className="th-num" onClick={() => onSort("close_price")}>{t("tt_close_price")} {sortIcon("close_price")}</th>
              <th className="th-num" onClick={() => onSort("profit")}>{t("tt_profit_usd")} {sortIcon("profit")}</th>
              <th className="th-num" onClick={() => onSort("commission")}>{t("tt_commission")} {sortIcon("commission")}</th>
              <th className="th-num" onClick={() => onSort("swap")}>Swap {sortIcon("swap")}</th>
              <th className="th-num">{t("tt_duration")}</th>
              <th className="th-num" onClick={() => onSort("net_profit")}>{t("tt_net_usd")} {sortIcon("net_profit")}</th>
              <th className="th-num">{t("tt_net_brl")}</th>
              <th>{t("tt_note")}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const net = trade.net_profit;
              const netBrl = trade.net_profit_brl;
              return (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.close_time)}</td>
                  <td>{trade.symbol}</td>
                  <td>
                    <span className={`tag ${net >= 0 ? "success" : "danger"}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-num">{formatNumber(trade.volume, 2)}</td>
                  <td className="td-num">{formatNumber(trade.open_price, 5)}</td>
                  <td className="td-num">{formatNumber(trade.close_price, 5)}</td>
                  <td className="td-num">{formatNumber(trade.profit, 2)}</td>
                  <td className="td-num">{formatNumber(trade.commission, 2)}</td>
                  <td className="td-num">{formatNumber(trade.swap, 2)}</td>
                  <td className="td-num">{formatDuration(trade.open_time, trade.close_time)}</td>
                  <td className="td-num">{formatNumber(net, 2)}</td>
                  <td className="td-num">{netBrl != null ? formatNumber(netBrl, 2) : "-"}</td>
                  <td><NoteCell tradeId={trade.id} initialNote={trade.note} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            {from}–{to} {t("tt_of")} {total.toLocaleString("pt-BR")}
          </span>
          <div className="pagination-controls">
            <button type="button" className="pagination-btn" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
            <button type="button" className="pagination-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
            <span className="pagination-pages">{t("tt_page")} {page} / {totalPages}</span>
            <button type="button" className="pagination-btn" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>›</button>
            <button type="button" className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
