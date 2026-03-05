import { useCallback, useEffect, useState } from "react";
import { fetchFiscalProfile, saveFiscalProfile, FiscalProfile } from "../api";

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
  const [status, setStatus] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetchFiscalProfile();
      setProfile(normalizeProfile(response));
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
      setCepStatus("Informe 8 d?gitos do CEP.");
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
        setCepStatus("CEP n?o encontrado.");
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
      setCepStatus("Endere?o preenchido pelo CEP.");
    } catch (err) {
      setCepStatus((err as Error).message);
    }
  }, []);

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

        <div className="helper">Ap?s salvar, os dados s?o usados no c?lculo e PDF do DARF.</div>

        <div className="form-row">
          <label>
            Nome completo
            <input
              type="text"
              value={profile.full_name}
              onChange={(event) => setProfile((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </label>
          <label>
            CPF
            <input
              type="text"
              value={profile.cpf}
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
              value={profile.street}
              onChange={(event) => setProfile((prev) => ({ ...prev, street: event.target.value }))}
            />
          </label>
          <label>
            N?mero
            <input
              type="text"
              value={profile.number}
              onChange={(event) => setProfile((prev) => ({ ...prev, number: event.target.value }))}
            />
          </label>
          <label>
            Complemento
            <input
              type="text"
              value={profile.complement}
              onChange={(event) => setProfile((prev) => ({ ...prev, complement: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Bairro
            <input
              type="text"
              value={profile.neighborhood}
              onChange={(event) => setProfile((prev) => ({ ...prev, neighborhood: event.target.value }))}
            />
          </label>
          <label>
            Cidade
            <input
              type="text"
              value={profile.city}
              onChange={(event) => setProfile((prev) => ({ ...prev, city: event.target.value }))}
            />
          </label>
          <label>
            Estado
            <input
              type="text"
              value={profile.state}
              onChange={(event) => setProfile((prev) => ({ ...prev, state: event.target.value }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Corretora
            <input
              type="text"
              value={profile.broker}
              onChange={(event) => setProfile((prev) => ({ ...prev, broker: event.target.value }))}
            />
          </label>
          <label>
            Conta
            <input
              type="text"
              value={profile.trading_account}
              onChange={(event) => setProfile((prev) => ({ ...prev, trading_account: event.target.value }))}
            />
          </label>
          <label>
            Moeda da conta
            <select
              value={profile.account_currency}
              onChange={(event) => setProfile((prev) => ({ ...prev, account_currency: event.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </label>
          <label>
            Al?quota padr?o %
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
    </div>
  );
}
