"""
TradeTracker - Gerador de Licencas
App desktop para gerar chaves de ativacao e enviar aos clientes.
"""

import json
import os
import sys
import tkinter as tk
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, ttk

# ── Configuracao ─────────────────────────────────────────────────────────────

env_file = Path(__file__).parent.parent / ".env.admin"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
SERVER = os.getenv(
    "LICENSE_SERVER_URL",
    "https://cheerful-heart-production.up.railway.app",
)

# ── Cores e estilos ──────────────────────────────────────────────────────────

BG = "#1a1a2e"
BG2 = "#16213e"
BG3 = "#0f3460"
ACCENT = "#e94560"
GREEN = "#4ecca3"
TEXT = "#eaeaea"
TEXT2 = "#a0a0b0"
FONT_MAIN = ("Segoe UI", 10)
FONT_BOLD = ("Segoe UI", 10, "bold")
FONT_KEY = ("Courier New", 18, "bold")
FONT_TITLE = ("Segoe UI", 14, "bold")


# ── API ──────────────────────────────────────────────────────────────────────

def api_generate(email: str, transaction_id: str | None) -> dict:
    payload = {"email": email, "quantity": 1}
    if transaction_id:
        payload["transaction_id"] = transaction_id

    req = urllib.request.Request(
        f"{SERVER}/admin/licenses/generate",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Admin-Token": ADMIN_TOKEN,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())[0]


def api_list() -> list:
    req = urllib.request.Request(
        f"{SERVER}/admin/licenses",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def api_revoke(key: str) -> dict:
    payload = {"key": key}
    req = urllib.request.Request(
        f"{SERVER}/admin/licenses/revoke",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Admin-Token": ADMIN_TOKEN,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


# ── App ───────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("TradeTracker - Gerenciador de Licencas")
        self.geometry("780x600")
        self.minsize(700, 520)
        self.configure(bg=BG)
        self.resizable(True, True)

        # Tenta centralizar na tela
        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - 780) // 2
        y = (sh - 600) // 2
        self.geometry(f"780x600+{x}+{y}")

        self._build()

    def _build(self):
        # Cabecalho
        header = tk.Frame(self, bg=BG3, pady=14)
        header.pack(fill="x")
        tk.Label(
            header,
            text="TradeTracker  |  Gerenciador de Licencas",
            font=FONT_TITLE,
            bg=BG3,
            fg=TEXT,
        ).pack()

        # Abas
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=BG2, foreground=TEXT2,
                        padding=[16, 6], font=FONT_BOLD)
        style.map("TNotebook.Tab",
                  background=[("selected", BG3)],
                  foreground=[("selected", TEXT)])

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=0, pady=0)

        self.tab_gen = tk.Frame(nb, bg=BG)
        self.tab_list = tk.Frame(nb, bg=BG)
        nb.add(self.tab_gen, text="  Gerar Chave  ")
        nb.add(self.tab_list, text="  Chaves Geradas  ")
        nb.bind("<<NotebookTabChanged>>", lambda e: self._on_tab(nb))

        self._build_gen(self.tab_gen)
        self._build_list(self.tab_list)

    # ── Aba Gerar ─────────────────────────────────────────────────────────────

    def _build_gen(self, parent):
        wrap = tk.Frame(parent, bg=BG, padx=40, pady=30)
        wrap.pack(fill="both", expand=True)

        # Email
        tk.Label(wrap, text="Email do cliente", font=FONT_BOLD, bg=BG, fg=TEXT2).grid(
            row=0, column=0, sticky="w", pady=(0, 4))
        self.var_email = tk.StringVar()
        e_email = tk.Entry(wrap, textvariable=self.var_email, font=FONT_MAIN,
                           bg=BG2, fg=TEXT, insertbackground=TEXT,
                           relief="flat", bd=0, highlightthickness=1,
                           highlightbackground=BG3, highlightcolor=ACCENT)
        e_email.grid(row=1, column=0, columnspan=2, sticky="ew", ipady=8, padx=(0, 0))
        e_email.bind("<Return>", lambda e: self._gerar())

        # Transaction ID
        tk.Label(wrap, text="ID da transacao Hotmart  (opcional — deixe em branco para testes)",
                 font=FONT_BOLD, bg=BG, fg=TEXT2).grid(
            row=2, column=0, sticky="w", pady=(18, 4))
        self.var_txn = tk.StringVar()
        e_txn = tk.Entry(wrap, textvariable=self.var_txn, font=FONT_MAIN,
                         bg=BG2, fg=TEXT, insertbackground=TEXT,
                         relief="flat", bd=0, highlightthickness=1,
                         highlightbackground=BG3, highlightcolor=ACCENT)
        e_txn.grid(row=3, column=0, columnspan=2, sticky="ew", ipady=8)
        e_txn.bind("<Return>", lambda e: self._gerar())

        wrap.columnconfigure(0, weight=1)

        # Botao gerar
        btn = tk.Button(
            wrap,
            text="  GERAR CHAVE  ",
            font=("Segoe UI", 11, "bold"),
            bg=ACCENT, fg="white",
            activebackground="#c73652", activeforeground="white",
            relief="flat", cursor="hand2", bd=0,
            command=self._gerar,
        )
        btn.grid(row=4, column=0, columnspan=2, pady=(24, 0), ipadx=10, ipady=10, sticky="ew")

        # Separador
        tk.Frame(wrap, bg=BG3, height=1).grid(row=5, column=0, columnspan=2, sticky="ew", pady=24)

        # Chave gerada
        tk.Label(wrap, text="Chave gerada", font=FONT_BOLD, bg=BG, fg=TEXT2).grid(
            row=6, column=0, sticky="w", pady=(0, 6))

        key_frame = tk.Frame(wrap, bg=BG2, padx=16, pady=14)
        key_frame.grid(row=7, column=0, columnspan=2, sticky="ew")

        self.var_key = tk.StringVar(value="—")
        lbl_key = tk.Label(key_frame, textvariable=self.var_key,
                           font=FONT_KEY, bg=BG2, fg=GREEN, anchor="center")
        lbl_key.pack(fill="x")

        # Botoes copiar / msg
        btn_row = tk.Frame(wrap, bg=BG)
        btn_row.grid(row=8, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        btn_row.columnconfigure(0, weight=1)
        btn_row.columnconfigure(1, weight=1)

        self.btn_copy = tk.Button(
            btn_row, text="Copiar chave",
            font=FONT_BOLD, bg=BG3, fg=TEXT,
            activebackground=ACCENT, activeforeground="white",
            relief="flat", cursor="hand2", bd=0,
            command=self._copiar_chave, state="disabled",
        )
        self.btn_copy.grid(row=0, column=0, sticky="ew", ipadx=6, ipady=7, padx=(0, 6))

        self.btn_msg = tk.Button(
            btn_row, text="Copiar mensagem completa",
            font=FONT_BOLD, bg=BG3, fg=TEXT,
            activebackground=ACCENT, activeforeground="white",
            relief="flat", cursor="hand2", bd=0,
            command=self._copiar_mensagem, state="disabled",
        )
        self.btn_msg.grid(row=0, column=1, sticky="ew", ipadx=6, ipady=7)

        # Status
        self.var_status = tk.StringVar()
        tk.Label(wrap, textvariable=self.var_status,
                 font=FONT_MAIN, bg=BG, fg=GREEN, wraplength=600, justify="left").grid(
            row=9, column=0, columnspan=2, sticky="w", pady=(12, 0))

        self._last_key = None
        self._last_email = None

    def _gerar(self):
        email = self.var_email.get().strip()
        txn = self.var_txn.get().strip() or None

        if not email:
            messagebox.showwarning("Campo obrigatorio", "Informe o email do cliente.")
            return
        if not ADMIN_TOKEN:
            messagebox.showerror("Configuracao", "ADMIN_TOKEN nao encontrado.\nVerifique o arquivo .env.admin.")
            return

        self.var_status.set("Gerando chave...")
        self.update()

        try:
            data = api_generate(email, txn)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            self.var_status.set("")
            messagebox.showerror("Erro do servidor", f"HTTP {e.code}: {body}")
            return
        except Exception as ex:
            self.var_status.set("")
            messagebox.showerror("Erro de conexao", str(ex))
            return

        self._last_key = data["key"]
        self._last_email = email
        self._last_txn = txn

        self.var_key.set(data["key"])
        self.btn_copy.config(state="normal")
        self.btn_msg.config(state="normal")

        tipo = "VENDA" if txn else "TESTE"
        self.var_status.set(f"[{tipo}] Chave gerada com sucesso em {datetime.now().strftime('%H:%M:%S')}")

    def _copiar_chave(self):
        if self._last_key:
            self.clipboard_clear()
            self.clipboard_append(self._last_key)
            self.var_status.set("Chave copiada para a area de transferencia!")

    def _copiar_mensagem(self):
        if not self._last_key:
            return
        msg = (
            f"Ola! Segue sua chave de licenca do TradeTrackerMT5:\n\n"
            f"  {self._last_key}\n\n"
            f"Para ativar, abra o aplicativo e insira a chave na tela de ativacao.\n"
            f"Em caso de duvidas, entre em contato com o suporte."
        )
        self.clipboard_clear()
        self.clipboard_append(msg)
        self.var_status.set("Mensagem copiada para a area de transferencia!")

    # ── Aba Lista ─────────────────────────────────────────────────────────────

    def _build_list(self, parent):
        top = tk.Frame(parent, bg=BG, padx=20, pady=14)
        top.pack(fill="x")

        tk.Button(
            top, text="Atualizar lista",
            font=FONT_BOLD, bg=BG3, fg=TEXT,
            activebackground=ACCENT, activeforeground="white",
            relief="flat", cursor="hand2", bd=0,
            command=self._load_list, padx=14, pady=6,
        ).pack(side="left")

        self.btn_revoke = tk.Button(
            top, text="Revogar selecionada",
            font=FONT_BOLD, bg="#6b2737", fg=TEXT,
            activebackground=ACCENT, activeforeground="white",
            relief="flat", cursor="hand2", bd=0,
            command=self._revogar, padx=14, pady=6, state="disabled",
        )
        self.btn_revoke.pack(side="left", padx=(10, 0))

        self.var_list_status = tk.StringVar()
        tk.Label(top, textvariable=self.var_list_status,
                 font=FONT_MAIN, bg=BG, fg=GREEN).pack(side="left", padx=16)

        # Tabela
        cols = ("key", "status", "email", "transaction_id", "created_at", "activated_at")
        heads = ("Chave", "Status", "Email", "Transacao", "Criada em", "Ativada em")

        style = ttk.Style()
        style.configure("Treeview", background=BG2, foreground=TEXT,
                        fieldbackground=BG2, rowheight=26, font=FONT_MAIN)
        style.configure("Treeview.Heading", background=BG3, foreground=TEXT,
                        font=FONT_BOLD, relief="flat")
        style.map("Treeview", background=[("selected", BG3)],
                  foreground=[("selected", GREEN)])

        frame_tree = tk.Frame(parent, bg=BG)
        frame_tree.pack(fill="both", expand=True, padx=20, pady=(0, 14))

        self.tree = ttk.Treeview(frame_tree, columns=cols, show="headings",
                                 selectmode="browse")
        widths = [160, 80, 180, 140, 120, 120]
        for col, head, w in zip(cols, heads, widths):
            self.tree.heading(col, text=head)
            self.tree.column(col, width=w, anchor="w", stretch=False)

        scroll_y = ttk.Scrollbar(frame_tree, orient="vertical", command=self.tree.yview)
        scroll_x = ttk.Scrollbar(frame_tree, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)

        scroll_y.pack(side="right", fill="y")
        scroll_x.pack(side="bottom", fill="x")
        self.tree.pack(fill="both", expand=True)

        self.tree.tag_configure("active", foreground=GREEN)
        self.tree.tag_configure("revoked", foreground=ACCENT)
        self.tree.tag_configure("inactive", foreground=TEXT2)
        self.tree.bind("<<TreeviewSelect>>",
                       lambda e: self.btn_revoke.config(state="normal"))

    def _on_tab(self, nb):
        if nb.index("current") == 1:
            self._load_list()

    def _load_list(self):
        self.var_list_status.set("Carregando...")
        self.update()
        try:
            licenses = api_list()
        except Exception as ex:
            self.var_list_status.set("")
            messagebox.showerror("Erro", str(ex))
            return

        for item in self.tree.get_children():
            self.tree.delete(item)

        def fmt(v):
            if not v:
                return "-"
            if "T" in str(v):
                return str(v)[:16].replace("T", " ")
            return str(v)

        for lic in licenses:
            tag = lic.get("status", "inactive")
            self.tree.insert("", "end", iid=lic["key"], values=(
                lic["key"],
                lic.get("status", "-"),
                lic.get("email") or "-",
                lic.get("transaction_id") or "-",
                fmt(lic.get("created_at")),
                fmt(lic.get("activated_at")),
            ), tags=(tag,))

        total = len(licenses)
        ativos = sum(1 for l in licenses if l.get("status") == "active")
        self.var_list_status.set(f"{total} chaves  |  {ativos} ativas")

    def _revogar(self):
        sel = self.tree.selection()
        if not sel:
            return
        key = sel[0]
        if not messagebox.askyesno("Confirmar", f"Revogar a chave:\n{key}\n\nEsta acao nao pode ser desfeita."):
            return
        try:
            api_revoke(key)
        except Exception as ex:
            messagebox.showerror("Erro", str(ex))
            return
        self._load_list()
        self.var_list_status.set(f"Chave {key} revogada.")


if __name__ == "__main__":
    if not ADMIN_TOKEN:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Configuracao",
            "ADMIN_TOKEN nao encontrado.\n\nCrie o arquivo .env.admin na raiz do projeto com:\n  ADMIN_TOKEN=sua-senha-aqui",
        )
        sys.exit(1)

    app = App()
    app.mainloop()
