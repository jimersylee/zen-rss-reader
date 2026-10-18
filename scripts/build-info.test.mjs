import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuildInfo } from "./build-info.mjs";

test("embeds the actual build checkout HEAD and dirty state", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const info = readBuildInfo(root);
  assert.equal(info.commit, git("rev-parse", "HEAD"));
  assert.equal(info.dirty, git("status", "--porcelain", "--untracked-files=normal") !== "");
});

test("source archives show unknown, not a fabricated commit", () => {
  const folder = mkdtempSync(join(tmpdir(), "zenrss-build-info-"));
  try {
    assert.deepEqual(readBuildInfo(folder), { commit: null, dirty: false });
  } finally {
    rmSync(folder, { recursive: true });
  }
});
