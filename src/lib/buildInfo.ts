// This object is replaced with a literal by Vite; git is not needed at runtime.
export const buildInfo = __BUILD_INFO__;
export const commitLabel = buildInfo.commit
  ? `${buildInfo.commit.slice(0, 7)}${buildInfo.dirty ? "-dirty" : ""}`
  : "unknown";
