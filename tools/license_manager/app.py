"""
TradersTracker MT5 — Gerenciador de Licenças
Ferramenta interna para gerar e gerenciar chaves de ativação.
"""
import json
import os
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
import httpx
import threading

# ── Configuração ──────────────────────────────────────────────────────────────

SERVER = "https://cheerful-heart-production.up.railway.app"
CONFIG_PATH = Path(os.getenv("APPDATA", "~")) / "TradersTrackerAdmin" / "config.json"

BG       = "#0e1320"
BG2      = "#141b2d"
BG3      = "#1a2235"
GOLD     = "#f5b800"
GOLD2    = "#ffda6a"
GREEN    = "#00e676"
RED      = "#ff5252"
MUTED    = "#8b9ab2"
TEXT     = "#e2e8f0"
FONT     = ("Segoe UI", 10)
FONT_B   = ("Segoe UI", 10, "bold")
FONT_LG  = ("Segoe UI", 13, "bold")
FONT_XL  = ("Segoe UI", 18, "bold")

# ── Persistência de config ────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text())
    except Exception:
        return {"admin_token": ""}

def save_config(cfg: dict):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg))

# ── Cliente HTTP ──────────────────────────────────────────────────────────────

def api(method: str, path: str, token: str, **kwargs):
    headers = {"x-admin-token": token}
    return httpx.request(method, f"{SERVER}{path}", headers=headers, timeout=15, **kwargs)

