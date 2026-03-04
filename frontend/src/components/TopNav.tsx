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
          <h1>TradeTrackerMT5</h1>
          <span>Painel de trades MetaTrader 5</span>
        </div>
        {showNav ? (
          <nav className="nav-links">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/upload">Upload</NavLink>
            <NavLink to="/history">Histórico</NavLink>
            {onLogout ? (
              <button type="button" className="logout-btn" onClick={onLogout}>
                Sair
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
