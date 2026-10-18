const REPO_API = "https://api.github.com/repos/jimersylee/zen-rss-reader";
const REPO_URL = "https://github.com/jimersylee/zen-rss-reader";
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

/** Compare ancestry, not hash strings: a different commit is not always newer. */
export async function checkSourceCommit(commit: string, fetcher: typeof fetch = fetch) {
  if (!SHA.test(commit)) throw new Error("Build commit is unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const json = async (path: string) => {
      const response = await fetcher(`${REPO_API}/${path}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`GitHub update check failed: HTTP ${response.status}`);
      return response.json();
    };
    const head = await json("commits/main");
    if (typeof head.sha !== "string" || !SHA.test(head.sha)) {
      throw new Error("GitHub returned an invalid commit");
    }
    const latest = head.sha as string;
    const url = `${REPO_URL}/compare/${commit}...${latest}`;
    if (commit.toLowerCase() === latest.toLowerCase()) {
      return { status: "identical" as const, commit: latest, url };
    }
    const comparison = await json(`compare/${commit}...${latest}`);
    const status: unknown = comparison.status;
    if (
      status !== "ahead" &&
      status !== "behind" &&
      status !== "diverged" &&
      status !== "identical"
    ) {
      throw new Error("GitHub returned an invalid comparison");
    }
    return { status, commit: latest, url };
  } finally {
    clearTimeout(timer);
  }
}
