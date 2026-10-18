import { execFileSync } from "node:child_process";

// Resolve at build time, never from the installed app's working directory.
export function readBuildInfo(root) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  try {
    const commit = git("rev-parse", "HEAD");
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit)) return { commit: null, dirty: false };
    // Conservatively mark the build dirty if status cannot be determined.
    let dirty = true;
    try {
      dirty = git("status", "--porcelain", "--untracked-files=normal") !== "";
    } catch {
      /* keep dirty */
    }
    return { commit, dirty };
  } catch {
    // Source archives may not contain .git. Do not fabricate a commit ID.
    return { commit: null, dirty: false };
  }
}
