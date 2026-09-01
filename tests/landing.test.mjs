import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

// Production target: https://www.rebuttal.live — a live debate platform.
describe("rebuttal.live — landing page", () => {
  it("loads the landing page with branding and primary calls to action", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({ url: "https://www.rebuttal.live" });

    // The hero headline should render.
    const headline = await testdriver.assert(
      'the page shows the hero heading "ARGUE. DEBATE. RANK UP."'
    );
    expect(headline).toBeTruthy();

    // Branding and primary CTA should be visible.
    const branding = await testdriver.assert(
      'the "REBUTTAL.LIVE" branding is visible in the top-left'
    );
    expect(branding).toBeTruthy();

    const cta = await testdriver.assert(
      'a "DEBATE NOW" call-to-action button is visible'
    );
    expect(cta).toBeTruthy();
  });
});
