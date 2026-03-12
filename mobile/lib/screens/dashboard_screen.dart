import 'dart:convert';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/api_client.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _month = '';
  Map<String, dynamic>? _stats;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final DateTime now = DateTime.now();
    _month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response =
          await widget.api.get('/api/dashboard/stats', queryParams: <String, String>{'month': _month});
      if (response.statusCode == 200) {
        setState(() => _stats = jsonDecode(response.body) as Map<String, dynamic>);
      } else {
        final dynamic body =
            response.body.isNotEmpty ? jsonDecode(response.body) : null;
        setState(() => _error = ApiClient.errorMessage(body));
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String _fmt(num? n, [String currency = 'BRL']) {
    if (n == null) return '–';
    return NumberFormat.currency(
      locale: 'pt_BR',
      symbol: currency == 'BRL' ? 'R\$' : 'US\$',
    ).format(n);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    if (_loading && _stats == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Hero equivalente ao desktop ("Sua performance")
            Text(
              'Sua performance',
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text(
              'Analise seus resultados do MetaTrader 5 com filtros completos,\n'
              'indicadores-chave e gráficos animados.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 20),

            // Filtro principal de mês
            Row(
              children: <Widget>[
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _month,
                    decoration: const InputDecoration(
                      labelText: 'Mês',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                    ),
                    items: _monthItems(),
                    onChanged: (String? v) {
                      if (v != null) {
                        setState(() => _month = v);
                        _load();
                      }
                    },
                  ),
                ),
                IconButton(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Atualizar',
                ),
              ],
            ),

            if (_error != null) ...<Widget>[
              const SizedBox(height: 16),
              Card(
                color: theme.colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    _error!,
                    style:
                        TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
              ),
            ],

            if (_stats != null) ...<Widget>[
              const SizedBox(height: 16),

              // Cards principais (equivalentes ao kpi-grid)
              _buildKpiRow(theme),
              const SizedBox(height: 16),

              // Linha de métricas menores
              _buildMiniStats(theme),
              const SizedBox(height: 24),

              // Gráfico de performance (equivalente a "Evolução patrimonial")
              Text(
                'Gráfico de performance',
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              SizedBox(height: 240, child: _buildChart(theme)),

              const SizedBox(height: 24),

              // Resumo mensal simples (aproxima "Meta mensal"/"Resumo mensal")
              _buildMonthlySummary(theme),
            ],
            const SizedBox(height: 24),
            Center(
              child: Text(
                'Desenvolvido por Cicero Bispo',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.outline,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<DropdownMenuItem<String>> _monthItems() {
    final DateTime now = DateTime.now();
    final List<DropdownMenuItem<String>> items =
        <DropdownMenuItem<String>>[];
    for (int i = 0; i < 12; i++) {
      final DateTime d = DateTime(now.year, now.month - i, 1);
      final String value = '${d.year}-${d.month.toString().padLeft(2, '0')}';
      items.add(
        DropdownMenuItem<String>(
          value: value,
          child: Text(DateFormat('MMMM/yyyy', 'pt_BR').format(d)),
        ),
      );
    }
    return items;
  }

  Widget _buildKpiRow(ThemeData theme) {
    final Map<String, dynamic> s = _stats!;
    final num? netBrl = s['net_profit_brl'] as num?;
    final num? netUsd = s['net_profit'] as num?;
    final num net = (netBrl ?? netUsd ?? 0) as num;
    final bool positive = net >= 0;

    final num winRate = (s['win_rate_pct'] ?? 0) as num;
    final int totalTrades = (s['total_trades'] ?? 0) as int;

    return Row(
      children: <Widget>[
        Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Resultado líquido',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _fmt(netBrl ?? netUsd, netBrl != null ? 'BRL' : 'USD'),
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: positive ? Colors.greenAccent : Colors.redAccent,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$totalTrades operações',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Win rate', style: theme.textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(
                    '${winRate.toStringAsFixed(2)}%',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Vitórias vs perdas no mês.',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMiniStats(ThemeData theme) {
    final Map<String, dynamic> s = _stats!;
    final int wins = (s['total_wins'] ?? 0) as int;
    final int losses = (s['total_losses'] ?? 0) as int;
    final num profitFactor = (s['profit_factor'] ?? 0) as num;

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: <Widget>[
        _miniCard(theme, 'Vitórias', '$wins'),
        _miniCard(theme, 'Derrotas', '$losses'),
        _miniCard(theme, 'Fator lucro', profitFactor.toStringAsFixed(2)),
      ],
    );
  }

  Widget _miniCard(ThemeData theme, String title, String value) {
    return SizedBox(
      width: 150,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: theme.textTheme.bodySmall),
              const SizedBox(height: 2),
              Text(
                value,
                style: theme.textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChart(ThemeData theme) {
    final List<dynamic> daily = _stats!['daily'] as List<dynamic>? ?? <dynamic>[];
    if (daily.isEmpty) {
      return const Center(
        child: Text('Sem dados diários para este mês.'),
      );
    }

    final List<FlSpot> spots = <FlSpot>[];
    double cumulative = 0;
    for (int i = 0; i < daily.length; i++) {
      final Map<String, dynamic> d = daily[i] as Map<String, dynamic>;
      final num net = (d['net_profit_brl'] ?? d['net_profit']) as num? ?? 0;
      cumulative += net.toDouble();
      spots.add(FlSpot(i.toDouble(), cumulative));
    }

    return LineChart(
      LineChartData(
        gridData: FlGridData(show: true, drawVerticalLine: false),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 44,
              getTitlesWidget: (double v, TitleMeta _) {
                return Text(
                  NumberFormat.compact().format(v),
                  style: const TextStyle(fontSize: 10),
                );
              },
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: (daily.length / 6).ceilToDouble(),
              getTitlesWidget: (double v, TitleMeta _) {
                final int i = v.toInt();
                if (i >= 0 && i < daily.length) {
                  final String date =
                      (daily[i] as Map<String, dynamic>)['date'] as String? ?? '';
                  if (date.length >= 10) {
                    return Text(
                      date.substring(8),
                      style: const TextStyle(fontSize: 10),
                    );
                  }
                }
                return const Text('');
              },
            ),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
        ),
        borderData: FlBorderData(show: true),
        lineBarsData: <LineChartBarData>[
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: theme.colorScheme.primary,
            barWidth: 2,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: theme.colorScheme.primary.withValues(alpha: 0.2),
            ),
          ),
        ],
      ),
      duration: const Duration(milliseconds: 350),
    );
  }

  Widget _buildMonthlySummary(ThemeData theme) {
    final Map<String, dynamic> s = _stats!;
    final num? grossProfit = s['gross_profit'] as num?;
    final num? grossLoss = s['gross_loss'] as num?;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Resumo mensal',
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Lucro bruto', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 2),
                      Text(
                        _fmt(grossProfit ?? 0, 'BRL'),
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: Colors.greenAccent,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Prejuízo bruto', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 2),
                      Text(
                        _fmt(grossLoss ?? 0, 'BRL'),
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: Colors.redAccent,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
