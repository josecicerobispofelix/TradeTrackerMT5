# Deploy do serviço de licença (FastAPI + Uvicorn) na Hostinger (Ubuntu)

## Pré-requisitos
- VPS Ubuntu (Hostinger).
- Domínio apontado para o IP da VPS (ex.: license.seudominio.com).
- Python 3.10+ instalado (ou use venv).

## Variáveis
- LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K
- APP_DIR=/opt/tradetracker/backend
- DOMAIN=license.seudominio.com

## Passos

### 1) Instalar dependências
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nginx
```

### 2) Copiar o backend
```bash
sudo mkdir -p /opt/tradetracker
sudo chown $USER:$USER /opt/tradetracker
cd /opt/tradetracker
# copie o repositório ou sincronize (git/rsync/scp)
# exemplo: git clone https://github.com/SEU_USER/TradeTrackerMT5.git .
```

### 3) Criar venv e instalar requisitos
```bash
cd /opt/tradetracker/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4) Definir env (LICENSE_SECRET)
Crie `/opt/tradetracker/backend/.env`:
```
LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K
APP_HOST=127.0.0.1
APP_PORT=8000
```

### 5) systemd service
Crie `/etc/systemd/system/tradetracker-license.service`:
```
[Unit]
Description=TradeTrackerMT5 License API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/tradetracker/backend
Environment="LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K"
ExecStart=/opt/tradetracker/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
Ativar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tradetracker-license
sudo systemctl start tradetracker-license
sudo systemctl status tradetracker-license
```

### 6) Nginx (proxy + SSL)
Crie `/etc/nginx/sites-available/tradetracker-license`:
```
server {
    listen 80;
    server_name license.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Ative:
```bash
sudo ln -s /etc/nginx/sites-available/tradetracker-license /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7) Certbot (HTTPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d license.seudominio.com
```
Certifique-se de abrir portas 80/443 na VPS.

### 8) Testar
```bash
curl https://license.seudominio.com/api/license/status
curl -X POST https://license.seudominio.com/api/license/activate -H "Content-Type: application/json" -d '{"key":"TESTE"}'
```

### 9) Chaves
Gerar no servidor (opcional) com o mesmo segredo:
```bash
cd /opt/tradetracker/backend
source .venv/bin/activate
LICENSE_SECRET=TTMT5-PRD-20260310-X9E4FQ3K python tools/generate_license_keys.py --machine <MACHINE_CODE>
```

### 10) App (frontend/desktop)
Configure o app para usar a API pública:
```
VITE_API_URL=https://license.seudominio.com
```
Rebuild/patche o frontend se necessário.
