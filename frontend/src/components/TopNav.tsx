import { NavLink } from "react-router-dom";
import { useState } from "react";

type TopNavProps = {
  onLogout?: () => void;
  showNav?: boolean;
  theme?: string;
  onThemeChange?: (theme: string) => void;
};

const themeOptions = [
  { id: "aqua", label: "Aqua (padrão)" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
  { id: "neon", label: "Neon Blue" },
  { id: "violet", label: "Violet" },
  { id: "sand", label: "Desert Sand" },
  { id: "light", label: "Branco" }
];

export default function TopNav({ onLogout, showNav = true, theme = "aqua", onThemeChange }: TopNavProps) {
  const [openSettings, setOpenSettings] = useState(false);

  const handleTheme = (id: string) => {
    onThemeChange?.(id);
    setOpenSettings(false);
  };

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <h1>TradersTrackerMT5</h1>
          <span className="brand-sub">DESENVOLVIDO POR CICERO BISPO</span>
        </div>
        {showNav ? (
          <nav className="nav-links">
            <NavLink to="/">DASHBOARD</NavLink>
            <NavLink to="/upload">UPLOAD</NavLink>
            <NavLink to="/history">HISTÓRICO</NavLink>
            <NavLink to="/profile">PERFIL FISCAL</NavLink>
            <NavLink to="/risk">GERENCIAMENTO DE RISCO</NavLink>
            <div className="settings-wrapper">
              <button type="button" className="settings-btn" onClick={() => setOpenSettings((v) => !v)}>
                ⚙
              </button>
              {openSettings ? (
                <div className="settings-menu">
                  <div className="settings-title">Tema de cores</div>
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`settings-option ${theme === option.id ? "active" : ""}`}
                      onClick={() => handleTheme(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {onLogout ? (
              <button type="button" className="logout-btn" onClick={onLogout}>
                SAIR
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
