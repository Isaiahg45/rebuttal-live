import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

// Production target: https://www.rebuttal.live/login
// Auth is Google OAuth + Supabase magic-link email, so there are no static
// example credentials to complete a real sign-in. This sample test verifies
// the login page renders its sign-in options, which is the meaningful,
// deterministic public surface to cover.
describe("rebuttal.live — login page", () => {
  it("shows the sign-in options (Google + magic-link email)", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: "https://www.rebuttal.live/login",
    });

    const heading = await testdriver.assert(
      'the login card shows a "WELCOME BACK" heading'
    );
    expect(heading).toBeTruthy();

    const google = await testdriver.assert(
      'a "Continue with Google" sign-in button is visible'
    );
    expect(google).toBeTruthy();

    const magicLink = await testdriver.assert(
      'there is an email input and a "Send Magic Link" button for passwordless sign-in'
    );
    expect(magicLink).toBeTruthy();
  });
});
