import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import {
  activateLicense,
  fetchMe,
  getLicenseStatus,
  LicenseStatus,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  logoutUser,
  User
} from "./api";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import History from "./pages/History";
import TopNav from "./components/TopNav";

export default function App() {
  const MIN_PASSWORD_LEN = 6;
  const AUTH_EMAIL_KEY = "ttmt5_auth_email";
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">(
    "login"
  );
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetTokenHint, setResetTokenHint] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(AUTH_EMAIL_KEY);
    if (savedEmail) {
      setAuthEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    const loadLicense = async () => {
      try {
        const status = await getLicenseStatus();
        setLicense(status);
      } catch (err) {
        setLicense({
          activated: false,
          machine_code: ""
        });
        setLicenseError((err as Error).message);
      }
    };
    loadLicense();
  }, []);

  useEffect(() => {
    if (!license?.activated) return;
    const loadUser = async () => {
      setAuthChecked(false);
      try {
        const me = await fetchMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    loadUser();
  }, [license?.activated]);

  const handleActivate = async () => {
    if (!license) return;
    setLicenseLoading(true);
    setLicenseError(null);
    try {
      const status = await activateLicense(licenseKey);
      setLicense(status);
      setLicenseKey("");
    } catch (err) {
      setLicenseError((err as Error).message);
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    setAuthMessage(null);
    try {
      const me = await loginUser({ email: authEmail, password: authPassword });
      if (authEmail.trim()) {
        localStorage.setItem(AUTH_EMAIL_KEY, authEmail.trim());
      }
      setUser(me);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    setAuthMessage(null);
    if (!authEmail.trim()) {
      setAuthError("Informe o e-mail.");
      return;
    }
    if (authPassword.length < MIN_PASSWORD_LEN) {
      setAuthError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (authPassword !== authPassword2) {
      setAuthError("As senhas não conferem");
      return;
    }
    try {
      const me = await registerUser({
        email: authEmail,
        password: authPassword
      });
      if (authEmail.trim()) {
        localStorage.setItem(AUTH_EMAIL_KEY, authEmail.trim());
      }
      setUser(me);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleRequestReset = async () => {
    setAuthError(null);
    setAuthMessage(null);
    try {
      const res = await requestPasswordReset(authEmail);
      setAuthMessage(res.message);
      if (res.reset_token) {
        setResetTokenHint(res.reset_token);
      }
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleResetPassword = async () => {
    setAuthError(null);
    setAuthMessage(null);
    if (authPassword.length < MIN_PASSWORD_LEN) {
      setAuthError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    try {
      await resetPassword({ token: authToken, new_password: authPassword });
      setAuthMessage("Senha redefinida. Faça login.");
      setAuthMode("login");
      setAuthPassword("");
      setAuthToken("");
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setAuthMode("login");
    setAuthPassword("");
    setAuthPassword2("");
    setAuthToken("");
  };

  if (!license) {
    return (
      <div className="app-shell">
        <TopNav showNav={false} />
        <main className="content">
          <div className="panel">Carregando licença...</div>
        </main>
      </div>
    );
  }

  if (!license.activated) {
    return (
      <div className="app-shell">
        <TopNav showNav={false} />
        <main className="content">
          <div className="panel activation-card">
            <div className="panel-header">
              <h4>Ativação necessária</h4>
              <span>Informe a chave de licença para liberar o uso.</span>
            </div>
            <div className="form-row">
              <label>
                Código da máquina
                <input type="text" value={license.machine_code} readOnly />
              </label>
              <label>
                Chave de licença
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                />
              </label>
              <button type="button" onClick={handleActivate} disabled={licenseLoading}>
                {licenseLoading ? "Ativando..." : "Ativar"}
              </button>
            </div>
            {licenseError ? <div className="helper">{licenseError}</div> : null}
            <div className="helper">
              Envie o código da máquina para receber sua chave de licença.
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="app-shell">
        <TopNav showNav={false} />
        <main className="content">
          <div className="panel">Carregando usuário...</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <TopNav showNav={false} />
        <main className="content">
          <div className="panel activation-card">
            <div className="panel-header">
              <h4>Login obrigatório</h4>
              <span>Crie seu login ou entre para continuar.</span>
            </div>
            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Entrar
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Criar conta
              </button>
              <button
                type="button"
                className={authMode === "reset" ? "active" : ""}
                onClick={() => setAuthMode("reset")}
              >
                Recuperar senha
              </button>
            </div>

            <div className="form-row">
              <label>
                E-mail
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="seu@email.com"
                />
              </label>
              {authMode !== "reset" ? (
                <label>
                  Senha
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                  />
                </label>
              ) : null}
              {authMode === "register" ? (
                <label>
                  Confirmar senha
                  <input
                    type="password"
                    value={authPassword2}
                    onChange={(event) => setAuthPassword2(event.target.value)}
                  />
                </label>
              ) : null}
              {authMode === "reset" ? (
                <>
                  <label>
                    Token de recuperação
                    <input
                      type="text"
                      value={authToken}
                      onChange={(event) => setAuthToken(event.target.value)}
                      placeholder="TOKEN"
                    />
                  </label>
                  <label>
                    Nova senha
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {authMode === "login" ? (
                <button type="button" onClick={handleLogin}>
                  Entrar
                </button>
              ) : null}
              {authMode === "register" ? (
                <button type="button" onClick={handleRegister}>
                  Criar conta
                </button>
              ) : null}
              {authMode === "reset" ? (
                <>
                  <button type="button" onClick={handleRequestReset}>
                    Enviar token
                  </button>
                  <button type="button" onClick={handleResetPassword}>
                    Redefinir senha
                  </button>
                </>
              ) : null}
            </div>

            {authMode === "login" && authEmail.trim() ? (
              <div className="helper">
                E-mail salvo. Preencha apenas a senha para entrar.
              </div>
            ) : null}
            {authError ? <div className="helper">{authError}</div> : null}
            {authMessage ? <div className="helper">{authMessage}</div> : null}
            {resetTokenHint ? (
              <div className="helper">Token gerado: {resetTokenHint}</div>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopNav onLogout={handleLogout} showNav />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
