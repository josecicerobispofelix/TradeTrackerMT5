import sys

path = 'frontend/src/pages/Dashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

orig_len = len(content)
print(f"Original size: {orig_len} chars")

# ─────────────────────────────────────────────
# 1. Add new metric computations before the return of computeMetrics
# ─────────────────────────────────────────────
STREAKS_MARKER = '  const streaks = calculateStreaks(trades, getProfitValue);'
streaks_idx = content.find(STREAKS_MARKER)
assert streaks_idx != -1, "streaks marker not found"

RETURN_MARKER = '  return {'
return_idx = content.find(RETURN_MARKER, streaks_idx)
assert return_idx != -1, "return { not found after streaks"

new_metrics = """

  // Novas metricas para day trader
  const avgDurationMin: number = trades.length > 0
    ? Math.round(trades.reduce((sum, t) =>
        sum + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()), 0)
        / trades.length / 60000)
    : 0;

  const totalTradingDays = dailyMap.size;
  const profitableDaysCount = Array.from(dailyMap.values()).filter(d => d.net > 0).length;
  const profitableDaysPct: number = totalTradingDays > 0 ? profitableDaysCount / totalTradingDays : 0;

  const breakevenWinRate: number = payoff > 0 ? 1 / (1 + payoff) : 0.5;

  const tradedDaysList = dayOfWeek.filter(d => d.trades > 0);
  const bestDay = tradedDaysList.length > 0
    ? tradedDaysList.reduce((b, d) => d.net > b.net ? d : b)
    : null;
  const worstDay = tradedDaysList.length > 0
    ? tradedDaysList.reduce((w, d) => d.net < w.net ? d : w)
    : null;

  const hourAggData: { hour: number; net: number; trades: number }[] = [];
  for (let h = 0; h < 24; h++) {
    let hNet = 0, hTrades = 0;
    for (let dw = 0; dw < 7; dw++) { hNet += heatmap[dw][h]; hTrades += heatmapCount[dw][h]; }
    if (hTrades > 0) hourAggData.push({ hour: h, net: hNet, trades: hTrades });
  }
  const bestHour = hourAggData.length > 0 ? hourAggData.reduce((b, h) => h.net > b.net ? h : b) : null;
  const worstHour = hourAggData.length > 0 ? hourAggData.reduce((w, h) => h.net < w.net ? h : w) : null;

"""

content = content[:streaks_idx + len(STREAKS_MARKER)] + new_metrics + content[return_idx:]
print("Step 1: New metrics inserted")

# ─────────────────────────────────────────────
# 2. Add new fields to the return object of computeMetrics
# ─────────────────────────────────────────────
OLD_RETURN_TAIL = '    streakLoss: streaks.maxLoss'
idx = content.find(OLD_RETURN_TAIL)
assert idx != -1, "streakLoss not found in return"

NEW_RETURN_TAIL = """    streakLoss: streaks.maxLoss,
    avgDurationMin,
    profitableDaysPct,
    breakevenWinRate,
    bestDay,
    worstDay,
    bestHour,
    worstHour"""

content = content[:idx] + NEW_RETURN_TAIL + content[idx + len(OLD_RETURN_TAIL):]
print("Step 2: Return object extended")

# ─────────────────────────────────────────────
# 3. Remove FX Rate and DARF panels
# ─────────────────────────────────────────────
CHART_GRID_MARKER = '          <div className="chart-grid">'
chart_idx = content.find(CHART_GRID_MARKER)
assert chart_idx != -1, "chart-grid not found"

FX_H4_MARKER = '<h4>Taxa USD/BRL</h4>'
fx_h4_idx = content.find(FX_H4_MARKER)
assert fx_h4_idx != -1, "Taxa USD/BRL not found"

FX_DIV_MARKER = '            <div className="panel">'
fx_div_idx = content.rfind(FX_DIV_MARKER, 0, fx_h4_idx)
assert fx_div_idx != -1, "FX panel opening div not found"

