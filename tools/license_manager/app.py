"""
TradersTracker MT5 — Gerenciador de Licenças
Ferramenta interna para gerar e gerenciar chaves de ativação.

Funcionalidades:
  - Botões separados para VENDA (Hotmart) e TESTE
  - Validade configurável (vitalício, 30/90/180 dias, 1 ano, personalizado)
  - Geração offline com sincronização automática quando voltar internet
  - Envio de e-mail automático via SMTP
"""
import json
import os
import secrets
import smtplib
import sqlite3
import ssl
import threading
import tkinter as tk
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from tkinter import messagebox, ttk

try:
    import httpx as _httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

# ── Caminhos ──────────────────────────────────────────────────────────────────

SERVER     = "https://cheerful-heart-production.up.railway.app"
APP_DIR    = Path(os.getenv("APPDATA", "~")).expanduser() / "TradersTrackerAdmin"
CONFIG_PATH = APP_DIR / "config.json"
LOCAL_DB   = APP_DIR / "local_licenses.db"

# ── Estilos ───────────────────────────────────────────────────────────────────

BG    = "#0e1320"
BG2   = "#141b2d"
BG3   = "#1a2235"
GOLD  = "#f5b800"
GOLD2 = "#ffda6a"
GREEN = "#00e676"
RED   = "#ff5252"
BLUE  = "#4fc3f7"
MUTED = "#8b9ab2"
TEXT  = "#e2e8f0"

FONT     = ("Segoe UI", 10)
FONT_B   = ("Segoe UI", 10, "bold")
FONT_LG  = ("Segoe UI", 13, "bold")
FONT_XL  = ("Segoe UI", 18, "bold")
FONT_KEY = ("Consolas", 22, "bold")

EXPIRES_OPTIONS = {
    "Vitalício":    None,
    "30 dias":      30,
    "90 dias":      90,
    "180 dias":     180,
    "1 ano":        365,
    "Personalizado": -1,
}

# Charset sem caracteres ambíguos (sem 0/O, 1/I/L)
_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


# ── Geração de chave local ────────────────────────────────────────────────────

def _gen_key() -> str:
    groups = ["".join(secrets.choice(_CHARSET) for _ in range(4)) for _ in range(3)]
    return f"TRKR-{'-'.join(groups)}"


# ── Config ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {
            "admin_token": "",
            "smtp_host": "smtp.gmail.com",
            "smtp_port": "587",
            "smtp_user": "",
            "smtp_pass": "",
            "smtp_from_name": "TradersTracker MT5",
        }


def save_config(cfg: dict):
    APP_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Banco local (offline) ─────────────────────────────────────────────────────

