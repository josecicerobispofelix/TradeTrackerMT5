import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/api_client.dart';

class DarfScreen extends StatefulWidget {
  const DarfScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DarfScreen> createState() => _DarfScreenState();
}

class _DarfScreenState extends State<DarfScreen> {
  int _month = DateTime.now().month;
  int _year = DateTime.now().year;
  final TextEditingController _fxCtrl = TextEditingController();
  final TextEditingController _taxCtrl = TextEditingController(text: '15');

  Map<String, dynamic>? _result;
  List<dynamic> _history = <dynamic>[];
  String? _status;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _fxCtrl.dispose();
    _taxCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final response = await widget.api.get('/api/darf/history');
      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;
        setState(() => _history = List<dynamic>.from(data['items'] ?? <dynamic>[]));
      }
    } catch (_) {
      // Silencia falhas de histórico, será apenas "sem dados".
    }
  }

  Future<void> _calculate() async {
    final double? fx =
        double.tryParse(_fxCtrl.text.replaceAll(',', '.').trim());
    final double? taxPct =
        double.tryParse(_taxCtrl.text.replaceAll(',', '.').trim());

    setState(() {
      _loading = true;
      _status = null;
    });

    try {
      final body = <String, dynamic>{
        'month': _month,
        'year': _year,
      };
      if (fx != null && fx > 0) body['fx_rate'] = fx;
      if (taxPct != null && taxPct > 0) body['tax_rate'] = taxPct / 100;

      final response = await widget.api.post(
        '/api/darf/calculate',
        body: body,
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _result = data;
          _status = (data['message'] as String?)?.trim();
        });
        await _loadHistory();
      } else {
        final dynamic bodyErr =
            response.body.isNotEmpty ? jsonDecode(response.body) : null;
        setState(() => _status = ApiClient.errorMessage(bodyErr));
      }
    } catch (e) {
      setState(() => _status = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String _fmtCurrency(num? v, [String currency = 'BRL']) {
    if (v == null) return '–';
    return NumberFormat.currency(
      locale: 'pt_BR',
      symbol: currency == 'BRL' ? 'R\$' : 'US\$',
    ).format(v);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Map<String, dynamic>? r = _result;

    final bool hasTax = (r?['tax_due'] as num? ?? 0) > 0;
    final String currentMonthLabel = r == null
        ? ''
        : '${(r['month'] as int).toString().padLeft(2, '0')}/${r['year']}';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'DARF / Imposto',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            'Calcule o imposto do mês e visualize o histórico de DARF.',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          if (r != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: hasTax
                    ? Colors.red.withOpacity(0.12)
                    : Colors.green.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                hasTax
                    ? 'Imposto a pagar em $currentMonthLabel: '
                        '${_fmtCurrency(r['tax_due'] as num? ?? 0)}'
                    : 'Sem imposto a pagar em $currentMonthLabel.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    'Parâmetros do cálculo',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          value: _month,
                          decoration: const InputDecoration(labelText: 'Mês'),
                          items: List<DropdownMenuItem<int>>.generate(
                            12,
                            (int i) => DropdownMenuItem<int>(
                              value: i + 1,
                              child: Text((i + 1).toString().padLeft(2, '0')),
                            ),
                          ),
                          onChanged: (int? v) {
                            if (v != null) setState(() => _month = v);
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: _year.toString(),
                          decoration:
                              const InputDecoration(labelText: 'Ano'),
                          keyboardType: TextInputType.number,
                          onChanged: (String v) {
                            final int? parsed = int.tryParse(v);
                            if (parsed != null) _year = parsed;
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          controller: _fxCtrl,
                          decoration: const InputDecoration(
                            labelText: 'USD/BRL (opcional)',
                          ),
                          keyboardType:
                              const TextInputType.numberWithOptions(decimal: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _taxCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Alíquota % (opcional)',
                          ),
                          keyboardType:
                              const TextInputType.numberWithOptions(decimal: true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(
                      onPressed: _loading ? null : _calculate,
                      child: _loading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Calcular'),
                    ),
                  ),
                  if (_status != null && _status!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(
                      _status!,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (r != null) _buildResultCard(theme, r),
          const SizedBox(height: 16),
          _buildHistoryTable(theme),
        ],
      ),
    );
  }

  Widget _buildResultCard(ThemeData theme, Map<String, dynamic> r) {
    final String monthLabel =
        '${(r['month'] as int).toString().padLeft(2, '0')}/${r['year']}';
    final num profitBrl = (r['profit_brl'] ?? 0) as num;
    final num profitUsd = (r['profit_usd'] ?? 0) as num;
    final num taxRate = (r['tax_rate'] ?? 0) as num;
    final num taxDue = (r['tax_due'] ?? 0) as num;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Resumo $monthLabel',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Resultado: ${profitBrl >= 0 ? "lucro" : "prejuízo"} '
              '${_fmtCurrency(profitBrl)} (${_fmtCurrency(profitUsd, "USD")}).',
            ),
            const SizedBox(height: 4),
            Text('Alíquota ${(taxRate * 100).toStringAsFixed(2)}%.'),
            const SizedBox(height: 4),
            Text(
              'Imposto devido: ${_fmtCurrency(taxDue)}.',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryTable(ThemeData theme) {
    if (_history.isEmpty) {
      return Text(
        'Nenhum cálculo salvo ainda.',
        style: theme.textTheme.bodySmall,
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columnSpacing: 18,
        columns: const <DataColumn>[
          DataColumn(label: Text('Mês')),
          DataColumn(label: Text('Lucro BRL')),
          DataColumn(label: Text('Imposto')),
          DataColumn(label: Text('Câmbio')),
          DataColumn(label: Text('Alíquota')),
          DataColumn(label: Text('Trades')),
        ],
        rows: _history.map((dynamic row) {
          final Map<String, dynamic> d =
              row as Map<String, dynamic>;
          final String month =
              '${(d['month'] as int).toString().padLeft(2, '0')}/${d['year']}';
          return DataRow(
            cells: <DataCell>[
              DataCell(Text(month)),
              DataCell(Text(_fmtCurrency(d['profit_brl'] as num? ?? 0))),
              DataCell(Text(_fmtCurrency(d['tax_due'] as num? ?? 0))),
              DataCell(
                Text((d['fx_rate'] as num? ?? 0).toStringAsFixed(4)),
              ),
              DataCell(
                Text('${((d['tax_rate'] as num? ?? 0) * 100).toStringAsFixed(2)}%'),
              ),
              DataCell(
                Text((d['trades_count'] ?? 0).toString()),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

