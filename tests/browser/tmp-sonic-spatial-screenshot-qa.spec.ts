import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 1_366, height: 768 },
  { width: 1_440, height: 900 },
  { width: 1_280, height: 720 },
  { width: 390, height: 844 },
] as const;

type SpatialRoute =
  | "/speaker-test"
  | "/stereo-test"
  | "/surround-sound-test"
  | "/phase-test";

async function installExactFiveOneContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeParam {
      value = 0;
      cancelAndHoldAtTime() {
        return this;
      }
      cancelScheduledValues() {
        return this;
      }
      setValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      linearRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
    }

    class FakeNode {
      connect(destination: unknown) {
        return destination;
      }
      disconnect() {}
    }

    class FakeGain extends FakeNode {
      gain = new FakeParam();
    }

    class FakeDestination extends FakeNode {
      maxChannelCount = 6;
      channelCount = 2;
      channelCountMode: ChannelCountMode = "max";
      channelInterpretation: ChannelInterpretation = "speakers";
    }

    class FakeAudioContext {
      currentTime = 10;
      sampleRate = 48_000;
      state = "suspended";
      destination = new FakeDestination();
      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createGain() {
        return new FakeGain();
      }
      createChannelMerger() {
        return new FakeNode();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  });
}

async function openChallengeState(page: Page, route: SpatialRoute): Promise<void> {
  if (route === "/surround-sound-test") {
    await installExactFiveOneContext(page);
  }

  await page.goto(route);

  if (route === "/speaker-test") {
    await page.getByRole("button", { name: "Bass / rattle", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Run bass / rattle sweep" }),
    ).toBeVisible();
    return;
  }

  if (route === "/stereo-test") {
    await page.locator("[data-stereo-test]").evaluate((element) => {
      element.setAttribute("data-stereo-visual", "return-from-right");
    });
    await page.waitForTimeout(120);
    return;
  }

  if (route === "/surround-sound-test") {
    await page.getByRole("button", { name: "Check surround support" }).click();
    await expect(page.getByRole("button", { name: "Front Left" })).toBeVisible();
    return;
  }

  await page.locator("[data-phase-test]").evaluate((element) => {
    element.setAttribute("data-phase-mode", "inverted");
  });
}

const routes = [
  { route: "/speaker-test", slug: "speaker-bass" },
  { route: "/stereo-test", slug: "stereo-return" },
  { route: "/surround-sound-test", slug: "surround-51" },
  { route: "/phase-test", slug: "phase-inverted" },
] as const satisfies ReadonlyArray<{ route: SpatialRoute; slug: string }>;

for (const viewport of viewports) {
  for (const item of routes) {
    test(`${item.slug} screenshot ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openChallengeState(page, item.route);
      await expect(page.locator("[data-sonic-instrument]")).toBeVisible();
      await page.screenshot({
        path: `artifacts/spatial-output-screenshots/${item.slug}-${viewport.width}x${viewport.height}.png`,
      });
    });
  }
}
