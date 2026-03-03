import { NavLink } from "react-router-dom";

export default function TopNav() {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <h1>TradeTrackerMT5</h1>
          <span>Painel de trades MetaTrader 5</span>
        </div>
        <nav className="nav-links">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/upload">Upload</NavLink>
          <NavLink to="/history">Histórico</NavLink>
        </nav>
      </div>
    </header>
  );
}
