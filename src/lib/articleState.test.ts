import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { articleState, createArticleState } from "./articleState";
import { invoke } from "@tauri-apps/api/core";
import * as api from "../api";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), Channel: class {} }));
import type { ArticleSummary } from "../types";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((qc) => qc.clear());
  clients.length = 0;
});
function setup(initial = false) {
  const state = createArticleState();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(qc);
  const article = { id: 1, isRead: initial, isStarred: false, readLater: false } as ArticleSummary;
  qc.setQueryData(["articles", "all"], { pages: [[article]], pageParams: [0] });
  qc.setQueryData(["search", "text"], [article]);
  qc.setQueryData(["cp-search", "text"], [article]);
  qc.setQueryData(["article", 1], article);
  const read = () => qc.getQueryData<ArticleSummary>(["article", 1])!.isRead;
  return { state, qc, article, read };
}

describe("article state coordination", () => {
  it("patches all article caches and keeps old results read while the write is pending", async () => {
    const { state, qc, article, read } = setup();
    const request = deferred();
    const task = state.set(qc, 1, "isRead", true, () => request.promise);
    expect(read()).toBe(true);
    expect(state.overlay(article).isRead).toBe(true);
    for (const key of [
      ["search", "text"],
      ["cp-search", "text"],
    ]) {
      expect(qc.getQueryData<ArticleSummary[]>(key)![0].isRead).toBe(true);
    }
    const pages = qc.getQueryData<{ pages: ArticleSummary[][] }>(["articles", "all"])!;
    expect(pages.pages[0][0].isRead).toBe(true);
    request.resolve();
    await task;
    expect(read()).toBe(true);
    // Don't force a permanent read state after the mutation is finished.
    expect(state.overlay(article).isRead).toBe(false);
  });

  it("cancels an old in-flight list response that would undo the optimistic update", async () => {
    const { state, qc, article } = setup();
    const stale = deferred<ArticleSummary[]>();
    const fetch = qc
      .fetchQuery({ queryKey: ["search", "text"], queryFn: () => stale.promise })
      .catch(() => undefined);
    await state.set(qc, 1, "isRead", true, async () => {});
    stale.resolve([article]);
    await fetch;
    expect(qc.getQueryData<ArticleSummary[]>(["search", "text"])![0].isRead).toBe(true);
  });

  it("protects queries started during a pending write and cancels them before removing the overlay", async () => {
    const { state, qc, article, read } = setup();
    const write = deferred();
    const task = state.set(qc, 1, "isRead", true, () => write.promise);
    await vi.waitFor(() => expect(read()).toBe(true));
    const stale = deferred<ArticleSummary>();
    const fetch = qc
      .fetchQuery({ queryKey: ["article", 1], queryFn: () => stale.promise.then(state.overlay) })
      .catch(() => undefined);
    write.resolve();
    await task;
    stale.resolve(article);
    await fetch;
    expect(read()).toBe(true);
  });

  it("coalesces duplicate mark-on-open calls from different callers", async () => {
    const { state, qc } = setup();
    const write = deferred();
    const send = vi.fn(() => write.promise);
    const first = state.set(qc, 1, "isRead", true, send);
    const second = state.set(qc, 1, "isRead", true, send);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    write.resolve();
    await Promise.all([first, second]);
  });

  it("serializes rapid read/unread writes; an older failure cannot roll back a newer click", async () => {
    const { state, qc, read } = setup();
    const first = deferred();
    const second = deferred();
    const errors = vi.fn();
    const sendFirst = vi.fn(() => first.promise);
    const sendSecond = vi.fn(() => second.promise);
    const a = state.set(qc, 1, "isRead", true, sendFirst, errors);
    await vi.waitFor(() => expect(sendFirst).toHaveBeenCalledTimes(1));
    const b = state.set(qc, 1, "isRead", false, sendSecond, errors);
    expect(read()).toBe(false);
    expect(sendSecond).not.toHaveBeenCalled();
    first.reject(new Error("first failed"));
    await a;
    await vi.waitFor(() => expect(sendSecond).toHaveBeenCalledTimes(1));
    expect(read()).toBe(false);
    second.resolve();
    await b;
    expect(read()).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it("rolls a failed newest edit back to the last successful value, not an inverse guess", async () => {
    const { state, qc, read } = setup();
    const first = deferred();
    const second = deferred();
    const a = state.set(qc, 1, "isRead", true, () => first.promise);
    const b = state.set(qc, 1, "isRead", false, () => second.promise);
    first.resolve();
    await a;
    second.reject(new Error("failed"));
    await b;
    expect(read()).toBe(true);
  });

  it("an idempotent failed mark-read must not invent unread", async () => {
    const { state, qc, read } = setup(true);
    const errors = vi.fn();
    await state.set(
      qc,
      1,
      "isRead",
      true,
      async () => {
        throw new Error("failed");
      },
      errors,
    );
    expect(read()).toBe(true);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it("resumes a cancelled first detail load instead of leaving the reader loading", async () => {
    const { state, qc, article } = setup();
    qc.removeQueries({ queryKey: ["article", 1] });
    const stale = deferred<ArticleSummary>();
    let calls = 0;
    const observer = new QueryObserver(qc, {
      queryKey: ["article", 1],
      queryFn: () =>
        ++calls === 1 ? stale.promise : Promise.resolve({ ...article, isStarred: true }),
    });
    const stop = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(calls).toBe(1));
      await state.set(qc, 1, "isStarred", true, async () => {});
      await vi.waitFor(() => expect(observer.getCurrentResult().data?.isStarred).toBe(true));
      expect(calls).toBe(2);
      stale.resolve(article);
    } finally {
      stop();
    }
  });

  it("API list/detail responses use the same pending overlay as mutations", async () => {
    const { qc, article } = setup();
    const write = deferred();
    const task = articleState.set(qc, 1, "isRead", true, () => write.promise);
    try {
      vi.mocked(invoke).mockResolvedValueOnce([article]);
      const list = await api.listArticles({ kind: "all" }, false, null, false, 10, 0);
      expect(list[0].isRead).toBe(true);
      vi.mocked(invoke).mockResolvedValueOnce(article);
      expect((await api.getArticle(1)).isRead).toBe(true);
    } finally {
      write.resolve();
      await task;
    }
  });

  it("keeps different articles and fields independent", async () => {
    const { state, qc, article } = setup();
    const write = deferred();
    const task = state.set(qc, 1, "isRead", true, () => write.promise);
    await state.set(qc, 1, "isStarred", true, async () => {});
    expect(state.overlay({ ...article, id: 2 }).isRead).toBe(false);
    expect(state.overlay(article)).toMatchObject({ isRead: true });
    expect(qc.getQueryData<ArticleSummary>(["article", 1])!.isStarred).toBe(true);
    write.resolve();
    await task;
  });
});
