import { useRef, useState } from "react";
import { useLang } from "../LangContext";

type DropzoneProps = {
  onFile: (file: File) => void;
  isLoading?: boolean;
};

export default function Dropzone({ onFile, isLoading }: DropzoneProps) {
  const { t } = useLang();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFile(files[0]);
  };

  return (
    <div
      className={`dropzone${dragging ? " dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />
      <strong>{t("drop_drag")}</strong>
      <span className="helper">{t("drop_or")}</span>
      <button
        type="button"
        className="secondary"
        disabled={isLoading}
        onClick={() => inputRef.current?.click()}
      >
        {t("drop_select")}
      </button>
    </div>
  );
}
