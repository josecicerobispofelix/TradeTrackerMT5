import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/api_client.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final TextEditingController _fromCtrl = TextEditingController();
  final TextEditingController _toCtrl = TextEditingController();

  List<dynamic> _trades = <dynamic>[];
  List<String> _symbols = <String>[];
  List<String> _accounts = <String>[];
  String? _symbol;
  String? _account;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final DateTime now = DateTime.now();
    _toCtrl.text = DateFormat('yyyy-MM-dd').format(now);
    _fromCtrl.text =
        DateFormat('yyyy-MM-dd').format(DateTime(now.year, now.month, 1));
    _loadMeta();
    _loadTrades();
  }

  @override
  void dispose() {
    _fromCtrl.dispose();
    _toCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMeta() async {
    try {
      final response = await widget.api.get(
        '/api/trades/meta',
        queryParams: <String, String>{
          'from': _fromCtrl.text,
          'to': _toCtrl.text,
        },
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _symbols = List<String>.from(data['symbols'] ?? <String>[]);
          _accounts = List<String>.from(data['accounts'] ?? <String>[]);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadTrades() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final Map<String, String> params = <String, String>{
        'from': _fromCtrl.text,
        'to': _toCtrl.text,
      };
      if (_symbol != null && _symbol!.isNotEmpty) {
        params['symbol'] = _symbol!;
      }
      if (_account != null && _account!.isNotEmpty) {
        params['account'] = _account!;
      }
      final response =
          await widget.api.get('/api/trades', queryParams: params);
      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;
        setState(() => _trades = List<dynamic>.from(data['trades'] ?? <dynamic>[]));
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

  String _fmt(num? n, [String currency = 'USD']) {
    if (n == null) return '–';
    return NumberFormat.currency(
      locale: 'pt_BR',
      symbol: currency == 'BRL' ? 'R\$' : 'US\$',
    ).format(n);
  }

  String _fmtDateTime(String value) {
    try {
      final DateTime dt = DateTime.parse(value);
      return DateFormat('dd/MM/yyyy HH:mm').format(dt);
    } catch (_) {
      return value;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Histórico de operações',
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                'Filtre por período, ativo ou conta para analisar as operações.',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _fromCtrl,
                      decoration: const InputDecoration(labelText: 'De'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _toCtrl,
                      decoration: const InputDecoration(labelText: 'Até'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: <Widget>[
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _symbol,
                      decoration: const InputDecoration(
                        labelText: 'Ativo',
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      items: <DropdownMenuItem<String>>[
                        const DropdownMenuItem<String>(
                          value: null,
                          child: Text('Todos'),
                        ),
                        ..._symbols.map(
                          (String s) => DropdownMenuItem<String>(
                            value: s,
                            child: Text(s),
                          ),
                        ),
                      ],
                      onChanged: (String? v) {
                        setState(() => _symbol = v);
                        _loadTrades();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _account,
                      decoration: const InputDecoration(
                        labelText: 'Conta',
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      items: <DropdownMenuItem<String>>[
                        const DropdownMenuItem<String>(
                          value: null,
                          child: Text('Todas'),
                        ),
                        ..._accounts.map(
                          (String a) => DropdownMenuItem<String>(
                            value: a,
                            child: Text(a),
                          ),
                        ),
                      ],
                      onChanged: (String? v) {
                        setState(() => _account = v);
                        _loadTrades();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  onPressed: _loading ? null : _loadTrades,
                  icon: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search),
                  label: const Text('Aplicar'),
                ),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              _error!,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        Expanded(
          child: _trades.isEmpty
              ? const Center(child: Text('Nenhum trade encontrado.'))
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SingleChildScrollView(
                    child: DataTable(
                      columnSpacing: 18,
                      headingRowHeight: 40,
                      dataRowMinHeight: 40,
                      dataRowMaxHeight: 56,
                      columns: const <DataColumn>[
                        DataColumn(label: Text('Ticket')),
                        DataColumn(label: Text('Símbolo')),
                        DataColumn(label: Text('Tipo')),
                        DataColumn(label: Text('Volume')),
                        DataColumn(label: Text('Lucro')),
                        DataColumn(label: Text('Abertura')),
                        DataColumn(label: Text('Fechamento')),
                      ],
                      rows: _trades.map((dynamic row) {
                        final Map<String, dynamic> t =
                            row as Map<String, dynamic>;
                        final String ticket =
                            (t['deal_id'] ?? t['id'] ?? '').toString();
                        final String symbol = t['symbol']?.toString() ?? '';
                        final String side = t['side']?.toString() ?? '';
                        final double volume =
                            (t['volume'] as num?)?.toDouble() ?? 0;
                        final double net =
                            (t['net_profit'] as num?)?.toDouble() ?? 0;
                        final String openTime =
                            t['open_time']?.toString() ?? '';
                        final String closeTime =
                            t['close_time']?.toString() ?? '';

                        return DataRow(
                          cells: <DataCell>[
                            DataCell(Text(ticket)),
                            DataCell(Text(symbol)),
                            DataCell(
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: net >= 0
                                      ? Colors.green.withOpacity(0.15)
                                      : Colors.red.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  side.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: net >= 0
                                        ? Colors.greenAccent
                                        : Colors.redAccent,
                                  ),
                                ),
                              ),
                            ),
                            DataCell(
                              Text(
                                volume.toStringAsFixed(2),
                                textAlign: TextAlign.right,
                              ),
                            ),
                            DataCell(
                              Text(
                                _fmt(net, t['currency'] == 'BRL' ? 'BRL' : 'USD'),
                                textAlign: TextAlign.right,
                              ),
                            ),
                            DataCell(Text(_fmtDateTime(openTime))),
                            DataCell(Text(_fmtDateTime(closeTime))),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}
