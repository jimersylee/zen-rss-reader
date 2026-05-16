import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import Icon from "./Icon";

interface Props {
  onClose: () => void;
  onToast: (msg: string) => void;
}

/** Subscribe to a new feed — design-styled centered modal. */
export default function AddFeedDialog({ onClose, onToast }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<number | null>(null);
  const folders = useQuery({ queryKey: ["folders"], queryFn: api.listFolders });

  const add = useMutation({
    mutationFn: () => api.addFeed(url.trim(), folderId),
    onSuccess: (feed) => {
      qc.invalidateQueries();
      onToast(t("addFeed.subscribed", { title: feed.title }));
      onClose();
    },
  });

  const submit = () => {
    if (url.trim() && !add.isPending) add.mutate();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("addFeed.title")}</h2>
        <p className="modal-hint">{t("addFeed.hint")}</p>
        <input
          className="modal-input"
          type="text"
          autoFocus
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        {(folders.data?.length ?? 0) > 0 && (
          <select
            className="s-select"
            style={{ width: "100%" }}
            value={folderId ?? ""}
            onChange={(e) =>
              setFolderId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">{t("addFeed.noFolder")}</option>
            {folders.data!.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {add.isError && <div className="modal-error">{String(add.error)}</div>}
        <div className="modal-actions">
          <button className="s-btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="s-btn primary"
            onClick={submit}
            disabled={!url.trim() || add.isPending}
          >
            <Icon name="plus" size={12} />
            {add.isPending ? t("addFeed.adding") : t("addFeed.subscribe")}
          </button>
        </div>
      </div>
    </div>
  );
}
