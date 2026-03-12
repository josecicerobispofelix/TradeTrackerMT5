import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/api_client.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  Map<String, dynamic>? _result;
  String? _error;
  bool _loading = false;

  Future<void> _pickAndUpload() async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      // Aceita os mesmos formatos especificados para o mobile.
      allowedExtensions: <String>['xlsx', 'csv', 'pdf'],
      withData: true,
    );
    if (result == null || result.files.isEmpty || result.files.single.bytes == null) return;
    final PlatformFile file = result.files.single;
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    try {
      final response =
          await widget.api.postMultipart('/api/upload', 'file', file.bytes!, file.name);
      if (response.statusCode == 200) {
        setState(() => _result = jsonDecode(response.body) as Map<String, dynamic>);
      } else {
        final dynamic body = response.body.isNotEmpty ? jsonDecode(response.body) : null;
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

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Upload diário',
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.left,
              ),
              const SizedBox(height: 8),
              Text(
                'Envie o relatório do MetaTrader 5 (.xlsx, .csv, .pdf). '
                'O sistema ignora duplicados automaticamente.',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Icon(
                        Icons.cloud_upload_outlined,
                        size: 40,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Arraste o arquivo aqui\nou toque em "Selecionar arquivo"',
                        textAlign: TextAlign.left,
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Formatos aceitos: .xlsx, .csv, .pdf',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: _loading ? null : _pickAndUpload,
                        icon: _loading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.upload_file),
                        label: Text(_loading ? 'Processando...' : 'Selecionar arquivo'),
                      ),
                    ],
                  ),
                ),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 16),
                Card(
                  color: theme.colorScheme.errorContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      _error!,
                      style: TextStyle(color: theme.colorScheme.onErrorContainer),
                    ),
                  ),
                ),
              ],
              if (_result != null) ...<Widget>[
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          _result!['message'] as String? ?? 'Importação concluída',
                          style: theme.textTheme.titleLarge,
                        ),
                        const SizedBox(height: 12),
                        Text('Conta: ${_result!['account'] ?? '-'}'),
                        Text('Total de linhas: ${_result!['total_rows'] ?? 0}'),
                        Text('Inseridas: ${_result!['inserted_rows'] ?? 0}'),
                        Text('Ignoradas: ${_result!['skipped_rows'] ?? 0}'),
                        if (_result!['file_already_imported'] == true)
                          const Padding(
                            padding: EdgeInsets.only(top: 4),
                            child: Text(
                              'Arquivo já havia sido importado.',
                              style: TextStyle(fontStyle: FontStyle.italic),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
