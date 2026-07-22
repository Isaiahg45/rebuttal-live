import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

// Production target: https://www.rebuttal.live/rankings
// A public page (no auth required) that lists the debater leaderboard.
describe("rebuttal.live — rankings page", () => {
  it("loads the public rankings/leaderboard page", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: "https://www.rebuttal.live/rankings",
    });

    // Give client-side data a moment to load.
    await testdriver.wait(3000);

    const isRankings = await testdriver.assert(
      "the page is a rankings/leaderboard page for rebuttal.live (it shows a ranking or leaderboard of debaters, e.g. ranks, usernames, or ELO scores)"
    );
    expect(isRankings).toBeTruthy();

    // Global nav should still be present with the REBUTTAL branding.
    const branding = await testdriver.assert(
      'the "REBUTTAL" branding is visible in the navigation'
    );
    expect(branding).toBeTruthy();
  });
});
