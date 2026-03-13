import { useEffect, useMemo, useState } from "react";

type Currency = "USD" | "BRL";

const STORAGE_KEY = "ttmt5_risk_params_v1";

type PairPreset = {
  symbol: string;
  label: string;
  pipValuePerLot: number; // valor do pip em USD para 1.00 lote
  defaultStop: number;
  minLot?: number;
  note?: string;
};

const PAIR_PRESETS: PairPreset[] = [
  {
    symbol: "XAUUSD",
    label: "XAUUSD (ouro)",
    pipValuePerLot: 1,
    defaultStop: 200,
    minLot: 0.01,
    note: "Ouro é volátil: teste 0,5–1% de risco e stops 200–400 pips."
  },
  {
    symbol: "EURUSD",
    label: "EURUSD",
    pipValuePerLot: 10,
    defaultStop: 35,
    minLot: 0.01,
    note: "Par major; 0,25–1% de risco; stops 20–50 pips."
  },
  {
    symbol: "USDJPY",
    label: "USDJPY",
    pipValuePerLot: 9,
    defaultStop: 40,
    minLot: 0.01,
    note: "JPY reage a notícias; stops 30–60 pips."
  },
  {
    symbol: "GBPUSD",
    label: "GBPUSD",
    pipValuePerLot: 10,
    defaultStop: 45,
    minLot: 0.01,
    note: "Volatilidade média-alta; stops 30–60 pips."
  }
];

type RiskParams = {
  balance: number;
  currency: Currency;
  fxRate: number; // USD -> BRL para conversão opcional
  riskPerTradePct: number;
  dailyLossPct: number;
  weeklyLossPct: number;
  dailyGoalPct: number;
  monthlyGoalPct: number;
  stopDistance: number;
  valuePerPoint: number;
  minLot: number;
  lotStep: number;
};

const defaultParams: RiskParams = {
  balance: 10000,
  currency: "USD",
  fxRate: 5,
  riskPerTradePct: 1,
  dailyLossPct: 3,
  weeklyLossPct: 6,
  dailyGoalPct: 1,
  monthlyGoalPct: 8,
  stopDistance: 200,
  valuePerPoint: 0.1,
  minLot: 0.01,
  lotStep: 0.01
};

function loadParams(): RiskParams {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultParams;
    const parsed = JSON.parse(stored) as Partial<RiskParams>;
    return sanitizeParams({ ...defaultParams, ...parsed });
  } catch {
    return defaultParams;
  }
}