# ── App principal ─────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.cfg = load_config()
        self.title("TradersTracker MT5 — Gerenciador de Licenças")
        self.geometry("900x620")
        self.resizable(False, False)
        self.configure(bg=BG)
        self._build()
        self.after(100, self._refresh_list)

    # ── Layout ────────────────────────────────────────────────────────────────

    def _build(self):
        # Cabeçalho
        hdr = tk.Frame(self, bg=BG2, pady=14)
        hdr.pack(fill="x")
        tk.Label(hdr, text="TradersTracker MT5", font=FONT_XL,
                 bg=BG2, fg=GOLD).pack(side="left", padx=24)
        tk.Label(hdr, text="Gerenciador de Licenças", font=FONT,
                 bg=BG2, fg=MUTED).pack(side="left")

        # Token no canto direito
        tf = tk.Frame(hdr, bg=BG2)
        tf.pack(side="right", padx=24)
        tk.Label(tf, text="Admin Token:", font=FONT, bg=BG2, fg=MUTED).pack(side="left")
        self.token_var = tk.StringVar(value=self.cfg.get("admin_token", ""))
        te = tk.Entry(tf, textvariable=self.token_var, show="*", width=28,
                      bg=BG3, fg=TEXT, insertbackground=GOLD,
                      relief="flat", font=FONT)
        te.pack(side="left", padx=(6, 4))
        self._btn(tf, "Salvar", self._save_token, small=True).pack(side="left")

        # Notebook (abas)
        style = ttk.Style()
        style.theme_use("default")
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=BG2, foreground=MUTED,
                        padding=[18, 8], font=FONT_B)
        style.map("TNotebook.Tab",
                  background=[("selected", BG3)],
                  foreground=[("selected", GOLD)])

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=0, pady=0)

        self._tab_gerar(nb)
        self._tab_licencas(nb)

    # ── Aba 1: Gerar ─────────────────────────────────────────────────────────

    def _tab_gerar(self, nb):
        frame = tk.Frame(nb, bg=BG)
        nb.add(frame, text="  ＋  Gerar Chave  ")

        inner = tk.Frame(frame, bg=BG2, padx=36, pady=32)
        inner.place(relx=0.5, rely=0.45, anchor="center")

        tk.Label(inner, text="Gerar Nova Chave de Ativação",
                 font=FONT_LG, bg=BG2, fg=TEXT).grid(row=0, column=0, columnspan=2,
                                                       sticky="w", pady=(0, 24))

        labels = ["E-mail do cliente:", "ID da transação (Hotmart):"]
        self.email_var = tk.StringVar()
        self.txn_var   = tk.StringVar()
        vars_ = [self.email_var, self.txn_var]

        for i, (lbl, var) in enumerate(zip(labels, vars_)):
            tk.Label(inner, text=lbl, font=FONT_B, bg=BG2, fg=MUTED).grid(
                row=i+1, column=0, sticky="w", pady=6, padx=(0, 16))
            e = tk.Entry(inner, textvariable=var, width=40,
                         bg=BG3, fg=TEXT, insertbackground=GOLD,
                         relief="flat", font=FONT, highlightthickness=1,
                         highlightbackground=BG3, highlightcolor=GOLD)
            e.grid(row=i+1, column=1, pady=6, ipady=6, padx=4)

        self._btn(inner, "  Gerar Chave  ", self._gerar).grid(
            row=3, column=0, columnspan=2, pady=24)

        # Resultado
        res = tk.Frame(inner, bg=BG3, padx=24, pady=20)
        res.grid(row=4, column=0, columnspan=2, sticky="ew")

        tk.Label(res, text="Chave gerada:", font=FONT, bg=BG3, fg=MUTED).pack(anchor="w")

        key_row = tk.Frame(res, bg=BG3)
        key_row.pack(fill="x", pady=(8, 0))

        self.key_var = tk.StringVar(value="—")
        key_lbl = tk.Label(key_row, textvariable=self.key_var,
                           font=("Consolas", 22, "bold"), bg=BG3, fg=GOLD,
                           pady=6)
        key_lbl.pack(side="left")

        self._btn(key_row, "Copiar", self._copiar, small=True).pack(
            side="left", padx=16)

    # ── Aba 2: Licenças ───────────────────────────────────────────────────────

    def _tab_licencas(self, nb):
        frame = tk.Frame(nb, bg=BG)
        nb.add(frame, text="  ☰  Licenças  ")

        top = tk.Frame(frame, bg=BG, pady=12, padx=16)
        top.pack(fill="x")
        tk.Label(top, text="Todas as licenças", font=FONT_LG, bg=BG, fg=TEXT).pack(side="left")
        self._btn(top, "↻  Atualizar", self._refresh_list, small=True).pack(side="right")

        # Filtro
        filt = tk.Frame(frame, bg=BG, padx=16)
        filt.pack(fill="x", pady=(0, 8))
        tk.Label(filt, text="Filtrar:", font=FONT, bg=BG, fg=MUTED).pack(side="left")
        self.filter_var = tk.StringVar()
        self.filter_var.trace_add("write", lambda *_: self._apply_filter())
        e = tk.Entry(filt, textvariable=self.filter_var, width=30,
                     bg=BG3, fg=TEXT, insertbackground=GOLD, relief="flat", font=FONT)
        e.pack(side="left", padx=8, ipady=4)

        # Tabela
        cols = ("key", "status", "email", "machine", "created")
        style = ttk.Style()
        style.configure("Dark.Treeview",
                        background=BG2, foreground=TEXT,
                        fieldbackground=BG2, rowheight=28, font=FONT)
        style.configure("Dark.Treeview.Heading",
                        background=BG3, foreground=GOLD, font=FONT_B)
        style.map("Dark.Treeview", background=[("selected", BG3)],
                  foreground=[("selected", GOLD)])

        tree_frame = tk.Frame(frame, bg=BG)
        tree_frame.pack(fill="both", expand=True, padx=16, pady=(0, 8))

        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings",
                                  style="Dark.Treeview")
        heads = {"key": ("Chave", 200), "status": ("Status", 90),
                 "email": ("E-mail", 220), "machine": ("Machine ID", 140),
                 "created": ("Criado em", 150)}
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
        self._btn(acts, "⟳  Resetar Máquina", self._reset_machine, color=GOLD).pack(side="left", padx=(0, 12))
        self._btn(acts, "✕  Revogar", self._revogar, color=RED).pack(side="left")

        self._all_rows = []

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _btn(self, parent, text, cmd, small=False, color=None):
        bg = color or GOLD
        fg = "#000" if bg in (GOLD, GOLD2) else TEXT
        font = ("Segoe UI", 9, "bold") if small else FONT_B
        pad = (10, 5) if small else (18, 8)
        return tk.Button(parent, text=text, command=cmd,
                         bg=bg, fg=fg, activebackground=GOLD2,
                         activeforeground="#000", relief="flat",
                         font=font, padx=pad[0], pady=pad[1],
                         cursor="hand2")

    def _token(self):
        return self.token_var.get().strip()

    def _save_token(self):
        self.cfg["admin_token"] = self._token()
        save_config(self.cfg)
        messagebox.showinfo("Salvo", "Token salvo com sucesso.")

    def _copiar(self):
        key = self.key_var.get()
        if key and key != "—":
            self.clipboard_clear()
            self.clipboard_append(key)
            messagebox.showinfo("Copiado", f"Chave copiada:\n{key}")

    # ── Lógica ────────────────────────────────────────────────────────────────

    def _gerar(self):
        email = self.email_var.get().strip()
        txn   = self.txn_var.get().strip()
        token = self._token()
        if not token:
            messagebox.showerror("Erro", "Informe o Admin Token antes de continuar.")
            return
        if not email:
            messagebox.showerror("Erro", "Informe o e-mail do cliente.")
            return

        def run():
            try:
                r = api("POST", "/admin/licenses/generate", token, json={
                    "quantity": 1,
                    "email": email,
                    "transaction_id": txn or None,
                    "max_machines": 1,
                })
                if r.status_code == 200:
                    data = r.json()
                    key = data[0]["key"]
                    self.key_var.set(key)
                    self.email_var.set("")
                    self.txn_var.set("")
                    self._refresh_list()
                else:
                    self.after(0, lambda: messagebox.showerror(
                        "Erro", f"Servidor retornou {r.status_code}:\n{r.text}"))
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro de conexão", str(ex)))

        threading.Thread(target=run, daemon=True).start()

    def _refresh_list(self):
        token = self._token()
        if not token:
            return

        def run():
            try:
                r = api("GET", "/admin/licenses", token)
                if r.status_code == 200:
                    rows = r.json()
                    self.after(0, lambda: self._populate(rows))
            except Exception:
                pass

        threading.Thread(target=run, daemon=True).start()

    def _populate(self, rows):
        self._all_rows = rows
        self._apply_filter()

    def _apply_filter(self):
        q = self.filter_var.get().lower()
        self.tree.delete(*self.tree.get_children())
        for r in self._all_rows:
            row = (
                r.get("key", ""),
                r.get("status", ""),
                r.get("email", "") or "",
                (r.get("machine_id", "") or "")[:16],
                (r.get("created_at", "") or "")[:19].replace("T", " "),
            )
            if not q or any(q in str(v).lower() for v in row):
                tag = r.get("status", "")
                self.tree.insert("", "end", values=row, tags=(tag,))

        self.tree.tag_configure("active",   foreground=GREEN)
        self.tree.tag_configure("inactive", foreground=MUTED)
        self.tree.tag_configure("revoked",  foreground=RED)

    def _selected_key(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Atenção", "Selecione uma licença na lista.")
            return None
        return self.tree.item(sel[0])["values"][0]

    def _reset_machine(self):
        key = self._selected_key()
        if not key:
            return
        if not messagebox.askyesno("Confirmar", f"Resetar máquina da chave:\n{key}?"):
            return

        def run():
            try:
                r = api("POST", f"/admin/licenses/reset-machine?key={key}", self._token())
                if r.status_code == 200:
                    self.after(0, lambda: messagebox.showinfo("OK", "Máquina resetada com sucesso."))
                    self._refresh_list()
                else:
                    self.after(0, lambda: messagebox.showerror("Erro", r.text))
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro", str(ex)))

        threading.Thread(target=run, daemon=True).start()

    def _revogar(self):
        key = self._selected_key()
        if not key:
            return
        if not messagebox.askyesno("Confirmar", f"Revogar permanentemente:\n{key}?"):
            return

        def run():
            try:
                r = api("POST", "/admin/licenses/revoke", self._token(), json={"key": key})
                if r.status_code == 200:
                    self.after(0, lambda: messagebox.showinfo("OK", "Licença revogada."))
                    self._refresh_list()
                else:
                    self.after(0, lambda: messagebox.showerror("Erro", r.text))
            except Exception as ex:
                self.after(0, lambda: messagebox.showerror("Erro", str(ex)))

        threading.Thread(target=run, daemon=True).start()


if __name__ == "__main__":
    app = App()
    app.mainloop()
