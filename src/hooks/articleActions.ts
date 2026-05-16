// Shared article mutations. Both the reading pane and keyboard shortcuts go
// through this so optimistic cache patching stays consistent everywhere.

import { useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import type { ArticleSummary } from "../types";

type Patch = Partial<
  Pick<ArticleSummary, "isRead" | "isStarred" | "readLater">
>;

export function useArticleActions() {
  const qc = useQueryClient();

  /** Optimistically patch an article across every cache that may hold it. */
  const patch = (id: number, p: Patch) => {
    // Paginated browse lists.
    qc.setQueriesData({ queryKey: ["articles"] }, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: ArticleSummary[]) =>
          page.map((x) => (x.id === id ? { ...x, ...p } : x)),
        ),
      };
    });
    // Flat hybrid-search results.
    qc.setQueriesData({ queryKey: ["search"] }, (old: any) =>
      Array.isArray(old)
        ? old.map((x: ArticleSummary) => (x.id === id ? { ...x, ...p } : x))
        : old,
    );
    // The open article detail.
    qc.setQueryData(["article", id], (old: any) =>
      old ? { ...old, ...p } : old,
    );
  };

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ["counts"] });
    qc.invalidateQueries({ queryKey: ["feeds"] });
    // Smart views (Starred / Read Later / Unread) are each their own
    // ["articles", …] query. The optimistic `patch` above fixes articles
    // already in a list, but it can't add or remove rows — so a freshly
    // starred article never appears in the Starred list. Mark every
    // article/search list stale so it re-fetches with the correct
    // membership when next opened. `refetchType: "none"` avoids yanking
    // rows out of the list the user is currently looking at.
    qc.invalidateQueries({ queryKey: ["articles"], refetchType: "none" });
    qc.invalidateQueries({ queryKey: ["search"], refetchType: "none" });
  };

  return {
    patch,
    async setRead(id: number, read: boolean) {
      await api.markRead(id, read);
      patch(id, { isRead: read });
      refreshLists();
    },
    async setStarred(id: number, starred: boolean) {
      await api.markStarred(id, starred);
      patch(id, { isStarred: starred });
      refreshLists();
    },
    async setReadLater(id: number, value: boolean) {
      await api.markReadLater(id, value);
      patch(id, { readLater: value });
      refreshLists();
    },
  };
}
