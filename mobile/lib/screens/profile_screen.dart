import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/api_client.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _cpfCtrl = TextEditingController();
  final _brokerCtrl = TextEditingController();
  final _accountCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController(text: '15');
  String? _currency = 'USD';
  String? _status;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _cpfCtrl.dispose();
    _brokerCtrl.dispose();
    _accountCtrl.dispose();
    _taxRateCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await widget.api.get('/api/fiscal-profile');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final taxRate = (data['tax_rate'] as num?)?.toDouble() ?? 0.15;
        if (mounted) {
          setState(() {
            _nameCtrl.text = data['full_name']?.toString() ?? '';
            _cpfCtrl.text = data['cpf']?.toString() ?? '';
            _brokerCtrl.text = data['broker']?.toString() ?? '';
            _accountCtrl.text = data['trading_account']?.toString() ?? '';
            _currency = data['account_currency']?.toString() ?? 'USD';
            _taxRateCtrl.text = (taxRate * 100).toStringAsFixed(0);
          });
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final taxRate = (double.tryParse(_taxRateCtrl.text.replaceAll(',', '.')) ?? 15) / 100;
    setState(() {
      _loading = true;
      _status = null;
    });
    try {
      final res = await widget.api.post('/api/fiscal-profile', body: {
        'full_name': _nameCtrl.text.trim(),
        'cpf': _cpfCtrl.text.trim(),
        'broker': _brokerCtrl.text.trim(),
        'trading_account': _accountCtrl.text.trim(),
        'account_currency': _currency,
        'tax_rate': taxRate,
      });
      if (res.statusCode == 200) {
        setState(() => _status = 'Perfil fiscal salvo.');
      } else {
        final body = res.body.isNotEmpty ? jsonDecode(res.body) : null;
        setState(() => _status = ApiClient.errorMessage(body));
      }
    } catch (e) {
      setState(() => _status = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Perfil fiscal', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Usado no cálculo e PDF da DARF.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 24),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Nome completo', border: OutlineInputBorder()),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Obrigatório' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _cpfCtrl,
              decoration: const InputDecoration(labelText: 'CPF', border: OutlineInputBorder()),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Obrigatório' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _brokerCtrl,
              decoration: const InputDecoration(labelText: 'Corretora', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _accountCtrl,
              decoration: const InputDecoration(labelText: 'Conta', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _currency,
              decoration: const InputDecoration(labelText: 'Moeda da conta', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'USD', child: Text('USD')),
                DropdownMenuItem(value: 'BRL', child: Text('BRL')),
              ],
              onChanged: (v) => setState(() => _currency = v),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _taxRateCtrl,
              decoration: const InputDecoration(labelText: 'Alíquota padrão %', border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 24),
            if (_status != null) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(_status!, style: TextStyle(color: Theme.of(context).colorScheme.primary))),
            FilledButton(
              onPressed: _loading ? null : _save,
              child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Salvar perfil fiscal'),
            ),
          ],
        ),
      ),
    );
  }
}
