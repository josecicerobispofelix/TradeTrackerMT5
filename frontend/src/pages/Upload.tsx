import { useState } from "react";
import { uploadReport, UploadResponse } from "../api";
import Dropzone from "../components/Dropzone";

export default function Upload() {
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await uploadReport(file);
      setResult(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="hero">
        <h2>Upload diário</h2>
        <p>
          Envie o relatório do MetaTrader 5 (.xlsx). O sistema ignora duplicados
          automaticamente.
        </p>
      </div>

      <Dropzone onFile={handleFile} isLoading={loading} />

      {loading ? <div className="panel">Processando arquivo...</div> : null}
      {error ? <div className="panel">Erro: {error}</div> : null}

      {result ? (
        <div className="panel">
          <div className="panel-header">
            <h4>Resumo da importação</h4>
            <span>{result.message}</span>
          </div>
          <p>
            Conta: <strong>{result.account ?? "-"}</strong>
          </p>
          <p>Total de linhas: {result.total_rows}</p>
          <p>Inseridas: {result.inserted_rows}</p>
          <p>Ignoradas: {result.skipped_rows}</p>
          {result.file_already_imported ? (
            <p className="muted">Arquivo já havia sido importado.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
