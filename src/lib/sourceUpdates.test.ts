import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSourceCommit } from "./sourceUpdates";

const current = "a".repeat(40);
const latest = "b".repeat(40);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => vi.useRealTimers());

describe("source commit updates", () => {
  it("identical commits need no ancestry request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ sha: current }));
    expect((await checkSourceCommit(current, fetcher)).status).toBe("identical");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["ahead", "behind", "diverged", "identical"] as const)(
    "uses ancestry status %s rather than comparing hash strings",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response({ sha: latest }))
        .mockResolvedValueOnce(response({ status }));
      const result = await checkSourceCommit(current, fetcher);
      expect(result).toEqual({
        status,
        commit: latest,
        url: `https://github.com/jimersylee/zen-rss-reader/compare/${current}...${latest}`,
      });
      expect(fetcher.mock.calls[1][0]).toContain(`/compare/${current}...${latest}`);
    },
  );

  it.each(["unknown", "", "main", "abc;anything"])(
    "does not send an invalid build commit: %s",
    async (commit) => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(checkSourceCommit(commit, fetcher)).rejects.toThrow(
        "Build commit is unavailable",
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("does not report up to date on an HTTP error or invalid server payload", async () => {
    const forbidden = vi.fn<typeof fetch>().mockResolvedValue(response({}, 403));
    await expect(checkSourceCommit(current, forbidden)).rejects.toThrow("HTTP 403");
    const invalid = vi.fn<typeof fetch>().mockResolvedValue(response({ sha: "invalid" }));
    await expect(checkSourceCommit(current, invalid)).rejects.toThrow("invalid commit");
    const badComparison = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ sha: latest }))
      .mockResolvedValueOnce(response({ status: "unknown" }));
    await expect(checkSourceCommit(current, badComparison)).rejects.toThrow("invalid comparison");
  });

  it("aborts a hung GitHub request after 15 seconds", async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const result = expect(checkSourceCommit(current, fetcher)).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});
