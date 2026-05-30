#!/usr/bin/env node

/** Optional recon logging — enable with TRAFFIC_LIGHTS_DEBUG=1 */

export async function appendHookRecon() {
  if (process.env.TRAFFIC_LIGHTS_DEBUG !== "1") {
    return;
  }
  const { appendHookRecon: impl } = await import("./hook-recon-log.impl.mjs");
  return impl(...arguments);
}