PANEL_GRID_CLOSE = '          </div>'
panel_grid_close_idx = content.rfind(PANEL_GRID_CLOSE, 0, chart_idx)
assert panel_grid_close_idx != -1, "panel-grid close not found"

content = content[:fx_div_idx] + content[panel_grid_close_idx:]
print(f"Step 3: Removed FX+DARF panels")

# ─────────────────────────────────────────────
# 4. Add 3 new KPI cards to stat-grid
# ─────────────────────────────────────────────
DRAWDOWN_CARD_MARKER = '{formatCurrency(metrics.drawdown, currency)}'
dd_idx = content.find(DRAWDOWN_CARD_MARKER)
assert dd_idx != -1, "drawdown card not found"

# Find 2 closing </div> after drawdown (card-value, card), then stat-grid </div>
pos = dd_idx
for i in range(2):
    pos = content.find('</div>', pos) + len('</div>')
stat_grid_close_idx = content.find('</div>', pos)

new_kpi_cards = """

            <div
              className="card small"
              title="Tempo medio entre abertura e fechamento de cada operacao."
            >
              <div className="card-title">Duracao media</div>
              <div className="card-value">
                {metrics.avgDurationMin < 60
                  ? `${metrics.avgDurationMin}min`
                  : `${Math.floor(metrics.avgDurationMin / 60)}h ${metrics.avgDurationMin % 60}min`}
              </div>
            </div>

            <div
              className="card small"
              title="Percentual de dias operados com resultado positivo. Acima de 60% indica boa consistencia."
            >
              <div className="card-title">Dias lucrativos</div>
              <div className="card-value" style={{
                color: metrics.profitableDaysPct >= 0.6 ? 'var(--accent)' : metrics.profitableDaysPct >= 0.4 ? '#f59e0b' : '#ef4444'
              }}>
                {formatPercent(metrics.profitableDaysPct)}
              </div>
            </div>

            <div
              className="card small"
              title="Taxa de acerto minima para a estrategia ser lucrativa dado o payoff atual. Se sua taxa real for menor, voce perde no longo prazo."
            >
              <div className="card-title">Breakeven</div>
              <div className="card-value" style={{
                color: metrics.winRate >= metrics.breakevenWinRate ? 'var(--accent)' : '#ef4444'
              }}>
                {formatPercent(metrics.breakevenWinRate)}
                <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: 4 }}>
                  {metrics.winRate >= metrics.breakevenWinRate ? 'ok' : 'atencao'}
                </span>
              </div>
            </div>
"""

content = content[:stat_grid_close_idx] + new_kpi_cards + content[stat_grid_close_idx:]
print("Step 4: New KPI cards added")

# ─────────────────────────────────────────────
# 5. Add semaphore to Profit Factor card
# ─────────────────────────────────────────────
OLD_PF = '{formatNumber(metrics.profitFactor, 2)}'
pf_idx = content.find(OLD_PF)
assert pf_idx != -1, "profitFactor display not found"

NEW_PF = """{formatNumber(metrics.profitFactor, 2)}
                <span style={{
                  marginLeft: 6, fontSize: '11px', fontWeight: 700,
                  color: metrics.profitFactor >= 1.5 ? 'var(--accent)' : metrics.profitFactor >= 1.0 ? '#f59e0b' : '#ef4444'
                }}>
                  {metrics.profitFactor >= 1.5 ? 'otimo' : metrics.profitFactor >= 1.0 ? 'ok' : 'ruim'}
                </span>"""

content = content[:pf_idx] + NEW_PF + content[pf_idx + len(OLD_PF):]
print("Step 5: Profit Factor semaphore added")

# ─────────────────────────────────────────────
# 6. Add semaphore to Payoff card
# ─────────────────────────────────────────────
OLD_PAYOFF = '{formatNumber(metrics.payoff, 2)}'
po_idx = content.find(OLD_PAYOFF)
assert po_idx != -1, "payoff display not found"

