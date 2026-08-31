import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectInsideViewport(
  locator: Locator,
  height: number,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

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

test("Surround has no horizontal overflow at 390x844 before or after capability negotiation", async ({
  page,
}) => {
  await installExactFiveOneContext(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/surround-sound-test");

  await expect(
    page.getByRole("button", { name: "Check surround support" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Check surround support" }).click();
  await expect(page.getByRole("button", { name: "Front Left" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Surround keeps the primary 5.1 sequence action and Stop inside 1366x768", async ({
  page,
}) => {
  await installExactFiveOneContext(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/surround-sound-test");
  await page.getByRole("button", { name: "Check surround support" }).click();

  await expectInsideViewport(
    page.getByRole("button", { name: "Test all 5.1 channels" }),
    768,
  );
  await expectInsideViewport(page.getByRole("button", { name: "Stop" }), 768);
  await expectNoHorizontalOverflow(page);
});
