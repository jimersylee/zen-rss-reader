// One coordinator shared by the list, reader and keyboard actions. Keep local
// intent over query results until its write settles, and serialize writes to
// the same article/field so rapid read → unread cannot reach SQLite backwards.
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ArticleDetail, ArticleSummary } from "../types";

export type ArticleFlag = "isRead" | "isStarred" | "readLater";
export type ArticlePatch = Partial<Pick<ArticleSummary, ArticleFlag>>;

const LIST_KEYS = ["articles", "search", "cp-search"];
const STATE_KEYS = [...LIST_KEYS, "article"];

type Change = {
  value: boolean;
  confirmed: boolean | undefined;
  version: number;
  task: Promise<void>;
};

export function createArticleState() {
  const pending = new Map<number, Map<ArticleFlag, Change>>();

  function overlay<T extends { id: number }>(article: T): T {
    const fields = pending.get(article.id);
    if (!fields) return article;
    const patch: ArticlePatch = {};
    for (const [field, change] of fields) patch[field] = change.value;
    return { ...article, ...patch };
  }

  function patch(qc: QueryClient, id: number, value: ArticlePatch) {
    qc.setQueriesData<InfiniteData<ArticleSummary[]>>({ queryKey: ["articles"] }, (old) =>
      old?.pages
        ? {
            ...old,
            pages: old.pages.map((page) => page.map((a) => (a.id === id ? { ...a, ...value } : a))),
          }
        : old,
    );
    for (const key of ["search", "cp-search"]) {
      qc.setQueriesData<ArticleSummary[]>({ queryKey: [key] }, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...value } : a)),
      );
    }
    qc.setQueryData<ArticleDetail>(["article", id], (old) => (old ? { ...old, ...value } : old));
  }

  function cachedFlag(qc: QueryClient, id: number, field: ArticleFlag): boolean | undefined {
    const detail = qc.getQueryData<ArticleDetail>(["article", id]);
    if (detail) return detail[field];
    for (const [, data] of qc.getQueriesData<InfiniteData<ArticleSummary[]>>({
      queryKey: ["articles"],
    })) {
      const article = data?.pages?.flat().find((a) => a.id === id);
      if (article) return article[field];
    }
    for (const key of ["search", "cp-search"]) {
      for (const [, data] of qc.getQueriesData<ArticleSummary[]>({ queryKey: [key] })) {
        const article = data?.find((a) => a.id === id);
        if (article) return article[field];
      }
    }
  }

  function cancelReads(qc: QueryClient, id: number) {
    return Promise.all(
      STATE_KEYS.map((key) =>
        qc.cancelQueries(
          { queryKey: key === "article" ? [key, id] : [key] },
          // Cancellation must not restore a snapshot from before a newer click.
          { revert: false },
        ),
      ),
    );
  }

  function refreshLists(qc: QueryClient) {
    void qc.invalidateQueries({ queryKey: ["counts"] });
    void qc.invalidateQueries({ queryKey: ["feeds"] });
    // A flag change can cancel the first detail/search request before it has
    // cached data. Resume those active queries instead of leaving a spinner.
    void qc.refetchQueries({
      type: "active",
      predicate: (query) =>
        STATE_KEYS.includes(String(query.queryKey[0])) && query.state.data === undefined,
    });
    for (const key of LIST_KEYS) {
      // Preserve the current unread list while reading. Re-evaluate membership
      // when switching views, rather than removing the selected row mid-read.
      void qc.invalidateQueries({ queryKey: [key], refetchType: "none" });
    }
  }

  function set(
    qc: QueryClient,
    id: number,
    field: ArticleFlag,
    value: boolean,
    write: () => Promise<unknown>,
    onError?: (error: unknown) => void,
  ): Promise<void> {
    let fields = pending.get(id);
    let change = fields?.get(field);
    if (change?.value === value) return change.task;
    if (!fields) {
      fields = new Map();
      pending.set(id, fields);
    }
    if (!change) {
      change = { value, confirmed: cachedFlag(qc, id, field), version: 0, task: Promise.resolve() };
      fields.set(field, change);
    }
    const entry = change;
    const version = ++entry.version;
    entry.value = value;
    const previous = entry.task;
    const cancelled = cancelReads(qc, id);
    patch(qc, id, { [field]: value });

    entry.task = previous.then(async () => {
      await cancelled;
      let failure: unknown;
      let failed = false;
      try {
        await write();
        entry.confirmed = value;
      } catch (error) {
        failure = error;
        failed = true;
      }
      if (entry.version === version) {
        // Queries may have started since this click (selection, translation,
        // background refresh). Invalidate their old snapshots before dropping
        // the pending overlay, including IPC requests that cannot be aborted.
        await cancelReads(qc, id);
        if (entry.version === version) {
          fields!.delete(field);
          if (!fields!.size) pending.delete(id);
          const settled = failed ? entry.confirmed : value;
          if (settled !== undefined) patch(qc, id, { [field]: settled });
          if (failed) {
            // Recover from authoritative storage, never invent !requestedValue.
            for (const key of STATE_KEYS) {
              void qc.invalidateQueries({ queryKey: key === "article" ? [key, id] : [key] });
            }
          }
          refreshLists(qc);
        }
      }
      if (failed) onError?.(failure);
    });
    return entry.task;
  }

  return { overlay, patch, set };
}

export const articleState = createArticleState();
