import { useEffect, useMemo, useState } from "react";

type Currency = "USD" | "BRL";

const STORAGE_KEY = "ttmt5_risk_params_v1";

type RiskParams = {
  balance: number;
  currency: Currency;
  riskPerTradePct: number;
  dailyLossPct: number;
  weeklyLossPct: number;
  dailyGoalPct: number;
  monthlyGoalPct: number;
  stopDistance: number;
  valuePerPoint: number;
};

const defaultParams: RiskParams = {
  balance: 10000,
  currency: "USD",
  riskPerTradePct: 1,
  dailyLossPct: 3,
  weeklyLossPct: 6,
  dailyGoalPct: 1,
  monthlyGoalPct: 8,
  stopDistance: 200,
  valuePerPoint: 0.1
};

function loadParams(): RiskParams {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultParams;
    const parsed = JSON.parse(stored) as Partial<RiskParams>;
    return { ...defaultParams, ...parsed };
  } catch {
    return defaultParams;
  }
}

function formatCurrency(value: number, currency: Currency) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(safe);
}

export default function Risk() {
  const [params, setParams] = useState<RiskParams>(() => loadParams());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }, [params]);

  const riskValues = useMemo(() => {
    const balance = Math.max(params.balance, 0);
    const riskTrade = (balance * Math.max(params.riskPerTradePct, 0)) / 100;
    const dailyLoss = (balance * Math.max(params.dailyLossPct, 0)) / 100;
    const weeklyLoss = (balance * Math.max(params.weeklyLossPct, 0)) / 100;
    const dailyGoal = (balance * Math.max(params.dailyGoalPct, 0)) / 100;
    const monthlyGoal = (balance * Math.max(params.monthlyGoalPct, 0)) / 100;

    const lot =
      params.stopDistance > 0 && params.valuePerPoint > 0
        ? riskTrade / (params.stopDistance * params.valuePerPoint)
        : 0;

    const maxConsecutiveLoss =
      riskTrade > 0 ? Math.floor(dailyLoss / riskTrade) || 1 : 0;

    return {
      balance,
      riskTrade,
      dailyLoss,
      weeklyLoss,
      dailyGoal,
      monthlyGoal,
      lot,
      maxConsecutiveLoss
    };
  }, [params]);

  const handleChange = (field: keyof RiskParams, value: number | string) => {
    setParams((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : Number.isFinite(value) ? value : 0
    }));
  };

  const resetDefaults = () => setParams(defaultParams);

  return (
    <div className="section">
      <div className="hero">
        <h2>Gerenciamento de risco</h2>
        <p>
          Defina limites automáticos com base no saldo da conta. Ajuste risco por trade,
          limites diários/semanais e metas. Os valores são salvos no navegador.
        </p>
      </div>

      <div className="panel risk-panel">
        <div className="panel-header">
          <h4>Parâmetros base</h4>
          <span>Use o saldo real da sua conta para que os cálculos façam sentido.</span>
        </div>

        <div className="form-row">
          <label>
            Saldo da conta ({params.currency})
            <input
              type="number"
              min={0}
              value={params.balance}
              onChange={(e) => handleChange("balance", Number(e.target.value))}
            />
          </label>
          <label>
            Moeda
            <div className="toggle-row">
              <button
                type="button"
                className={`chip ${params.currency === "USD" ? "active" : ""}`}
                onClick={() => handleChange("currency", "USD")}
              >
                USD
              </button>
              <button
                type="button"
                className={`chip ${params.currency === "BRL" ? "active" : ""}`}
                onClick={() => handleChange("currency", "BRL")}
              >
                BRL
              </button>
            </div>
          </label>
          <label>
            Risco por trade (%)
            <input
              type="number"
              min={0}
              step="0.1"
              value={params.riskPerTradePct}
              onChange={(e) => handleChange("riskPerTradePct", Number(e.target.value))}
            />
          </label>
          <label>
            Stop (pips/pontos)
            <input
              type="number"
              min={0}
              step="1"
              value={params.stopDistance}
              onChange={(e) => handleChange("stopDistance", Number(e.target.value))}
            />
          </label>
          <label>
            Valor por ponto (na moeda)
            <input
              type="number"
              min={0}
              step="0.01"
              value={params.valuePerPoint}
              onChange={(e) => handleChange("valuePerPoint", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Limite de perda diário (%)
            <input
              type="number"
              min={0}
              step="0.1"
              value={params.dailyLossPct}
              onChange={(e) => handleChange("dailyLossPct", Number(e.target.value))}
            />
          </label>
          <label>
            Limite de perda semanal (%)
            <input
              type="number"
              min={0}
              step="0.1"
              value={params.weeklyLossPct}
              onChange={(e) => handleChange("weeklyLossPct", Number(e.target.value))}
            />
          </label>
          <label>
            Meta diária (%)
            <input
              type="number"
              min={0}
              step="0.1"
              value={params.dailyGoalPct}
              onChange={(e) => handleChange("dailyGoalPct", Number(e.target.value))}
            />
          </label>
          <label>
            Meta mensal (%)
            <input
              type="number"
              min={0}
              step="0.1"
              value={params.monthlyGoalPct}
              onChange={(e) => handleChange("monthlyGoalPct", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="risk-actions">
          <button type="button" className="secondary" onClick={resetDefaults}>
            Restaurar padrões
          </button>
        </div>

        <div className="risk-grid">
          <div className="risk-card">
            <div className="risk-title">Risco por trade</div>
            <div className="risk-value">{formatCurrency(riskValues.riskTrade, params.currency)}</div>
            <div className="risk-note">
              {params.riskPerTradePct}% do saldo. Máx. perdas consecutivas (dia):{" "}
              {riskValues.maxConsecutiveLoss} trades.
            </div>
          </div>

          <div className="risk-card">
            <div className="risk-title">Limites de perda</div>
            <div className="risk-list">
              <span>Diário: {formatCurrency(riskValues.dailyLoss, params.currency)}</span>
              <span>Semanal: {formatCurrency(riskValues.weeklyLoss, params.currency)}</span>
            </div>
            <div className="risk-note">Bateu o limite? Pare de operar e revise o plano.</div>
          </div>

          <div className="risk-card">
            <div className="risk-title">Metas</div>
            <div className="risk-list">
              <span>Meta diária: {formatCurrency(riskValues.dailyGoal, params.currency)}</span>
              <span>Meta mensal: {formatCurrency(riskValues.monthlyGoal, params.currency)}</span>
            </div>
            <div className="risk-note">Ao atingir a meta diária, encerre ou reduza o risco.</div>
          </div>

          <div className="risk-card">
            <div className="risk-title">Tamanho do lote sugerido</div>
            <div className="risk-value">
              {riskValues.lot > 0 ? `${riskValues.lot.toFixed(3)} lote(s)` : "--"}
            </div>
            <div className="risk-note">
              Calculado com base no risco por trade, stop de {params.stopDistance} pts e valor por
              ponto de {formatCurrency(params.valuePerPoint, params.currency)}.
            </div>
          </div>
        </div>

        <div className="risk-checklist panel">
          <div className="panel-header">
            <h4>Checklist rápido</h4>
            <span>Use antes de abrir qualquer posição.</span>
          </div>
          <ul className="risk-list bullets">
            <li>Saldo correto configurado e moeda selecionada.</li>
            <li>Risco por trade dentro do limite ({params.riskPerTradePct}% ou menos).</li>
            <li>Stop posicionado? Tamanho do lote respeitando o risco.</li>
            <li>Perdas acumuladas do dia abaixo do limite diário.</li>
            <li>Se bater meta diária, reduzir tamanho ou encerrar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