NEW_PAYOFF = """{formatNumber(metrics.payoff, 2)}
                <span style={{
                  marginLeft: 6, fontSize: '11px', fontWeight: 700,
                  color: metrics.payoff >= 1.5 ? 'var(--accent)' : metrics.payoff >= 1.0 ? '#f59e0b' : '#ef4444'
                }}>
                  {metrics.payoff >= 1.5 ? 'otimo' : metrics.payoff >= 1.0 ? 'ok' : 'ruim'}
                </span>"""

content = content[:po_idx] + NEW_PAYOFF + content[po_idx + len(OLD_PAYOFF):]
print("Step 6: Payoff semaphore added")

# ─────────────────────────────────────────────
# 7. Add Insights panel before panel-grid
# ─────────────────────────────────────────────
PANEL_GRID_OPEN = '          <div className="panel-grid">'
panel_grid_open_idx = content.find(PANEL_GRID_OPEN)
assert panel_grid_open_idx != -1, "panel-grid open not found"

insights_panel = """
          <div className="panel insights-panel">
            <div className="panel-header">
              <h4>Insights da estrategia</h4>
              <span>Pontos fortes e fracos identificados automaticamente nos seus dados.</span>
            </div>
            <div className="insights-grid">
              <div className="insight-card">
                <div className="insight-label">Melhor dia</div>
                <div className="insight-value text-success">
                  {metrics.bestDay ? metrics.bestDay.label : '\u2014'}
                </div>
                <div className="insight-sub">
                  {metrics.bestDay ? formatCurrency(metrics.bestDay.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Pior dia</div>
                <div className="insight-value text-danger">
                  {metrics.worstDay ? metrics.worstDay.label : '\u2014'}
                </div>
                <div className="insight-sub">
                  {metrics.worstDay ? formatCurrency(metrics.worstDay.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Melhor horario</div>
                <div className="insight-value text-success">
                  {metrics.bestHour != null ? `${metrics.bestHour.hour}h` : '\u2014'}
                </div>
                <div className="insight-sub">
                  {metrics.bestHour != null ? formatCurrency(metrics.bestHour.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Pior horario</div>
                <div className="insight-value text-danger">
                  {metrics.worstHour != null ? `${metrics.worstHour.hour}h` : '\u2014'}
                </div>
                <div className="insight-sub">
                  {metrics.worstHour != null ? formatCurrency(metrics.worstHour.net, currency) : 'Sem dados'}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Taxa de acerto</div>
                <div className="insight-value" style={{
                  color: metrics.winRate >= metrics.breakevenWinRate ? 'var(--accent)' : '#ef4444'
                }}>
                  {formatPercent(metrics.winRate)}
                </div>
                <div className="insight-sub">
                  {metrics.winRate >= metrics.breakevenWinRate
                    ? `Acima do minimo (${formatPercent(metrics.breakevenWinRate)})`
                    : `Abaixo do minimo (${formatPercent(metrics.breakevenWinRate)})`}
                </div>
              </div>
              <div className="insight-card">
                <div className="insight-label">Consistencia</div>
                <div className="insight-value" style={{
                  color: metrics.profitableDaysPct >= 0.6 ? 'var(--accent)' : metrics.profitableDaysPct >= 0.4 ? '#f59e0b' : '#ef4444'
                }}>
                  {formatPercent(metrics.profitableDaysPct)}
                </div>
                <div className="insight-sub">dias positivos</div>
              </div>
            </div>
          </div>

"""

content = content[:panel_grid_open_idx] + insights_panel + content[panel_grid_open_idx:]
print("Step 7: Insights panel added")

# ─────────────────────────────────────────────
# Write file
# ─────────────────────────────────────────────
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! New size: {len(content)} chars (was {orig_len})")
