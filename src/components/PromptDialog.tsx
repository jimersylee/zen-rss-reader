import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

/** A single-field modal prompt — feed / folder rename, new folder. */
export default function PromptDialog({
  title,
  initialValue = "",
  placeholder,
  confirmLabel,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // Escape must close the dialog regardless of which control has focus —
  // an input-level handler dies as soon as the user tabs to a button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <input
          className="modal-input"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          style={{ marginTop: 8 }}
        />
        <div className="modal-actions">
          <button className="s-btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="s-btn primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
