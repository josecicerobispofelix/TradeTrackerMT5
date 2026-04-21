import { useCallback, useEffect, useState } from "react";
import { fetchFiscalProfile, fetchTradeMeta, saveFiscalProfile, FiscalProfile, fetchDarfAnnual, DarfAnnual, DarfMonth } from "../api";

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

export default function Profile() {
  const [profile, setProfile] = useState<FiscalProfile>(() => normalizeProfile());
  const [accounts, setAccounts] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [darfYear, setDarfYear] = useState(new Date().getFullYear());
  const [darfData, setDarfData] = useState<DarfAnnual | null>(null);
  const [darfLoading, setDarfLoading] = useState(false);
  const [darfError, setDarfError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetchFiscalProfile();
      const normalized = normalizeProfile(response);

      try {
        const meta = await fetchTradeMeta();
        setAccounts(meta.accounts ?? []);
        normalized.broker = normalized.broker || meta.suggested_broker || "";
        normalized.trading_account = normalized.trading_account || meta.suggested_account || "";
      } catch {
        // ignora falha silenciosa
      }

      setProfile(normalized);
      setStatus("Perfil carregado.");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  const handleCalcDarf = useCallback(async () => {
    setDarfLoading(true);
    setDarfError(null);
    try {
      setDarfData(await fetchDarfAnnual(darfYear));
    } catch (err) {
      setDarfError((err as Error).message);
    } finally {
      setDarfLoading(false);
    }
  }, [darfYear]);

  const handleSaveProfile = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await saveFiscalProfile(profile);
      setProfile(normalizeProfile(response));
      setStatus("Perfil fiscal salvo.");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="panel">
        <div className="panel-header">
          <h4>Perfil fiscal do trader</h4>
          <span>Preencha uma vez. O CEP preenche rua, bairro, cidade e UF automaticamente.</span>
        </div>

        <div className="helper">Após salvar, os dados são usados no cálculo e PDF do DARF.</div>

        <div className="form-row">
          <label>
            Nome completo
            <input
              type="text"
              value={profile.full_name ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </label>
          <label>
            CPF
            <input
              type="text"
              value={profile.cpf ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, cpf: event.target.value }))}
            />
          </label>
          <label>
            Data de nascimento
            <input
              type="date"
              value={profile.birth_date || ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, birth_date: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            CEP
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={formatCep(profile.cep ?? "")}
              onChange={(event) => {
                const digits = onlyDigits(event.target.value).slice(0, 8);
                setProfile((prev) => ({ ...prev, cep: digits }));
                if (digits.length === 8) {
                  void lookupCep(digits);
                } else {
                  setCepStatus(null);
                }
              }}
            />
          </label>
          <label>
            Rua / avenida
            <input
              type="text"
              value={profile.street ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, street: event.target.value }))}
            />
          </label>
          <label>
            Número
            <input
              type="text"
              value={profile.number ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, number: event.target.value }))}
            />
          </label>
          <label>
            Complemento
            <input
              type="text"
              value={profile.complement ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, complement: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Bairro
            <input
              type="text"
              value={profile.neighborhood ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, neighborhood: event.target.value }))}
            />
          </label>
          <label>
            Cidade
            <input
              type="text"
              value={profile.city ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, city: event.target.value }))}
            />
          </label>
          <label>
            Estado
            <input
              type="text"
              value={profile.state ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, state: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Corretora
            <input
              type="text"
              value={profile.broker ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, broker: event.target.value }))}
            />
          </label>
          <label>
            Conta
            {accounts.length > 0 ? (
              <select
                value={profile.trading_account ?? ""}
                onChange={(event) => setProfile((prev) => ({ ...prev, trading_account: event.target.value }))}
              >
                <option value="">Selecione a conta</option>
                {accounts.map((acc) => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={profile.trading_account ?? ""}
                onChange={(event) => setProfile((prev) => ({ ...prev, trading_account: event.target.value }))}
              />
            )}
          </label>
          <label>
            Moeda da conta
            <select
              value={profile.account_currency ?? "USD"}
              onChange={(event) => setProfile((prev) => ({ ...prev, account_currency: event.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </label>
          <label>
            Alíquota padrão %
            <input
              type="number"
              step="0.01"
              value={Number(profile.tax_rate ?? 0) * 100}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, tax_rate: Number(event.target.value) / 100 }))
              }
            />
          </label>
        </div>

        <button type="button" onClick={handleSaveProfile} disabled={loading}>
          {loading ? "Salvando..." : "Salvar perfil fiscal"}
        </button>

        {status ? <div className="helper">{status}</div> : null}
        {cepStatus ? <div className="helper">{cepStatus}</div> : null}
      </div>

      {/* ── DARF ─────────────────────────────────────────── */}
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <div className="panel-header">
          <h4>Apuração de DARF</h4>
          <span>Forex/CFD em corretora estrangeira (ex: Tickmill) — IR 15% sobre lucro líquido · Cód. 8523</span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Ano
            <input
              type="number"
              min={2020}
              max={2100}
              value={darfYear}
              onChange={e => setDarfYear(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCalcDarf}
            disabled={darfLoading}
            style={{ marginTop: 18 }}
          >
            {darfLoading ? "Calculando..." : "Calcular DARF"}
          </button>
        </div>

        {darfError && <div className="helper" style={{ color: "#ef4444", marginTop: 8 }}>{darfError}</div>}

        {darfData && (
          <>
            <div className="cards kpi-grid" style={{ marginTop: "1.25rem", marginBottom: "1.25rem" }}>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Ano</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{darfData.year}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Total DARF a pagar</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: darfData.total_tax_brl > 0 ? "#ef4444" : "#22c55e" }}>
                  {darfData.total_tax_brl > 0 ? `R$ ${darfData.total_tax_brl.toFixed(2).replace(".", ",")}` : "R$ 0,00"}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Código DARF</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{darfData.darf_code}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Alíquota</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{(darfData.rate * 100).toFixed(0)}%</div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Trades</th>
                    <th>Lucro Líq. (USD)</th>
                    <th>Lucro Líq. (BRL)</th>
                    <th>Prejuízo acum.</th>
                    <th>Base de cálculo</th>
                    <th style={{ color: "#ef4444" }}>DARF 15%</th>
                    <th>Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {darfData.months.map((m: DarfMonth) => {
                    const hasTax = m.tax_brl > 0;
                    const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
                    return (
                      <tr key={m.month} style={{ opacity: m.has_trades ? 1 : 0.4 }}>
                        <td style={{ fontWeight: 600 }}>{m.month_name}</td>
                        <td>{m.trades_count}</td>
                        <td style={{ color: m.net_usd >= 0 ? "#22c55e" : "#ef4444" }}>
                          {m.has_trades ? `US$ ${m.net_usd.toFixed(2).replace(".", ",")}` : "—"}
                        </td>
                        <td style={{ color: (m.net_brl ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                          {m.net_brl != null && m.has_trades ? brl(m.net_brl) : "—"}
                        </td>
                        <td style={{ color: m.carryforward < 0 ? "#f59e0b" : "inherit" }}>
                          {m.carryforward < 0 ? brl(m.carryforward) : "—"}
                        </td>
                        <td>{m.taxable_brl > 0 ? brl(m.taxable_brl) : "—"}</td>
                        <td style={{ fontWeight: 700, color: hasTax ? "#ef4444" : "inherit" }}>
                          {hasTax ? brl(m.tax_brl) : "—"}
                        </td>
                        <td style={{ fontSize: 12, opacity: 0.7 }}>{hasTax ? m.due_date : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="helper" style={{ marginTop: "0.75rem" }}>
              ⚠️ Valor estimado para forex/CFD em corretora estrangeira (Tickmill). Alíquota 15% — código DARF 8523.
              Prejuízo acumulado de meses anteriores é abatido automaticamente. Verifique sempre com seu contador.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