def init_local_db():
    APP_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(LOCAL_DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS licenses (
            key            TEXT PRIMARY KEY,
            status         TEXT NOT NULL DEFAULT 'inactive',
            email          TEXT,
            transaction_id TEXT,
            expires_at     TEXT,
            created_at     TEXT NOT NULL,
            note           TEXT,
            synced         INTEGER NOT NULL DEFAULT 0
        )
    """)
    con.commit()
    con.close()


def local_save(key: str, email: str, txn, expires_at, note: str, synced: bool):
    con = sqlite3.connect(LOCAL_DB)
    con.execute(
        "INSERT OR REPLACE INTO licenses VALUES (?,?,?,?,?,?,?,?)",
        (key, "inactive", email, txn, expires_at,
         datetime.now(timezone.utc).isoformat(), note, int(synced)),
    )
    con.commit()
    con.close()


def local_list() -> list:
    con = sqlite3.connect(LOCAL_DB)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT * FROM licenses ORDER BY created_at DESC").fetchall()
    con.close()
    return [dict(r) for r in rows]


def local_mark_synced(key: str):
    con = sqlite3.connect(LOCAL_DB)
    con.execute("UPDATE licenses SET synced=1 WHERE key=?", (key,))
    con.commit()
    con.close()


def local_delete(key: str):
    con = sqlite3.connect(LOCAL_DB)
    con.execute("DELETE FROM licenses WHERE key=?", (key,))
    con.commit()
    con.close()


# ── API HTTP ──────────────────────────────────────────────────────────────────

def _api_request(method: str, path: str, token: str, payload=None):
    url = f"{SERVER}{path}"
    headers = {"x-admin-token": token, "Content-Type": "application/json"}
    if HAS_HTTPX:
        r = _httpx.request(method, url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        return r.json()
    else:
        import urllib.request
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())


def api_generate(token: str, email: str, txn, expires_at) -> dict:
    payload: dict = {"quantity": 1, "max_machines": 1}
    if email:
        payload["email"] = email
    if txn:
        payload["transaction_id"] = txn
    if expires_at:
        payload["expires_at"] = expires_at
    result = _api_request("POST", "/admin/licenses/generate", token, payload)
    return result[0]


def api_list(token: str) -> list:
    return _api_request("GET", "/admin/licenses", token)


def api_revoke(token: str, key: str) -> dict:
    return _api_request("POST", "/admin/licenses/revoke", token, {"key": key})


def api_reset_machine(token: str, key: str) -> dict:
    if HAS_HTTPX:
        r = _httpx.post(
            f"{SERVER}/admin/licenses/reset-machine",
            params={"key": key},
            headers={"x-admin-token": token},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    else:
        import urllib.request
        req = urllib.request.Request(
            f"{SERVER}/admin/licenses/reset-machine?key={key}",
            data=b"",
            headers={"x-admin-token": token},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())


# ── E-mail ────────────────────────────────────────────────────────────────────

def send_email(cfg: dict, to_email: str, key: str, is_test: bool, expires_label: str):
    tipo = "[TESTE] " if is_test else ""
    exp_line_txt = f"\nValidade: {expires_label}" if expires_label != "Vitalício" else ""
    exp_line_html = (
        f'<p style="color:#8b9ab2;font-size:13px;">Validade: {expires_label}</p>'
        if expires_label != "Vitalício" else ""
    )

    body_html = f"""
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;">
  <div style="background:#0e1320;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h2 style="color:#f5b800;margin:0;">TradersTracker MT5</h2>
    <p style="color:#8b9ab2;margin:4px 0 0;">{tipo}Chave de Ativação</p>
  </div>
  <div style="background:#141b2d;padding:28px 32px;border-radius:0 0 8px 8px;">
    <p style="color:#e2e8f0;">Olá!</p>
    <p style="color:#e2e8f0;">Segue sua chave de licença do <strong>TradersTracker MT5</strong>:</p>
    <div style="background:#0e1320;border:1px solid #1a2235;border-radius:6px;
                padding:20px;text-align:center;margin:20px 0;">
      <code style="font-size:22px;font-weight:bold;color:#f5b800;letter-spacing:2px;">
        {key}
      </code>
    </div>
    {exp_line_html}
    <p style="color:#e2e8f0;">
      Para ativar, abra o aplicativo e insira a chave na tela de ativação.
    </p>
    <p style="color:#8b9ab2;font-size:13px;">
      Em caso de dúvidas, responda este e-mail ou acesse o suporte.
    </p>
  </div>
</div>
"""
    body_text = (
        f"Olá!\n\nSua chave de licença {tipo}TradersTracker MT5:\n\n"
        f"  {key}\n{exp_line_txt}\n\n"
        f"Para ativar, abra o aplicativo e insira a chave na tela de ativação.\n"
        f"Em caso de dúvidas, entre em contato com o suporte."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Sua chave de ativação — TradersTracker MT5"
    msg["From"] = f"{cfg.get('smtp_from_name', 'TradersTracker MT5')} <{cfg['smtp_user']}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    port = int(cfg.get("smtp_port", 587))
    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(cfg["smtp_host"], port, context=ctx) as s:
            s.login(cfg["smtp_user"], cfg["smtp_pass"])
            s.sendmail(cfg["smtp_user"], to_email, msg.as_string())
    else:
        with smtplib.SMTP(cfg["smtp_host"], port) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.login(cfg["smtp_user"], cfg["smtp_pass"])
            s.sendmail(cfg["smtp_user"], to_email, msg.as_string())


# ── App principal ─────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        init_local_db()
        self.cfg = load_config()
        self.title("TradersTracker MT5 — Gerenciador de Licenças")
        self.geometry("980x700")
        self.minsize(860, 600)
        self.resizable(True, True)
        self.configure(bg=BG)

        # Estado da última chave gerada
        self._last_key = ""
        self._last_email = ""
        self._last_is_test = False
        self._last_expires_label = "Vitalício"

        # Dados das listas
        self._server_rows: list = []
        self._local_rows: list = []

        self._build()
        self.after(300, self._refresh_server_list)

    # ── Layout ────────────────────────────────────────────────────────────────

    def _build(self):
        # Cabeçalho
        hdr = tk.Frame(self, bg=BG2, pady=14)
        hdr.pack(fill="x")
        tk.Label(hdr, text="TradersTracker MT5", font=FONT_XL, bg=BG2, fg=GOLD).pack(
            side="left", padx=24)
        tk.Label(hdr, text="Gerenciador de Licenças", font=FONT, bg=BG2, fg=MUTED).pack(
            side="left")

        self.conn_var = tk.StringVar(value="● Verificando...")
        tk.Label(hdr, textvariable=self.conn_var, font=FONT, bg=BG2, fg=MUTED).pack(
            side="right", padx=24)

        # Notebook
        style = ttk.Style()
        style.theme_use("default")
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=BG2, foreground=MUTED,
                        padding=[18, 8], font=FONT_B)
        style.map("TNotebook.Tab",
                  background=[("selected", BG3)],
                  foreground=[("selected", GOLD)])

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True)
        nb.bind("<<NotebookTabChanged>>", lambda e: self._on_tab(nb))

        self._build_tab_gerar(nb)
        self._build_tab_licencas(nb)
        self._build_tab_config(nb)

    # ── Aba 1: Gerar Chave ────────────────────────────────────────────────────

    def _build_tab_gerar(self, nb):
        outer = tk.Frame(nb, bg=BG)
        nb.add(outer, text="  ＋  Gerar Chave  ")

        inner = tk.Frame(outer, bg=BG2, padx=44, pady=32)
        inner.place(relx=0.5, rely=0.48, anchor="center")
        inner.columnconfigure(1, weight=1)

        tk.Label(inner, text="Nova Chave de Ativação",
                 font=FONT_LG, bg=BG2, fg=TEXT).grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 22))

        # Identificação
        tk.Label(inner, text="Identificação do cliente (opcional):", font=FONT_B, bg=BG2, fg=MUTED).grid(
            row=1, column=0, sticky="w", padx=(0, 18), pady=7)
        self.email_var = tk.StringVar()
        self._entry(inner, self.email_var, width=40).grid(
            row=1, column=1, sticky="ew", ipady=7, pady=7)

        self.txn_var = tk.StringVar()

        # Validade
        tk.Label(inner, text="Validade:", font=FONT_B, bg=BG2, fg=MUTED).grid(
            row=2, column=0, sticky="w", padx=(0, 18), pady=7)
        exp_frame = tk.Frame(inner, bg=BG2)
        exp_frame.grid(row=2, column=1, sticky="w", pady=7)

        self.expires_var = tk.StringVar(value="Vitalício")
        cb = ttk.Combobox(exp_frame, textvariable=self.expires_var,
                          values=list(EXPIRES_OPTIONS.keys()),
                          state="readonly", width=18, font=FONT)
        cb.pack(side="left")
        cb.bind("<<ComboboxSelected>>", self._on_expires_change)

        self.custom_date_var = tk.StringVar()
        self._custom_date_entry = self._entry(exp_frame, self.custom_date_var, width=13)
        # oculto por padrão
        tk.Label(exp_frame, text="DD/MM/AAAA",
                 font=("Segoe UI", 8), bg=BG2, fg=MUTED).pack(side="left", padx=(6, 0))
        self._custom_lbl = exp_frame.winfo_children()[-1]
        self._custom_date_entry.pack_forget()
        self._custom_lbl.pack_forget()

        # Separador
        tk.Frame(inner, bg=BG3, height=1).grid(
            row=3, column=0, columnspan=2, sticky="ew", pady=(18, 14))

        # Botões de geração
        btn_frame = tk.Frame(inner, bg=BG2)
        btn_frame.grid(row=4, column=0, columnspan=2, sticky="ew")
        btn_frame.columnconfigure(0, weight=1)
        btn_frame.columnconfigure(1, weight=1)

        self._btn(
            btn_frame,
            "  GERAR LICENÇA  (VENDA)  ",
            lambda: self._gerar(is_test=False),
            color=GOLD,
        ).grid(row=0, column=0, sticky="ew", ipadx=6, ipady=12, padx=(0, 8))

        self._btn(
            btn_frame,
            "  GERAR LICENÇA  TESTE  ",
            lambda: self._gerar(is_test=True),
            color=BLUE,
        ).grid(row=0, column=1, sticky="ew", ipadx=6, ipady=12)

        # Resultado
        tk.Frame(inner, bg=BG3, height=1).grid(
            row=6, column=0, columnspan=2, sticky="ew", pady=(18, 10))

        tk.Label(inner, text="Chave gerada:", font=FONT, bg=BG2, fg=MUTED).grid(
            row=7, column=0, columnspan=2, sticky="w")

        key_box = tk.Frame(inner, bg=BG3, padx=24, pady=18)
        key_box.grid(row=8, column=0, columnspan=2, sticky="ew", pady=(6, 0))

        self.key_var = tk.StringVar(value="—")
        tk.Label(key_box, textvariable=self.key_var,
                 font=FONT_KEY, bg=BG3, fg=GOLD).pack()

        self.key_info_var = tk.StringVar(value="")
        tk.Label(key_box, textvariable=self.key_info_var,
                 font=("Segoe UI", 9), bg=BG3, fg=MUTED).pack(pady=(4, 0))

        # Ações pós-geração
        acts = tk.Frame(inner, bg=BG2)
        acts.grid(row=9, column=0, columnspan=2, sticky="ew", pady=(14, 0))
        acts.columnconfigure(0, weight=1)
        acts.columnconfigure(1, weight=1)
        acts.columnconfigure(2, weight=1)

        self.btn_copy = self._btn(acts, "Copiar chave", self._copiar, small=True)
        self.btn_copy.grid(row=0, column=0, sticky="ew", ipadx=4, ipady=7, padx=(0, 6))
        self.btn_copy.config(state="disabled")

        self.btn_msg = self._btn(acts, "Copiar mensagem", self._copiar_mensagem, small=True)
        self.btn_msg.grid(row=0, column=1, sticky="ew", ipadx=4, ipady=7, padx=(0, 6))
        self.btn_msg.config(state="disabled")

        self.btn_email_send = self._btn(
            acts, "Enviar por e-mail", self._enviar_email, small=True, color=GREEN)
        self.btn_email_send.grid(row=0, column=2, sticky="ew", ipadx=4, ipady=7)
        self.btn_email_send.config(state="disabled")

        # Status
        self.status_var = tk.StringVar()
        tk.Label(inner, textvariable=self.status_var,
                 font=FONT, bg=BG2, fg=GREEN,
                 wraplength=560, justify="left").grid(
            row=10, column=0, columnspan=2, sticky="w", pady=(12, 0))

    # ── Aba 2: Licenças ───────────────────────────────────────────────────────

    def _build_tab_licencas(self, nb):
        frame = tk.Frame(nb, bg=BG)
        nb.add(frame, text="  ☰  Licenças  ")

        # Barra superior
        top = tk.Frame(frame, bg=BG, pady=12, padx=16)
        top.pack(fill="x")
        tk.Label(top, text="Licenças geradas", font=FONT_LG, bg=BG, fg=TEXT).pack(side="left")

        self.sync_btn = self._btn(
            top, "⟳  Sincronizar pendentes", self._sync_pending, small=True, color=BLUE)
        self.sync_btn.pack(side="right", padx=(8, 0))
        self._btn(top, "↻  Atualizar servidor", self._refresh_server_list,
                  small=True).pack(side="right")

        # Filtro + fonte
        ctrl = tk.Frame(frame, bg=BG, padx=16)
        ctrl.pack(fill="x", pady=(0, 8))

        tk.Label(ctrl, text="Filtrar:", font=FONT, bg=BG, fg=MUTED).pack(side="left")
        self.filter_var = tk.StringVar()
        self.filter_var.trace_add("write", lambda *_: self._apply_filter())
        self._entry(ctrl, self.filter_var, width=28).pack(
            side="left", padx=(6, 20), ipady=4)

        tk.Label(ctrl, text="Exibir:", font=FONT, bg=BG, fg=MUTED).pack(side="left")
        self.src_var = tk.StringVar(value="Servidor")
        for opt in ("Servidor", "Local (offline)"):
            tk.Radiobutton(
                ctrl, text=opt, variable=self.src_var, value=opt,
                font=FONT, bg=BG, fg=TEXT, selectcolor=BG3,
                activebackground=BG, activeforeground=GOLD,
                command=self._apply_filter,
            ).pack(side="left", padx=6)

        # Tabela
        cols = ("key", "status", "email", "transaction", "expires", "created", "sync")
        heads = {
            "key":         ("Chave",      185),
            "status":      ("Status",      82),
            "email":       ("E-mail",     195),
            "transaction": ("ID Hotmart", 130),
            "expires":     ("Validade",   110),
            "created":     ("Criado em",  140),
            "sync":        ("Sync",        80),
        }

        style = ttk.Style()
        style.configure("Dark.Treeview",
                        background=BG2, foreground=TEXT,
                        fieldbackground=BG2, rowheight=28, font=FONT)
        style.configure("Dark.Treeview.Heading",
                        background=BG3, foreground=GOLD, font=FONT_B)
        style.map("Dark.Treeview",
                  background=[("selected", BG3)],
                  foreground=[("selected", GOLD)])

        tree_frame = tk.Frame(frame, bg=BG)
        tree_frame.pack(fill="both", expand=True, padx=16, pady=(0, 8))

        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings",
                                 style="Dark.Treeview")
        for col, (txt, w) in heads.items():
            self.tree.heading(col, text=txt)
            self.tree.column(col, width=w, anchor="w")

        sb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscroll=sb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        # Ações
        acts = tk.Frame(frame, bg=BG, padx=16, pady=10)
        acts.pack(fill="x")
        self._btn(acts, "⟳  Resetar Máquina", self._reset_machine, color=GOLD).pack(
            side="left", padx=(0, 12))
        self._btn(acts, "✕  Revogar", self._revogar, color=RED).pack(side="left")

        self.list_status_var = tk.StringVar()
        tk.Label(acts, textvariable=self.list_status_var,
                 font=FONT, bg=BG, fg=MUTED).pack(side="left", padx=16)

    # ── Aba 3: Configurações ──────────────────────────────────────────────────

    def _build_tab_config(self, nb):
        outer = tk.Frame(nb, bg=BG)
        nb.add(outer, text="  ⚙  Configurações  ")

        inner = tk.Frame(outer, bg=BG2, padx=44, pady=32)
        inner.place(relx=0.5, rely=0.46, anchor="center")
        inner.columnconfigure(1, weight=1)

        row = [0]  # mutável para closure

        def label_section(text):
            tk.Label(inner, text=text, font=FONT_B, bg=BG2, fg=GOLD).grid(
                row=row[0], column=0, columnspan=2, sticky="w", pady=(0, 8))
            row[0] += 1

        def sep():
            tk.Frame(inner, bg=BG3, height=1).grid(
                row=row[0], column=0, columnspan=2, sticky="ew", pady=14)
            row[0] += 1

        def field(label, var, show=None, width=36):
            tk.Label(inner, text=label, font=FONT_B, bg=BG2, fg=MUTED).grid(
                row=row[0], column=0, sticky="w", padx=(0, 18), pady=6)
            kw = {"show": show} if show else {}
            self._entry(inner, var, width=width, **kw).grid(
                row=row[0], column=1, sticky="ew", ipady=7, pady=6)
            row[0] += 1

        tk.Label(inner, text="Configurações do Sistema",
                 font=FONT_LG, bg=BG2, fg=TEXT).grid(
            row=row[0], column=0, columnspan=2, sticky="w", pady=(0, 24))
        row[0] += 1

        label_section("Servidor de Licenças")
        self.token_var = tk.StringVar(value=self.cfg.get("admin_token", ""))
        field("Admin Token:", self.token_var, show="*")

        sep()
        label_section("Envio de E-mail (SMTP)")

        self.smtp_host_var = tk.StringVar(value=self.cfg.get("smtp_host", "smtp.gmail.com"))
        self.smtp_port_var = tk.StringVar(value=self.cfg.get("smtp_port", "587"))
        self.smtp_user_var = tk.StringVar(value=self.cfg.get("smtp_user", ""))
        self.smtp_pass_var = tk.StringVar(value=self.cfg.get("smtp_pass", ""))
        self.smtp_name_var = tk.StringVar(value=self.cfg.get("smtp_from_name", "TradersTracker MT5"))

        field("Servidor SMTP:", self.smtp_host_var)
        field("Porta:", self.smtp_port_var, width=8)
        field("Usuário (e-mail remetente):", self.smtp_user_var)
        field("Senha / App Password:", self.smtp_pass_var, show="*")
        field("Nome do remetente:", self.smtp_name_var)

        sep()
        btn_row = tk.Frame(inner, bg=BG2)
        btn_row.grid(row=row[0], column=0, columnspan=2, sticky="ew")
        self._btn(btn_row, "  Salvar configurações  ", self._save_config).pack(side="left")
        self._btn(btn_row, "Testar e-mail", self._test_email,
                  small=True, color=BLUE).pack(side="left", padx=(14, 0))

    # ── Helpers de widget ─────────────────────────────────────────────────────

    def _entry(self, parent, var, width=36, **kw):
        return tk.Entry(
            parent, textvariable=var, width=width,
            bg=BG3, fg=TEXT, insertbackground=GOLD,
            relief="flat", font=FONT,
            highlightthickness=1,
            highlightbackground=BG3,
            highlightcolor=GOLD,
            **kw,
        )

    def _btn(self, parent, text, cmd, small=False, color=None):
        bg  = color or GOLD
        fg  = "#000" if bg in (GOLD, GOLD2) else TEXT
        fnt = ("Segoe UI", 9, "bold") if small else FONT_B
        pad = (10, 5) if small else (18, 8)
        return tk.Button(
            parent, text=text, command=cmd,
            bg=bg, fg=fg,
            activebackground=GOLD2, activeforeground="#000",
            relief="flat", font=fnt,
            padx=pad[0], pady=pad[1],
            cursor="hand2",
        )

    # ── Validade ──────────────────────────────────────────────────────────────

    def _on_expires_change(self, _=None):
        if self.expires_var.get() == "Personalizado":
            self._custom_date_entry.pack(side="left", padx=(10, 0), ipady=6)
            self._custom_lbl.pack(side="left", padx=4)
        else:
            self._custom_date_entry.pack_forget()
            self._custom_lbl.pack_forget()

    def _get_expires(self):
        """Retorna (iso_str | None, label_legível). Retorna ('ERROR', '') em caso de data inválida."""
        opt  = self.expires_var.get()
        days = EXPIRES_OPTIONS.get(opt)

        if days is None:      # Vitalício
            return None, "Vitalício"
        if days == -1:        # Personalizado
            raw = self.custom_date_var.get().strip()
            try:
                dt = datetime.strptime(raw, "%d/%m/%Y").replace(tzinfo=timezone.utc)
                return dt.isoformat(), dt.strftime("%d/%m/%Y")
            except ValueError:
                messagebox.showerror("Erro", "Data inválida. Use o formato DD/MM/AAAA.")
                return "ERROR", ""
        dt = datetime.now(timezone.utc) + timedelta(days=days)
        return dt.isoformat(), f"{opt} ({dt.strftime('%d/%m/%Y')})"

    # ── Gerar chave ───────────────────────────────────────────────────────────

    def _gerar(self, is_test: bool):
        email = self.email_var.get().strip()
        txn   = self.txn_var.get().strip()
        token = self.token_var.get().strip()

        if is_test and txn:
            if not messagebox.askyesno(
                "Aviso",
                "Modo TESTE selecionado mas o campo ID Hotmart está preenchido.\n"
                "Deseja continuar como TESTE (o ID será ignorado)?",
            ):
                return
            txn = ""

        expires_iso, expires_label = self._get_expires()
        if expires_iso == "ERROR":
            return

        self.status_var.set("Gerando chave…")
        self.update()

        def run():
            # Gera chave offline imediatamente
            key    = _gen_key()
            synced = False

            # Tenta registrar no servidor
            if token:
                try:
                    data   = api_generate(token, email, txn or None, expires_iso)
                    key    = data["key"]
                    synced = True
                except Exception:
                    pass  # offline — usa chave local

            note = "TESTE" if is_test else ("VENDA" if txn else "MANUAL")
            local_save(key, email, txn or None, expires_iso, note, synced)

            def update_ui():
                self._last_key           = key
                self._last_email         = email
                self._last_is_test       = is_test
                self._last_expires_label = expires_label

                self.key_var.set(key)

                tipo = "TESTE" if is_test else "VENDA"
                info = f"[{tipo}]   Validade: {expires_label}"
                if not synced:
                    info += "   ⚠ Offline — sincronize quando houver internet"
                self.key_info_var.set(info)

                self.btn_copy.config(state="normal")
                self.btn_msg.config(state="normal")
                self.btn_email_send.config(state="normal")

                msg = "✓ Chave gerada com sucesso!"
                if not synced:
                    msg = "✓ Chave salva localmente (offline). Clique em Sincronizar quando tiver internet."
                self.status_var.set(msg)

            self.after(0, update_ui)

        threading.Thread(target=run, daemon=True).start()

    # ── Copiar ────────────────────────────────────────────────────────────────

    def _copiar(self):
        if self._last_key:
            self.clipboard_clear()
            self.clipboard_append(self._last_key)
            self.status_var.set("Chave copiada para a área de transferência!")

    def _copiar_mensagem(self):
        if not self._last_key:
            return
        exp  = self._last_expires_label
        el   = f"\nValidade: {exp}" if exp != "Vitalício" else ""
        tipo = "[TESTE] " if self._last_is_test else ""
        txt = (
            f"Olá! Segue sua chave de licença {tipo}do TradersTracker MT5:\n\n"
            f"  {self._last_key}\n{el}\n\n"
            f"Para ativar, abra o aplicativo e insira a chave na tela de ativação.\n"
            f"Em caso de dúvidas, entre em contato com o suporte."
        )
        self.clipboard_clear()
        self.clipboard_append(txt)
        self.status_var.set("Mensagem copiada para a área de transferência!")

    # ── E-mail ────────────────────────────────────────────────────────────────

    def _enviar_email(self):
        if not self._last_key or not self._last_email:
            return
        user = self.smtp_user_var.get().strip()
        pwd  = self.smtp_pass_var.get().strip()
        if not user or not pwd:
            messagebox.showerror(
                "Configuração",
                "Configure o servidor SMTP na aba Configurações antes de enviar e-mails.",
            )
            return

        cfg_smtp = {
            "smtp_host":      self.smtp_host_var.get().strip(),
            "smtp_port":      self.smtp_port_var.get().strip(),
            "smtp_user":      user,
            "smtp_pass":      pwd,
            "smtp_from_name": self.smtp_name_var.get().strip(),
        }
        key    = self._last_key
        email  = self._last_email
        is_t   = self._last_is_test
        exp_lbl = self._last_expires_label

        self.status_var.set("Enviando e-mail…")
        self.btn_email_send.config(state="disabled")
        self.update()

        def run():
            try:
                send_email(cfg_smtp, email, key, is_t, exp_lbl)
                self.after(0, lambda: self.status_var.set(f"✓ E-mail enviado para {email}!"))
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro ao enviar e-mail", str(ex)))
            finally:
                self.after(0, lambda: self.btn_email_send.config(state="normal"))

        threading.Thread(target=run, daemon=True).start()

    # ── Lista de licenças ─────────────────────────────────────────────────────

    def _on_tab(self, nb):
        if nb.index("current") == 1:
            self._refresh_server_list()

    def _refresh_server_list(self):
        token = self.token_var.get().strip()
        if not token:
            self.conn_var.set("● Sem token")
            self._local_rows = local_list()
            self._apply_filter()
            return

        def run():
            try:
                rows = api_list(token)
                self._server_rows = rows
                self.after(0, lambda: self.conn_var.set("● Online"))
            except Exception:
                self.after(0, lambda: self.conn_var.set("● Offline"))
            finally:
                self._local_rows = local_list()
                self.after(0, self._apply_filter)

        threading.Thread(target=run, daemon=True).start()

    def _apply_filter(self):
        q   = self.filter_var.get().lower()
        src = self.src_var.get()
        rows = self._server_rows if src == "Servidor" else self._local_rows

        self.tree.delete(*self.tree.get_children())
        count = 0

        for r in rows:
            exp = r.get("expires_at") or ""
            if exp and "T" in exp:
                exp = exp[:10]

            sync = ""
            if "synced" in r:
                sync = "✓ sync" if r.get("synced") else "⚠ pendente"

            vals = (
                r.get("key", ""),
                r.get("status", ""),
                r.get("email", "") or "",
                r.get("transaction_id", "") or "",
                exp or "Vitalício",
                (r.get("created_at", "") or "")[:16].replace("T", " "),
                sync,
            )
            if not q or any(q in str(v).lower() for v in vals):
                tag = r.get("status", "inactive")
                if "synced" in r and not r.get("synced"):
                    tag = "pending"
                self.tree.insert("", "end", values=vals, tags=(tag,))
                count += 1

        self.tree.tag_configure("active",   foreground=GREEN)
        self.tree.tag_configure("inactive", foreground=MUTED)
        self.tree.tag_configure("revoked",  foreground=RED)
        self.tree.tag_configure("pending",  foreground=BLUE)
        self.list_status_var.set(f"{count} licenças exibidas")

    def _selected_key(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Atenção", "Selecione uma licença na lista.")
            return None
        return self.tree.item(sel[0])["values"][0]

    def _reset_machine(self):
        key   = self._selected_key()
        token = self.token_var.get().strip()
        if not key:
            return
        if not messagebox.askyesno("Confirmar", f"Resetar máquina da chave:\n{key}?"):
            return

        def run():
            try:
                api_reset_machine(token, key)
                self.after(0, lambda: messagebox.showinfo("OK", "Máquina resetada com sucesso."))
                self._refresh_server_list()
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro", str(ex)))

        threading.Thread(target=run, daemon=True).start()

    def _revogar(self):
        key   = self._selected_key()
        token = self.token_var.get().strip()
        if not key:
            return
        if not messagebox.askyesno("Confirmar", f"Revogar permanentemente:\n{key}?"):
            return

        def run():
            try:
                api_revoke(token, key)
                local_delete(key)
                self.after(0, lambda: messagebox.showinfo("OK", "Licença revogada."))
                self._refresh_server_list()
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro", str(ex)))

        threading.Thread(target=run, daemon=True).start()

    def _sync_pending(self):
        token = self.token_var.get().strip()
        if not token:
            messagebox.showerror("Erro", "Configure o Admin Token primeiro.")
            return
        pending = [r for r in local_list() if not r["synced"]]
        if not pending:
            messagebox.showinfo("Sincronizar", "Nenhuma chave pendente de sincronização.")
            return

        self.sync_btn.config(state="disabled")
        self.list_status_var.set(f"Sincronizando {len(pending)} chaves…")

        def run():
            ok = fail = 0
            for r in pending:
                try:
                    api_generate(token, r["email"] or "", r.get("transaction_id"),
                                 r.get("expires_at"))
                    local_mark_synced(r["key"])
                    ok += 1
                except Exception:
                    fail += 1

            def done():
                self.sync_btn.config(state="normal")
                msg = f"✓ Sincronizados: {ok}"
                if fail:
                    msg += f"   ✗ Com falha: {fail}"
                self.list_status_var.set(msg)
                self._refresh_server_list()

            self.after(0, done)

        threading.Thread(target=run, daemon=True).start()

    # ── Configurações ─────────────────────────────────────────────────────────

    def _save_config(self):
        self.cfg = {
            "admin_token":    self.token_var.get().strip(),
            "smtp_host":      self.smtp_host_var.get().strip(),
            "smtp_port":      self.smtp_port_var.get().strip(),
            "smtp_user":      self.smtp_user_var.get().strip(),
            "smtp_pass":      self.smtp_pass_var.get().strip(),
            "smtp_from_name": self.smtp_name_var.get().strip(),
        }
        save_config(self.cfg)
        messagebox.showinfo("Salvo", "Configurações salvas com sucesso.")

    def _test_email(self):
        user = self.smtp_user_var.get().strip()
        if not user:
            messagebox.showerror("Erro", "Configure o usuário SMTP primeiro.")
            return
        cfg_smtp = {
            "smtp_host":      self.smtp_host_var.get().strip(),
            "smtp_port":      self.smtp_port_var.get().strip(),
            "smtp_user":      user,
            "smtp_pass":      self.smtp_pass_var.get().strip(),
            "smtp_from_name": self.smtp_name_var.get().strip(),
        }
        fake_key = "TRKR-TEST-0000-ABCD"
        fake_exp = f"30 dias ({(datetime.now() + timedelta(days=30)).strftime('%d/%m/%Y')})"

        def run():
            try:
                send_email(cfg_smtp, user, fake_key, True, fake_exp)
                self.after(0, lambda: messagebox.showinfo(
                    "E-mail teste", f"E-mail de teste enviado para {user}!"))
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro", str(ex)))

        threading.Thread(target=run, daemon=True).start()


# ── Entrada ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.mainloop()
