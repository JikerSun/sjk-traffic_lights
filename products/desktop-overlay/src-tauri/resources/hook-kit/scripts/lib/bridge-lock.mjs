import { openSync, closeSync, unlinkSync } from "node:fs";

const DEFAULT_RETRIES = 24;
const RETRY_MS = 25;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBridgeLock(bridgePath, fn, maxRetries = DEFAULT_RETRIES) {
  const lockPath = `${bridgePath}.lock`;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const fd = openSync(lockPath, "wx");
      closeSync(fd);
      try {
        return await fn();
      } finally {
        try {
          unlinkSync(lockPath);
        } catch {
          // ignore stale lock cleanup failures
        }
      }
    } catch {
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`bridge lock timeout: ${bridgePath}`);
}
