import { NavLink } from "react-router-dom";

type TopNavProps = {
  onLogout?: () => void;
  showNav?: boolean;
};

export default function TopNav({ onLogout, showNav = true }: TopNavProps) {
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
