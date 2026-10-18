import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  build: { local: true, commit: "a".repeat(40) as string | null, dirty: false },
  check: vi.fn(),
  source: vi.fn(),
  push: vi.fn(),
  show: vi.fn(),
  error: vi.fn(),
}));
vi.mock("./buildInfo", () => ({ buildInfo: mocks.build }));
vi.mock("./sourceUpdates", () => ({ checkSourceCommit: mocks.source }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("../toast", () => ({
  toast: { show: mocks.show },
  useToasts: { getState: () => ({ push: mocks.push }) },
  reportError: mocks.error,
}));
import { checkForUpdates } from "./updater";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.build, { local: true, commit: "a".repeat(40), dirty: false });
  mocks.check.mockResolvedValue(null);
});

describe("local builds versus signed release updates", () => {
  it("offers source changes for a newer main commit, not binary installation", async () => {
    mocks.source.mockResolvedValue({
      status: "ahead",
      commit: "b".repeat(40),
      url: "https://github.com/jimersylee/zen-rss-reader/compare/a...b",
    });
    await checkForUpdates({ silent: false });
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "update.sourceAvailable",
        action: expect.objectContaining({ label: "update.viewChanges" }),
      }),
    );
  });

  it.each([
    ["identical", false, "update.sourceCurrent"],
    ["identical", true, "update.sourceCurrentDirty"],
    ["behind", false, "update.localAhead"],
    ["diverged", false, "update.localDiverged"],
  ] as const)("does not offer a downgrade for %s, dirty=%s", async (status, dirty, message) => {
    mocks.build.dirty = dirty;
    mocks.source.mockResolvedValue({ status });
    await checkForUpdates({ silent: false });
    expect(mocks.show).toHaveBeenCalledWith(message);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("does not pretend an unknown commit can be compared", async () => {
    mocks.build.commit = null;
    await checkForUpdates({ silent: false });
    expect(mocks.show).toHaveBeenCalledWith("update.commitUnknown");
    expect(mocks.source).not.toHaveBeenCalled();
  });

  it("keeps unchanged local startup checks quiet", async () => {
    mocks.source.mockResolvedValue({ status: "identical" });
    await checkForUpdates({ silent: true });
    expect(mocks.show).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("surfaces manual failures but suppresses automatic-check errors", async () => {
    const error = new Error("rate limited");
    mocks.source.mockRejectedValue(error);
    await checkForUpdates({ silent: false });
    expect(mocks.error).toHaveBeenCalledWith(error);
    mocks.error.mockClear();
    await checkForUpdates({ silent: true });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("release builds still use the signed updater instead of commit comparisons", async () => {
    mocks.build.local = false;
    await checkForUpdates({ silent: false });
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(mocks.source).not.toHaveBeenCalled();
    expect(mocks.show).toHaveBeenCalledWith("update.upToDate");
  });
});
