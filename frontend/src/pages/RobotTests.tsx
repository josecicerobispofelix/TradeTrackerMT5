import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  RobotTestIn, RobotTestOut,
  listRobotTests, createRobotTest, deleteRobotTest, exportRobotTestsPdf,
} from "../api";

const SESSIONS = ["Londres", "Nova York", "Ásia", "Sydney", "Overlap NY-Londres", "Outro"];
const CURRENCIES = ["USD", "BRL", "EUR", "GBP"];

const EMPTY: RobotTestIn = {
  robot_name: "",
  test_date: new Date().toISOString().slice(0, 10),
  session: "",
  start_time: "",
  end_time: "",
  total_trades: 0,
  take_profits: 0,
  stop_losses: 0,
  gross_profit: 0,
  gross_loss: 0,
  currency: "USD",
  notes: "",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(15,23,42,0.95)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 13,
};

export default function RobotTests() {
  const [tests, setTests] = useState<RobotTestOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RobotTestIn>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTests(await listRobotTests()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === "number" ? (value === "" ? 0 : parseFloat(value)) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.robot_name.trim() || !form.test_date) { setError("Nome do robô e data são obrigatórios."); return; }
    setSaving(true); setError(null);
    try { await createRobotTest(form); setForm(EMPTY); setShowForm(false); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este teste?")) return;
    try { await deleteRobotTest(id); setTests(t => t.filter(x => x.id !== id)); }
    catch (e) { setError((e as Error).message); }
  };

  const handlePdf = async () => {
    try {
      const blob = await exportRobotTestsPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `testes_robo_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
  };

  const totals = tests.reduce(
    (acc, t) => ({ trades: acc.trades + t.total_trades, tp: acc.tp + t.take_profits, sl: acc.sl + t.stop_losses, profit: acc.profit + t.gross_profit, loss: acc.loss + t.gross_loss }),
    { trades: 0, tp: 0, sl: 0, profit: 0, loss: 0 }
  );
  const winRate = totals.trades > 0 ? ((totals.tp / totals.trades) * 100).toFixed(1) : "0.0";
  const netResult = totals.profit - totals.loss;

  // Gráfico 1: resultado acumulado ao longo dos testes
  const cumulativeData = [...tests]
    .sort((a, b) => a.test_date.localeCompare(b.test_date))
    .reduce<{ label: string; acumulado: number }[]>((acc, t, i) => {
      const prev = acc[i - 1]?.acumulado ?? 0;
      acc.push({ label: t.robot_name.slice(0, 10), acumulado: prev + (t.gross_profit - t.gross_loss) });
      return acc;
    }, []);

  // Gráfico 2: lucro vs perda por teste
  const barData = [...tests]
    .sort((a, b) => a.test_date.localeCompare(b.test_date))
    .map(t => ({ label: t.robot_name.slice(0, 10), lucro: t.gross_profit, perda: t.gross_loss }));

  // Gráfico 3: pizza TP vs SL
  const pieData = [
    { name: "Take Profit", value: totals.tp, color: "#22c55e" },
    { name: "Stop Loss", value: totals.sl, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const hasData = tests.length > 0;

  return (
    <div className="section">
      <div className="hero">
        <h2>Testes de Robô</h2>
        <p>Registre e analise os resultados dos seus robôs no MT5.</p>
      </div>

      {/* KPI Cards */}
      {hasData && (
        <div className="cards kpi-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="card">
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Total Trades</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{totals.trades}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Taxa de Acerto</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#22d3ee" }}>{winRate}%</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Lucro Bruto</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{totals.profit.toFixed(2)}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Resultado Líquido</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: netResult >= 0 ? "#16a34a" : "#f43f5e" }}>
              {netResult >= 0 ? "+" : ""}{netResult.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

          {/* Resultado Acumulado */}
          <div className="panel">
            <div className="panel-header">
              <h4>Resultado Acumulado</h4>
              <span>Evolução do saldo ao longo dos testes</span>
            </div>
            <div className="chart-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9aa4b2", fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(0)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(2), "Acumulado"]} />
                  <Area
                    type="monotone" dataKey="acumulado" stroke="#22d3ee" strokeWidth={2}
                    fill="url(#accumGrad)" dot={{ r: 4, fill: "#22d3ee" }}
                    isAnimationActive animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lucro vs Perda por Teste */}
          <div className="panel">
            <div className="panel-header">
              <h4>Lucro vs Perda por Teste</h4>
              <span>Comparativo de cada sessão</span>
            </div>
            <div className="chart-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9aa4b2", fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => v.toFixed(2)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9aa4b2" }} />
                  <Bar dataKey="lucro" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                  <Bar dataKey="perda" name="Perda" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pizza TP vs SL */}
          <div className="panel">
            <div className="panel-header">
              <h4>Distribuição TP vs SL</h4>
              <span>Proporção de take profits e stop losses</span>
            </div>
            <div className="chart-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} isAnimationActive animationDuration={900}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "rgba(148,163,184,0.4)" }}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resumo rápido */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1rem", padding: "1.5rem" }}>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Resumo dos testes</div>
            {[
              { label: "Total de testes", value: tests.length },
              { label: "Take Profits", value: totals.tp, color: "#22d3ee" },
              { label: "Stop Losses", value: totals.sl, color: "#f43f5e" },
              { label: "Lucro bruto", value: `${totals.profit.toFixed(2)}`, color: "#16a34a" },
              { label: "Perda bruta", value: `${totals.loss.toFixed(2)}`, color: "#f43f5e" },
              { label: "Resultado líquido", value: `${netResult >= 0 ? "+" : ""}${netResult.toFixed(2)}`, color: netResult >= 0 ? "#16a34a" : "#f43f5e" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(148,163,184,0.1)", paddingBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>{label}</span>
                <span style={{ fontWeight: 700, color: color ?? "inherit" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela + Form */}
      <div className="panel">
        <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4>Registros</h4>
            <span>Histórico de testes</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {hasData && <button className="btn-secondary" onClick={handlePdf}>Exportar PDF</button>}
            <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
              {showForm ? "Cancelar" : "+ Novo Teste"}
            </button>
          </div>
        </div>

        {error && <div className="helper" style={{ color: "#f43f5e" }}>{error}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="robot-form">
            <div className="form-grid">
              <label>Nome do Robô *<input name="robot_name" value={form.robot_name} onChange={handleChange} placeholder="Ex: ScalpBot v2" required /></label>
              <label>Data do Teste *<input name="test_date" type="date" value={form.test_date} onChange={handleChange} required /></label>
              <label>Sessão
                <select name="session" value={form.session} onChange={handleChange}>
                  <option value="">— Selecionar —</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Moeda
                <select name="currency" value={form.currency} onChange={handleChange}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Início<input name="start_time" type="time" value={form.start_time} onChange={handleChange} /></label>
              <label>Fim<input name="end_time" type="time" value={form.end_time} onChange={handleChange} /></label>
              <label>Total de Trades<input name="total_trades" type="number" min={0} value={form.total_trades} onChange={handleChange} /></label>
              <label>Take Profits<input name="take_profits" type="number" min={0} value={form.take_profits} onChange={handleChange} /></label>
              <label>Stop Losses<input name="stop_losses" type="number" min={0} value={form.stop_losses} onChange={handleChange} /></label>
              <label>Lucro Bruto<input name="gross_profit" type="number" step="0.01" min={0} value={form.gross_profit} onChange={handleChange} /></label>
              <label>Perda Bruta<input name="gross_loss" type="number" step="0.01" min={0} value={form.gross_loss} onChange={handleChange} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Observações
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Estratégia, condições de mercado..." />
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar Teste"}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="helper" style={{ marginTop: "1rem" }}>Carregando...</div>
        ) : !hasData ? (
          <div className="helper" style={{ marginTop: "1.5rem", textAlign: "center" }}>
            Nenhum teste registrado. Clique em "+ Novo Teste" para começar.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "1.5rem" }}>
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Robô</th><th>Data</th><th>Sessão</th><th>Início</th><th>Fim</th>
                  <th>Trades</th><th>TPs</th><th>SLs</th><th>Lucro</th><th>Perda</th>
                  <th>Resultado</th><th>Notas</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => {
                  const net = t.gross_profit - t.gross_loss;
                  return (
                    <tr key={t.id}>
                      <td>{t.robot_name}</td>
                      <td>{t.test_date}</td>
                      <td>{t.session || "—"}</td>
                      <td>{t.start_time || "—"}</td>
                      <td>{t.end_time || "—"}</td>
                      <td>{t.total_trades}</td>
                      <td style={{ color: "#22d3ee" }}>{t.take_profits}</td>
                      <td style={{ color: "#f43f5e" }}>{t.stop_losses}</td>
                      <td style={{ color: "#16a34a" }}>{t.gross_profit.toFixed(2)}</td>
                      <td style={{ color: "#f43f5e" }}>{t.gross_loss.toFixed(2)}</td>
                      <td style={{ color: net >= 0 ? "#16a34a" : "#f43f5e", fontWeight: 700 }}>
                        {net >= 0 ? "+" : ""}{net.toFixed(2)}
                      </td>
                      <td>{t.notes || "—"}</td>
                      <td>
                        <button className="btn-icon" title="Excluir" onClick={() => handleDelete(t.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
