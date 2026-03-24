path = 'frontend/src/pages/Dashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────
# 1. Add clockNow state near the first useState in Dashboard
# ─────────────────────────────────────────────────────────────
FROM_STATE = '  const [from, setFrom] = useState(toDateInput(startOfMonth));'
idx = content.find(FROM_STATE)
assert idx != -1, "from state not found"

clock_state = """  const [clockNow, setClockNow] = useState(new Date());

"""

content = content[:idx] + clock_state + content[idx:]
print("Step 1: clockNow state added")

# ─────────────────────────────────────────────────────────────
# 2. Add clock useEffect near other useEffects
#    Insert just after the Dashboard function opens its state block
#    We find a useEffect already in the file and add before the first one
# ─────────────────────────────────────────────────────────────
FIRST_USEEFFECT = '  useEffect(() => {'
ue_idx = content.find(FIRST_USEEFFECT)
assert ue_idx != -1, "useEffect not found"

clock_effect = """  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

"""

content = content[:ue_idx] + clock_effect + content[ue_idx:]
print("Step 2: clock useEffect added")

# ─────────────────────────────────────────────────────────────
# 3. Insert market clock panel after the hero section closing </div>
#    and before the error check / stat-grid
# ─────────────────────────────────────────────────────────────
HERO_CLOSE = '          </div>\n\n\n\n\n\n\n\n          {error ? <div className="panel">Erro: {error}</div> : null}'
hero_idx = content.find(HERO_CLOSE)

# Try alternate spacing if not found
if hero_idx == -1:
    # Find error panel
    ERROR_PANEL = '          {error ? <div className="panel">Erro: {error}</div> : null}'
    error_idx = content.find(ERROR_PANEL)
    assert error_idx != -1, "error panel not found"
    insert_idx = error_idx
else:
    insert_idx = hero_idx + len('          </div>\n\n\n\n\n\n\n\n')

market_clock_panel = """
          {/* ── Relógio de Mercado ─────────────────────────── */}
          {(() => {
            const h = clockNow.getHours();
            const min = clockNow.getMinutes();
            const dow = clockNow.getDay(); // 0=Dom,1=Seg,...,5=Sex,6=Sab

            // Forex abre domingo 18h BRT, fecha sexta 18h BRT
            const forexOpen =
              !(dow === 6) &&
              !(dow === 0 && h < 18) &&
              !(dow === 5 && (h > 18 || (h === 18 && min > 0)));

            const pad = (n: number) => String(n).padStart(2, '0');
            const timeStr = `${pad(h)}:${pad(min)}`;

            const isOpen = (startH: number, endH: number) => {
              if (!forexOpen) return false;
              if (startH < endH) return h >= startH && h < endH;
              return h >= startH || h < endH;
            };

            const sessions = [
              { name: 'Sydney',   emoji: '🦘', start: 18, end: 3,  color: '#22c55e', desc: 'Asiática' },
              { name: 'Tóquio',   emoji: '🗼', start: 21, end: 6,  color: '#22c55e', desc: 'Asiática' },
              { name: 'Londres',  emoji: '🎡', start: 3,  end: 12, color: '#3b82f6', desc: 'Europeia' },
              { name: 'Nova York',emoji: '🗽', start: 9,  end: 18, color: '#ef4444', desc: 'Americana' },
            ];

            const overlapOpen = forexOpen && h >= 9 && h < 13;

            return (
              <div className="panel market-clock-panel">
                <div className="panel-header">
                  <h4>🕒 Horário de mercado</h4>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '15px', fontWeight: 700, opacity: 0.9 }}>
                    {timeStr} BRT &nbsp;
                    <span style={{ fontSize: '12px', fontWeight: 600, color: forexOpen ? 'var(--accent)' : '#94a3b8' }}>
                      {forexOpen ? '● Forex aberto' : '● Forex fechado'}
                    </span>
                  </span>
                </div>

                <div className="market-sessions">
                  {sessions.map(s => {
                    const open = isOpen(s.start, s.end);
                    return (
                      <div key={s.name} className={`market-session ${open ? 'open' : 'closed'}`}>
                        <div className="ms-header">
                          <span className="ms-flag">{s.emoji}</span>
                          <span className="ms-name">{s.name}</span>
                          <span className="ms-badge" style={{ background: open ? s.color + '33' : undefined, color: open ? s.color : undefined }}>
                            {open ? 'aberto' : 'fechado'}
                          </span>
                        </div>
                        <div className="ms-hours">{s.start}h → {s.end}h</div>
                        <div className="ms-desc">{s.desc}</div>
                      </div>
                    );
                  })}

                  <div className={`market-session overlap ${overlapOpen ? 'open' : 'closed'}`}>
                    <div className="ms-header">
                      <span className="ms-flag">🔥</span>
                      <span className="ms-name">Londres + NY</span>
                      <span className="ms-badge" style={{ background: overlapOpen ? '#f59e0b33' : undefined, color: overlapOpen ? '#f59e0b' : undefined }}>
                        {overlapOpen ? 'AGORA' : 'aguardando'}
                      </span>
                    </div>
                    <div className="ms-hours">9h → 13h</div>
                    <div className="ms-desc">Melhor horário • +50% do volume</div>
                  </div>
                </div>
              </div>
            );
          })()}

"""

content = content[:insert_idx] + market_clock_panel + content[insert_idx:]
print("Step 3: Market clock panel added")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done! Size: {len(content)} chars")