function sanitizeParams(params: RiskParams): RiskParams {
  const minLot = Math.max(params.minLot ?? 0.01, 0.01);
  const lotStep = Math.max(params.lotStep ?? 0.01, 0.01);
  const balance = Number.isFinite(params.balance) ? params.balance : defaultParams.balance;
  const fxRate = Math.max(Number.isFinite(params.fxRate) ? params.fxRate : defaultParams.fxRate, 0.0001);
  const currency: Currency = params.currency === "BRL" ? "BRL" : "USD";
  return { ...params, currency, minLot, lotStep, balance, fxRate };
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
  const [pair, setPair] = useState<PairPreset>(PAIR_PRESETS[0]);

  useEffect(() => {
    const sanitized = sanitizeParams(params);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
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

    const step = Math.max(params.lotStep, 0.0001);
    let lotRounded = 0;
    if (lot > 0) {
      lotRounded = Math.round(lot / step) * step;
      if (lotRounded < params.minLot) lotRounded = params.minLot;
    }

    const maxConsecutiveLoss =
      riskTrade > 0 ? Math.floor(dailyLoss / riskTrade) || 1 : 0;
    const tradesUntilDailyLimit =
      riskTrade > 0 ? Math.max(Math.floor(dailyLoss / riskTrade), 0) : 0;

    return {
      balance,
      riskTrade,
      dailyLoss,
      weeklyLoss,
      dailyGoal,
      monthlyGoal,
      lot,
      lotRounded,
      maxConsecutiveLoss,
      tradesUntilDailyLimit
    };
  }, [params]);

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handleChange = (field: keyof RiskParams, value: number | string) => {
    if (field === "balance") {
      setParams((prev) => {
        const numeric = Number.isFinite(value as number) ? (value as number) : 0;
        return sanitizeParams({ ...prev, balance: numeric });
      });
      return;
    }

    setParams((prev) =>
      sanitizeParams({
        ...prev,
        [field]:
          typeof value === "string"
            ? (value as Currency)
            : Number.isFinite(value)
              ? value
              : 0
      })
    );
  };

  const resetDefaults = () => setParams(defaultParams);

  const applyPreset = (preset: PairPreset) => {
    setPair(preset);
    setParams((prev) =>
      sanitizeParams({
        ...prev,
        stopDistance: preset.defaultStop,
        valuePerPoint: preset.pipValuePerLot * (prev.currency === "BRL" ? prev.fxRate : 1),
        minLot: preset.minLot ?? prev.minLot
      })
    );
  };

  const handlePairChange = (symbol: string) => {
    const preset = PAIR_PRESETS.find((p) => p.symbol === symbol);
    if (preset) applyPreset(preset);
  };

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
          <span className="helper compact">
            Preencha de cima para baixo: saldo → risco% → stop → valor por ponto → lote mínimo/step → limites e metas.
          </span>
        </div>

        <div className="form-row">
          <label>
            Par / Preset
            <select value={pair.symbol} onChange={(e) => handlePairChange(e.target.value)}>
              {PAIR_PRESETS.map((p) => (
                <option key={p.symbol} value={p.symbol}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="helper compact">
              Pip (1 lote): US${pair.pipValuePerLot.toFixed(2)} • Stop sugerido: {pair.defaultStop} pips{" "}
              {pair.note ? `• ${pair.note}` : ""}
            </span>
          </label>
          <label>
            Moeda da conta
            <select
              value={params.currency}
              onChange={(e) => handleChange("currency", e.target.value as Currency)}
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
            <span className="helper compact">Escolha a moeda base do saldo.</span>
          </label>
          <label>
            Saldo da conta (USD)
            <input
              type="number"
              min={0}
              value={params.balance}
              onChange={(e) => handleChange("balance", clamp(Number(e.target.value), 0, 100000000))}
            />
            <span className="helper compact">Saldo disponível para risco. Não inclui alavancagem.</span>
          </label>
          <label>
            Risco por trade (%)
            <input
              type="number"
              min={0}
              step="0.1"
              max={5}
              value={params.riskPerTradePct}
              onChange={(e) => handleChange("riskPerTradePct", clamp(Number(e.target.value), 0, 5))}
            />
            <span className="helper compact">Quanto do saldo arriscar por operação. Faixa comum: 0,25% a 1%.</span>
          </label>
          <label>
            Stop (pips/pontos)
            <input
              type="number"
              min={0}
              step="1"
              max={5000}
              value={params.stopDistance}
              onChange={(e) => handleChange("stopDistance", clamp(Number(e.target.value), 0, 5000))}
            />
            <span className="helper compact">Distância média do stop da sua estratégia.</span>
          </label>
          <label>
            Valor por ponto (na moeda)
            <input
              type="number"
              min={0}
              step="0.01"
              max={1000}
              value={params.valuePerPoint}
              onChange={(e) => handleChange("valuePerPoint", clamp(Number(e.target.value), 0, 1000))}
            />
            <span className="helper compact">
              Valor do pip para 1.00 lote. Ex.: EURUSD ≈ 10; XAUUSD ≈ 1; USDJPY ≈ 9.
            </span>
          </label>
          <label>
            Cotação USD/BRL
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={20}
              value={params.fxRate}
              onChange={(e) => handleChange("fxRate", clamp(Number(e.target.value), 0.01, 20))}
              disabled={params.currency === "USD"}
            />
            <span className="helper compact">Usada para converter valor do pip se a conta for em BRL.</span>
          </label>
          <label>
            Lote mínimo
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={100}
              value={params.minLot}
              onChange={(e) => handleChange("minLot", clamp(Number(e.target.value), 0.01, 100))}
            />
            <span className="helper compact">Ex.: Tickmill Raw começa em 0.01</span>
          </label>
          <label>
            Incremento do lote
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={1}
              value={params.lotStep}
              onChange={(e) => handleChange("lotStep", clamp(Number(e.target.value), 0.0001, 1))}
            />
            <span className="helper compact">Passo de arredondamento (ex.: 0.01)</span>
          </label>
        </div>

        <div className="form-row">
            <label>
            Limite de perda diário (%)
            <input
              type="number"
              min={0}
              step="0.1"
              max={20}
              value={params.dailyLossPct}
              onChange={(e) => handleChange("dailyLossPct", clamp(Number(e.target.value), 0, 20))}
            />
            <span className="helper compact">Percentual do saldo onde você para de operar no dia.</span>
          </label>
          <label>
            Limite de perda semanal (%)
            <input
              type="number"
              min={0}
              step="0.1"
              max={40}
              value={params.weeklyLossPct}
              onChange={(e) => handleChange("weeklyLossPct", clamp(Number(e.target.value), 0, 40))}
            />
            <span className="helper compact">Limite acumulado da semana. Protege contra sequência ruim.</span>
          </label>
          <label>
            Meta diária (%)
            <input
              type="number"
              min={0}
              step="0.1"
              max={20}
              value={params.dailyGoalPct}
              onChange={(e) => handleChange("dailyGoalPct", clamp(Number(e.target.value), 0, 20))}
            />
            <span className="helper compact">Lucro em % do saldo para reduzir risco ou encerrar o dia.</span>
          </label>
          <label>
            Meta mensal (%)
            <input
              type="number"
              min={0}
              step="0.1"
              max={100}
              value={params.monthlyGoalPct}
              onChange={(e) => handleChange("monthlyGoalPct", clamp(Number(e.target.value), 0, 100))}
            />
            <span className="helper compact">Objetivo de mês. Ajuda a medir consistência.</span>
          </label>
        </div>

        <div className="risk-actions">
          <button type="button" className="secondary" onClick={resetDefaults}>
            Restaurar padrões
          </button>
        </div>

        <div className="risk-summary">
          <div>
            <span className="pill">Par</span>
            <strong>{pair.symbol}</strong>
          </div>
          <div>
            <span className="pill">Risco por trade</span>
            <strong>{formatCurrency(riskValues.riskTrade, params.currency)}</strong>
          </div>
          <div>
            <span className="pill">Stop</span>
            <strong>{params.stopDistance} pips</strong>
          </div>
          <div>
            <span className="pill">Valor do pip</span>
            <strong>US${pair.pipValuePerLot.toFixed(2)} / lote</strong>
          </div>
          <div>
            <span className="pill">Lote sugerido</span>
            <strong>{riskValues.lotRounded.toFixed(3)}</strong>
          </div>
          <div>
            <span className="pill">Trades até limite diário</span>
            <strong>{riskValues.tradesUntilDailyLimit || 0}</strong>
          </div>
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
              {riskValues.lot > 0
                ? `${riskValues.lotRounded.toFixed(3)} lote(s)` +
                  (riskValues.lotRounded > params.minLot
                    ? ` (cálculo: ${riskValues.lot.toFixed(3)})`
                    : " (mínimo da corretora)")
                : "--"}
            </div>
            <div className="risk-note">
              Calculado com base no risco por trade, stop de {params.stopDistance} pts, valor por
              ponto de {formatCurrency(params.valuePerPoint, params.currency)} e lote mínimo de{" "}
              {params.minLot.toFixed(2)}.
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

        <div className="risk-formulas panel">
          <div className="panel-header">
            <h4>Fórmulas usadas</h4>
            <span>Mostramos o cálculo para confiança e ajuste fino.</span>
          </div>
          <ul className="risk-list bullets">
            <li>
              Risco em $ = Saldo × (Risco% ÷ 100) → {formatCurrency(riskValues.riskTrade, params.currency)}
            </li>
            <li>
              Lote = Risco $ ÷ (Stop pips × Valor/pip 1 lote) → {riskValues.lotRounded.toFixed(3)}
            </li>
            <li>Trades até limite diário = Limite diário $ ÷ Risco $ → {riskValues.tradesUntilDailyLimit}</li>
            <li>Limite diário $ = Saldo × (Limite diário% ÷ 100) → {formatCurrency(riskValues.dailyLoss, params.currency)}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
