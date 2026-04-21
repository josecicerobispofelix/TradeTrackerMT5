import { useState } from "react";
import { deleteAllUploads, uploadReport, UploadResponse } from "../api";
import Dropzone from "../components/Dropzone";
import { useLang } from "../LangContext";

export default function Upload() {
  const { t } = useLang();
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
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

  const handleClearAll = async () => {
    const confirmClear = window.confirm(t("upload_confirm_del"));
    if (!confirmClear) return;

    setClearing(true);
    setError(null);
    setClearMessage(null);
    try {
      const response = await deleteAllUploads();
      setClearMessage(response.message);
      setResult(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="section">
      <div className="hero">
        <h2>{t("upload_title")}</h2>
        <p>{t("upload_subtitle")}</p>
      </div>

      <div className="upload-actions">
        <Dropzone onFile={handleFile} isLoading={loading} />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="danger"
            onClick={handleClearAll}
            disabled={clearing || loading}
          >
            {clearing ? t("upload_deleting") : t("upload_delete_all")}
          </button>
        </div>
      </div>

      {loading ? <div className="panel">{t("upload_processing")}</div> : null}
      {error ? <div className="panel">{t("common_error")} {error}</div> : null}
      {clearMessage ? <div className="panel">{clearMessage}</div> : null}

      {result ? (
        <div className="panel">
          <div className="panel-header">
            <h4>{t("upload_summary")}</h4>
            <span>{result.message}</span>
          </div>
          <p>
            {t("upload_account")} <strong>{result.account ?? "-"}</strong>
          </p>
          <p>{t("upload_total")} {result.total_rows}</p>
          <p>{t("upload_inserted")} {result.inserted_rows}</p>
          <p>{t("upload_skipped")} {result.skipped_rows}</p>
          {result.file_already_imported ? (
            <p className="muted">{t("upload_already")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
