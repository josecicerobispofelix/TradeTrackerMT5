import { useEffect, useState } from "react";
import {
  RobotTestIn,
  RobotTestOut,
  listRobotTests,
  createRobotTest,
  deleteRobotTest,
  exportRobotTestsPdf,
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

export default function RobotTests() {
  const [tests, setTests] = useState<RobotTestOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RobotTestIn>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTests(await listRobotTests());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "number" ? (value === "" ? 0 : parseFloat(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.robot_name.trim() || !form.test_date) {
      setError("Nome do robô e data são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createRobotTest(form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este teste?")) return;
    try {
      await deleteRobotTest(id);
      setTests(t => t.filter(x => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handlePdf = async () => {
    try {
      const blob = await exportRobotTestsPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `testes_robo_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const totals = tests.reduce(
    (acc, t) => ({
      trades: acc.trades + t.total_trades,
      tp: acc.tp + t.take_profits,
      sl: acc.sl + t.stop_losses,
      profit: acc.profit + t.gross_profit,
      loss: acc.loss + t.gross_loss,
    }),
    { trades: 0, tp: 0, sl: 0, profit: 0, loss: 0 }
  );
  const winRate = totals.trades > 0 ? ((totals.tp / totals.trades) * 100).toFixed(1) : "0.0";
  const netResult = totals.profit - totals.loss;

  return (
    <div className="section">
      <div className="hero">
        <h2>Testes de Robô</h2>
        <p>Registre e analise os resultados dos seus robôs no MT5.</p>
      </div>
      <div className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h4>Registros</h4>
              <span>Histórico de testes</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {tests.length > 0 && (
                <button className="btn-secondary" onClick={handlePdf}>
                  Exportar PDF
                </button>
              )}
              <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
                {showForm ? "Cancelar" : "+ Novo Teste"}
              </button>
            </div>
          </div>

          {error && <div className="helper" style={{ color: "#dc2626" }}>{error}</div>}

          {showForm && (
            <form onSubmit={handleSubmit} className="robot-form">
              <div className="form-grid">
                <label>
                  Nome do Robô *
                  <input name="robot_name" value={form.robot_name} onChange={handleChange} placeholder="Ex: ScalpBot v2" required />
                </label>
                <label>
                  Data do Teste *
                  <input name="test_date" type="date" value={form.test_date} onChange={handleChange} required />
                </label>
                <label>
                  Sessão
                  <select name="session" value={form.session} onChange={handleChange}>
                    <option value="">— Selecionar —</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Moeda
                  <select name="currency" value={form.currency} onChange={handleChange}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  Início
                  <input name="start_time" type="time" value={form.start_time} onChange={handleChange} />
                </label>
                <label>
                  Fim
                  <input name="end_time" type="time" value={form.end_time} onChange={handleChange} />
                </label>
                <label>
                  Total de Trades
                  <input name="total_trades" type="number" min={0} value={form.total_trades} onChange={handleChange} />
                </label>
                <label>
                  Take Profits
                  <input name="take_profits" type="number" min={0} value={form.take_profits} onChange={handleChange} />
                </label>
                <label>
                  Stop Losses
                  <input name="stop_losses" type="number" min={0} value={form.stop_losses} onChange={handleChange} />
                </label>
                <label>
                  Lucro Bruto
                  <input name="gross_profit" type="number" step="0.01" min={0} value={form.gross_profit} onChange={handleChange} />
                </label>
                <label>
                  Perda Bruta
                  <input name="gross_loss" type="number" step="0.01" min={0} value={form.gross_loss} onChange={handleChange} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Observações
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Estratégia, condições de mercado..." />
                </label>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Teste"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {tests.length > 0 && (
            <div className="cards kpi-grid" style={{ marginTop: "1.5rem" }}>
              <div className="card">
                <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "4px" }}>Total Trades</div>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{totals.trades}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "4px" }}>Taxa de Acerto</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{winRate}%</div>
              </div>
              <div className="card">
                <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "4px" }}>Lucro Bruto</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{totals.profit.toFixed(2)}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "4px" }}>Resultado Líquido</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: netResult >= 0 ? "#16a34a" : "#dc2626" }}>
                  {netResult >= 0 ? "+" : ""}{netResult.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="helper" style={{ marginTop: "1rem" }}>Carregando...</div>
          ) : tests.length === 0 ? (
            <div className="helper" style={{ marginTop: "1.5rem", textAlign: "center" }}>
              Nenhum teste registrado. Clique em "+ Novo Teste" para começar.
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "1.5rem" }}>
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Robô</th>
                    <th>Data</th>
                    <th>Sessão</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Trades</th>
                    <th>TPs</th>
                    <th>SLs</th>
                    <th>Lucro</th>
                    <th>Perda</th>
                    <th>Resultado</th>
                    <th>Notas</th>
                    <th></th>
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
                        <td style={{ color: "#16a34a" }}>{t.take_profits}</td>
                        <td style={{ color: "#dc2626" }}>{t.stop_losses}</td>
                        <td style={{ color: "#16a34a" }}>{t.gross_profit.toFixed(2)}</td>
                        <td style={{ color: "#dc2626" }}>{t.gross_loss.toFixed(2)}</td>
                        <td style={{ color: net >= 0 ? "#16a34a" : "#dc2626" }}>
                          {net >= 0 ? "+" : ""}{net.toFixed(2)}
                        </td>
                        <td>{t.notes || "—"}</td>
                        <td>
                          <button
                            className="btn-icon"
                            title="Excluir"
                            onClick={() => handleDelete(t.id)}
                          >✕</button>
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
