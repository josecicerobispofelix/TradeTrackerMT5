import React, { createContext, useContext, useState } from "react";
import { Lang, TKey, LANG_STORAGE_KEY, t as _t } from "./i18n";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
};

const LangContext = createContext<LangCtx>({
  lang: "pt",
  setLang: () => {},
  t: (key) => _t(key, "pt"),
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(LANG_STORAGE_KEY) as Lang | null) ?? "pt"
  );

  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_STORAGE_KEY, l);
    setLangState(l);
  };

  const t = (key: TKey) => _t(key, lang);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
