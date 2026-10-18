// Shared article mutations. Both the reading pane and keyboard shortcuts go
// through this so optimistic cache patching stays consistent everywhere.

import { useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import { errorText } from "../lib/errors";
import { articleState, type ArticlePatch } from "../lib/articleState";

/**
 * Shared article mutations. `onError` (when supplied) is called with a
 * localized message if a mutation fails — callers fire these actions without
 * awaiting, so without it a failure would be a silent unhandled rejection.
 */
export function useArticleActions(onError?: (msg: string) => void) {
  const qc = useQueryClient();

  const patch = (id: number, value: ArticlePatch) => articleState.patch(qc, id, value);
  const report = (error: unknown) => onError?.(errorText(error));

  // The query keys an article-state change can affect. A bare
  // `invalidateQueries()` would also refetch unrelated caches (AI summaries,
  // settings, FreshRSS status, rules, the feed-discovery search), so callers
  // invalidate only these — plus any `extra` keys.
  const refreshArticleKeys = (extra: string[][] = []) => {
    const keys = [
      ["counts"],
      ["feeds"],
      ["folders"],
      ["tags"],
      ["articles"],
      ["article"],
      ["search"],
      ["cp-search"],
      ...extra,
    ];
    for (const key of keys) {
      qc.invalidateQueries({ queryKey: key });
    }
  };

  // After a bulk operation (mark-all-read) potentially every article's state
  // changed, so optimistic patching can't cover it.
  const refreshAfterBulk = () => refreshArticleKeys();

  // After a manual feed refresh new articles may have arrived; `storage-stats`
  // is added because the new articles grow the database.
  const refreshAfterFetch = () => refreshArticleKeys([["storage-stats"]]);

  return {
    patch,
    refreshAfterBulk,
    refreshAfterFetch,
    setRead: (id: number, read: boolean) =>
      articleState.set(qc, id, "isRead", read, () => api.markRead(id, read), report),
    setStarred: (id: number, starred: boolean) =>
      articleState.set(qc, id, "isStarred", starred, () => api.markStarred(id, starred), report),
    setReadLater: (id: number, value: boolean) =>
      articleState.set(qc, id, "readLater", value, () => api.markReadLater(id, value), report),
  };
}
