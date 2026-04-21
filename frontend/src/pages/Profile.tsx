import React, { useCallback, useEffect, useState } from "react";
import { fetchFiscalProfile, fetchTradeMeta, saveFiscalProfile, FiscalProfile, fetchDarfAnnual, DarfAnnual, DarfMonth } from "../api";
import { useLang } from "../LangContext";

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
  const { t } = useLang();
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
      setStatus(t("prof_loaded"));
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
      setCepStatus(t("prof_cep_digits"));
      return;
    }
    setCepStatus(t("prof_cep_searching"));
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        cache: "no-store",
        mode: "cors"
      });
      const data = await response.json();
      if (data.erro) {
        setCepStatus(t("prof_cep_not_found"));
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
      setCepStatus(t("prof_cep_filled"));
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
      setStatus(t("prof_saved"));
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
          <h4>{t("prof_title")}</h4>
          <span>{t("prof_subtitle")}</span>
        </div>

        <div className="helper">{t("prof_helper")}</div>

        <div className="form-row">
          <label>
            {t("prof_full_name")}
            <input
              type="text"
              value={profile.full_name ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_cpf")}
            <input
              type="text"
              value={profile.cpf ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, cpf: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_birth")}
            <input
              type="date"
              value={profile.birth_date || ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, birth_date: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            {t("prof_cep")}
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
            {t("prof_street")}
            <input
              type="text"
              value={profile.street ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, street: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_number")}
            <input
              type="text"
              value={profile.number ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, number: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_complement")}
            <input
              type="text"
              value={profile.complement ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, complement: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            {t("prof_neighborhood")}
            <input
              type="text"
              value={profile.neighborhood ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, neighborhood: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_city")}
            <input
              type="text"
              value={profile.city ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, city: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_state")}
            <input
              type="text"
              value={profile.state ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, state: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            {t("prof_broker")}
            <input
              type="text"
              value={profile.broker ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, broker: event.target.value }))}
            />
          </label>
          <label>
            {t("prof_account")}
            {accounts.length > 0 ? (
              <select
                value={profile.trading_account ?? ""}
                onChange={(event) => setProfile((prev) => ({ ...prev, trading_account: event.target.value }))}
              >
                <option value="">{t("prof_select_account")}</option>
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
            {t("prof_currency")}
            <select
              value={profile.account_currency ?? "USD"}
              onChange={(event) => setProfile((prev) => ({ ...prev, account_currency: event.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </label>
          <label>
            {t("prof_tax_rate")}
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
          {loading ? t("prof_saving") : t("prof_save")}
        </button>

        {status ? <div className="helper">{status}</div> : null}
        {cepStatus ? <div className="helper">{cepStatus}</div> : null}
      </div>

      {/* ── DARF ─────────────────────────────────────────── */}
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <div className="panel-header">
          <h4>{t("darf_title")}</h4>
          <span>{t("darf_subtitle")}</span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {t("darf_year")}
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
            {darfLoading ? t("darf_calculating") : t("darf_calculate")}
          </button>
        </div>

        {darfError && <div className="helper" style={{ color: "#ef4444", marginTop: 8 }}>{darfError}</div>}

        {darfData && (
          <>
            <div className="cards kpi-grid" style={{ marginTop: "1.25rem", marginBottom: "1.25rem" }}>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t("darf_year")}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{darfData.year}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t("darf_total")}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: darfData.total_tax_brl > 0 ? "#ef4444" : "#22c55e" }}>
                  {darfData.total_tax_brl > 0 ? `R$ ${darfData.total_tax_brl.toFixed(2).replace(".", ",")}` : "R$ 0,00"}
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t("darf_code")}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{darfData.darf_code}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t("darf_rate")}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{(darfData.rate * 100).toFixed(0)}%</div>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                    {[t("darf_month"), t("darf_trades"), t("darf_net_usd"), t("darf_net_brl"), t("darf_carryforward"), t("darf_taxable"), t("darf_tax"), t("darf_due")].map((h, i) => (
                      <th key={h} style={{
                        padding: "10px 14px",
                        textAlign: i === 0 ? "left" : "right",
                        fontWeight: 600,
                        opacity: 0.7,
                        whiteSpace: "nowrap",
                        color: i === 6 ? "#ef4444" : "inherit"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {darfData.months.map((m: DarfMonth) => {
                    const hasTax = m.tax_brl > 0;
                    const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
                    const cellStyle = (align?: string): React.CSSProperties => ({
                      padding: "11px 14px",
                      textAlign: (align as React.CSSProperties["textAlign"]) ?? "right",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    });
                    return (
                      <tr key={m.month} style={{ opacity: m.has_trades ? 1 : 0.35 }}>
                        <td style={{ ...cellStyle("left"), fontWeight: 700, minWidth: 90 }}>{m.month_name}</td>
                        <td style={cellStyle()}>{m.has_trades ? m.trades_count : "—"}</td>
                        <td style={{ ...cellStyle(), color: m.net_usd >= 0 ? "#22c55e" : "#ef4444" }}>
                          {m.has_trades ? `US$ ${m.net_usd.toFixed(2).replace(".", ",")}` : "—"}
                        </td>
                        <td style={{ ...cellStyle(), color: (m.net_brl ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                          {m.net_brl != null && m.has_trades ? brl(m.net_brl) : "—"}
                        </td>
                        <td style={{ ...cellStyle(), color: m.carryforward < 0 ? "#f59e0b" : "inherit" }}>
                          {m.carryforward < 0 ? brl(m.carryforward) : "—"}
                        </td>
                        <td style={cellStyle()}>{m.taxable_brl > 0 ? brl(m.taxable_brl) : "—"}</td>
                        <td style={{ ...cellStyle(), fontWeight: 700, color: hasTax ? "#ef4444" : "inherit" }}>
                          {hasTax ? brl(m.tax_brl) : "—"}
                        </td>
                        <td style={{ ...cellStyle(), fontSize: 12, opacity: hasTax ? 0.8 : 0.4, whiteSpace: "nowrap" }}>
                          {hasTax ? m.due_date : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="helper" style={{ marginTop: "0.75rem" }}>
              {t("darf_warning")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
