import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useLang } from "../LangContext";
import { LANG_LABEL, Lang } from "../i18n";

type TopNavProps = {
  onLogout?: () => void;
  showNav?: boolean;
  theme?: string;
  onThemeChange?: (theme: string) => void;
};

const themeOptions = [
  { id: "neon",  labelKey: "theme_neon"  },
  { id: "dark",  labelKey: "theme_dark"  },
  { id: "ocean", labelKey: "theme_ocean" },
  { id: "rose",  labelKey: "theme_rose"  },
  { id: "amber", labelKey: "theme_amber" },
  { id: "light", labelKey: "theme_white" },
] as const;

const langOptions = Object.entries(LANG_LABEL) as [Lang, string][];

export default function TopNav({ onLogout, showNav = true, theme = "neon", onThemeChange }: TopNavProps) {
  const [openSettings, setOpenSettings] = useState(false);
  const { lang, setLang, t } = useLang();

  const handleTheme = (id: string) => {
    onThemeChange?.(id);
    setOpenSettings(false);
  };

  const handleLang = (l: Lang) => {
    setLang(l);
    setOpenSettings(false);
  };

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <h1>TradersTrackerMT5</h1>
          <span className="brand-sub">{t("brand_sub")}</span>
        </div>
        {showNav ? (
          <nav className="nav-links">
            <NavLink to="/">{t("nav_dashboard")}</NavLink>
            <NavLink to="/upload">{t("nav_upload")}</NavLink>
            <NavLink to="/history">{t("nav_history")}</NavLink>
            <NavLink to="/profile">{t("nav_profile")}</NavLink>
            <NavLink to="/robot-tests">{t("nav_robot")}</NavLink>
            <div className="settings-wrapper">
              <button type="button" className="settings-btn" onClick={() => setOpenSettings((v) => !v)}>
                ⚙
              </button>
              {openSettings ? (
                <div className="settings-menu">
                  <div className="settings-title">{t("nav_theme")}</div>
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`settings-option ${theme === option.id ? "active" : ""}`}
                      onClick={() => handleTheme(option.id)}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                  <div className="settings-title" style={{ marginTop: "0.75rem" }}>{t("nav_language")}</div>
                  {langOptions.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`settings-option ${lang === id ? "active" : ""}`}
                      onClick={() => handleLang(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {onLogout ? (
              <button type="button" className="logout-btn" onClick={onLogout}>
                {t("nav_logout")}
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
