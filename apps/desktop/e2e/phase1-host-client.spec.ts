import { test } from "@playwright/test";

test.describe("Phase 1 host-client flow", () => {
  test.skip("discover, approve, open text/image/pdf, and stop session", async () => {
    // Desktop E2E requires packaged binaries and multi-machine LAN orchestration.
    // The scenario is intentionally defined and tracked here for CI evolution.
  });
});
