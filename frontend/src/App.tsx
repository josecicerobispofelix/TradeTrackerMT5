import { Suspense, lazy, useEffect, useState, useRef } from "react";
import { Route, Routes } from "react-router-dom";
import {
  activateLicense,
  fetchMe,
  getLicenseStatus,
  LicenseStatus,
  loginUser,
  registerUser,
  logoutUser,
  User
} from "./api";
import TopNav from "./components/TopNav";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const History = lazy(() => import("./pages/History"));
const Profile = lazy(() => import("./pages/Profile"));
const RobotTests = lazy(() => import("./pages/RobotTests"));

export default function App() {
  const MIN_PASSWORD_LEN = 6;
  const THEME_KEY = "ttmt5_theme";
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? "aqua");
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let ticker = 0;

    const rand = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = Math.max(window.innerHeight, 720);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (typeof ctx.resetTransform === "function") {
        ctx.resetTransform();
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);
      // base tint to ensure visibility
      ctx.fillStyle = "rgba(0, 40, 70, 0.55)";
      ctx.fillRect(0, 0, width, height);

      // grid background (forte)
      ctx.fillStyle = "rgba(0, 255, 255, 0.75)";
      const gridSize = 48;
      for (let x = -((ticker / 2) % gridSize); x < width; x += gridSize) {
        ctx.fillRect(x, 0, 3, height);
      }
      for (let y = -((ticker / 2) % gridSize); y < height; y += gridSize) {
        ctx.fillRect(0, y, width, 3);
      }

      // price path
      const steps = 100;
      const stepX = width / steps;
      let y = height * 0.55;
      const path: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const drift = Math.sin((i + ticker * 0.01) * 0.12) * 8;
        const noise = (rand(i + ticker) - 0.5) * 5;
        y = Math.min(height * 0.85, Math.max(height * 0.2, y + drift + noise));
        path.push({ x: i * stepX, y });
      }

      // gradient stroke
      const stroke = ctx.createLinearGradient(0, 0, width, 0);
      stroke.addColorStop(0, "rgba(0,255,255,1)");
      stroke.addColorStop(0.6, "rgba(0,200,255,1)");
      stroke.addColorStop(1, "rgba(255,128,64,1)");
      ctx.lineWidth = 8;
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      path.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // underfill
      const fill = ctx.createLinearGradient(0, 0, 0, height);
      fill.addColorStop(0, "rgba(0,255,255,0.55)");
      fill.addColorStop(0.7, "rgba(0,180,255,0.35)");
      fill.addColorStop(1, "rgba(0,180,255,0)");
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(path[0].x, height);
      path.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(path[path.length - 1].x, height);
      ctx.closePath();
      ctx.fill();

      // candles every few steps
      for (let i = 3; i < path.length; i += 4) {
        const center = path[i];
        const candleH = 40 + rand(i + ticker * 1.3) * 48;
        const candleW = 18;
        const high = center.y - candleH * 0.6;
        const low = center.y + candleH * 0.4;
        const bodyTop = Math.min(center.y, high + candleH * 0.38);
        const bodyBottom = Math.max(center.y, high + candleH * 0.62);

        // wick
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(center.x, high);
        ctx.lineTo(center.x, low);
        ctx.stroke();

        const isBull = rand(i + ticker * 2) > 0.45;
        const bodyColor = isBull ? "rgba(0,255,255,0.95)" : "rgba(255,64,128,0.95)";
        const outline = isBull ? "rgba(0,255,255,1)" : "rgba(255,64,128,1)";

        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1.6;
        ctx.fillRect(center.x - candleW / 2, bodyTop, candleW, bodyBottom - bodyTop);
        ctx.strokeRect(center.x - candleW / 2, bodyTop, candleW, bodyBottom - bodyTop);
      }

      ticker += 1;
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
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
    if (!authPassword) {
      setAuthError("Preencha a senha.");
      return;
    }
    try {
      const me = await loginUser({ password: authPassword });
      setUser(me);
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    setAuthMessage(null);
    if (authPassword.length < MIN_PASSWORD_LEN) {
      setAuthError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (authPassword !== authPassword2) {
      setAuthError("As senhas não conferem");
      return;
    }
    try {
      const me = await registerUser({ email: "admin", password: authPassword });
      setUser(me);
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
      <div className="activation-screen">
        <canvas ref={bgCanvasRef} className="bg-chart" aria-hidden />
        <div className="activation-card">
          <div className="activation-logo"><img src="/logo.png" alt="TradeTracker MT5" /></div>
          <h1 className="activation-title">TradeTracker MT5</h1>
          <p className="activation-subtitle">
            Digite sua chave de licença para ativar o software.
          </p>
          <input
            className="activation-input"
            type="text"
            placeholder="TRKR-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleActivate()}
            maxLength={19}
            autoFocus
            spellCheck={false}
          />
          {licenseError ? (
            <div className="activation-error">{licenseError}</div>
          ) : null}
          <button
            className="activation-btn"
            type="button"
            onClick={handleActivate}
            disabled={licenseLoading || !licenseKey.trim()}
          >
            {licenseLoading ? "Verificando..." : "Ativar licença"}
          </button>
          <p className="activation-help">
            Ainda não tem uma chave?{" "}
            <a href="https://hotmart.com" target="_blank" rel="noreferrer">
              Comprar agora
            </a>
          </p>
        </div>
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
              <h4>{authMode === "register" ? "Configurar senha" : "Entrar"}</h4>
              <span>{authMode === "register" ? "Defina a senha de acesso ao sistema." : "Digite sua senha para continuar."}</span>
            </div>
            <div className="form-row">
              <label>
                Senha
                <div className="input-with-toggle">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && authMode === "login" && handleLogin()}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                  </button>
                </div>
              </label>
              {authMode === "register" ? (
                <label>
                  Confirmar senha
                  <div className="input-with-toggle">
                    <input
                      type={showPassword2 ? "text" : "password"}
                      value={authPassword2}
                      onChange={(event) => setAuthPassword2(event.target.value)}
                    />
                    <button
                      type="button"
                      className="toggle-eye"
                      onClick={() => setShowPassword2((v) => !v)}
                      aria-label={showPassword2 ? "Ocultar senha" : "Mostrar senha"}
                      title={showPassword2 ? "Ocultar senha" : "Mostrar senha"}
                    >
                    </button>
                  </div>
                </label>
              ) : null}
              {authMode === "login" ? (
                <button type="button" onClick={handleLogin} disabled={!authPassword}>
                  Entrar
                </button>
              ) : (
                <button type="button" onClick={handleRegister}>
                  Salvar senha
                </button>
              )}
              <button
                type="button"
                className="btn-link"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login" ? "Configurar senha" : "Voltar ao login"}
              </button>
            </div>
            {authError ? <div className="helper">{authError}</div> : null}
            {authMessage ? <div className="helper">{authMessage}</div> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <canvas ref={bgCanvasRef} className="bg-chart" aria-hidden />
      <TopNav onLogout={handleLogout} showNav theme={theme} onThemeChange={setTheme} />
      <main className="content">
        <Suspense fallback={<div className="panel">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/robot-tests" element={<RobotTests />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
