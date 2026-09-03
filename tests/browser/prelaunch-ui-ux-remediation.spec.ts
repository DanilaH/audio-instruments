import { expect, test, type Locator, type Page } from "@playwright/test";

async function readFootprint(page: Page, rootSelector: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) throw new Error(`Missing remediation root: ${selector}`);
    const box = root.getBoundingClientRect();
    return {
      documentHeight: document.documentElement.scrollHeight,
      rootHeight: box.height,
      rootY: box.y,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  }, rootSelector);
}

function expectStableFootprints(
  footprints: readonly Awaited<ReturnType<typeof readFootprint>>[],
): void {
  for (const key of ["documentHeight", "rootHeight"] as const) {
    const values = footprints.map((item) => item[key]);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  }
  for (const footprint of footprints) {
    expect(footprint.overflow).toBeLessThanOrEqual(0);
  }
}

async function expectContained(child: Locator, parent: Locator): Promise<void> {
  await expect(child).toBeVisible();
  const [childBox, parentBox] = await Promise.all([
    child.boundingBox(),
    parent.boundingBox(),
  ]);
  expect(childBox).not.toBeNull();
  expect(parentBox).not.toBeNull();

  const tolerance = 1;
  expect(childBox!.x).toBeGreaterThanOrEqual(parentBox!.x - tolerance);
  expect(childBox!.y).toBeGreaterThanOrEqual(parentBox!.y - tolerance);
  expect(childBox!.x + childBox!.width).toBeLessThanOrEqual(
    parentBox!.x + parentBox!.width + tolerance,
  );
  expect(childBox!.y + childBox!.height).toBeLessThanOrEqual(
    parentBox!.y + parentBox!.height + tolerance,
  );
}

async function installEightChannelContext(page: Page): Promise<void> {
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
      maxChannelCount = 8;
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

for (const viewport of [
  { width: 1_366, height: 768 },
  { width: 1_280, height: 720 },
] as const) {
  test(`Pitch result stays inside its field at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/pitch-detector");

    const geometry = await page.evaluate(() => {
      const heading = document
        .querySelector<HTMLElement>(".pitch-field__heading")!
        .getBoundingClientRect();
      const result = document
        .querySelector<HTMLElement>(".pitch-result")!
        .getBoundingClientRect();
      const eyebrow = document
        .querySelector<HTMLElement>(".pitch-result__eyebrow")!
        .getBoundingClientRect();
      const message = document
        .querySelector<HTMLElement>(".pitch-result__message")!
        .getBoundingClientRect();
      return {
        headingBottom: heading.bottom,
        resultTop: result.top,
        resultBottom: result.bottom,
        eyebrowTop: eyebrow.top,
        messageBottom: message.bottom,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    expect(geometry.resultTop).toBeGreaterThanOrEqual(geometry.headingBottom);
    expect(geometry.eyebrowTop).toBeGreaterThanOrEqual(geometry.resultTop - 1);
    expect(geometry.messageBottom).toBeLessThanOrEqual(
      geometry.resultBottom + 1,
    );
    expect(geometry.overflow).toBeLessThanOrEqual(0);
  });

  test(`Bass mode footprint is stable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/bass-test");

    const footprints = [await readFootprint(page, "[data-bass-test]")];
    for (const name of ["Slow sweep", "Preset sequence"] as const) {
      await page.getByRole("button", { name }).click();
      footprints.push(await readFootprint(page, "[data-bass-test]"));
    }

    expectStableFootprints(footprints);
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const) {
  test(`Surround state footprint is stable and purposeful at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await installEightChannelContext(page);
    await page.setViewportSize(viewport);
    await page.goto("/surround-sound-test");

    const actionSlot = page.locator(".surround-action-slot");
    const placeholder = page.locator(".surround-action-placeholder");
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText("Check support");
    await expectContained(placeholder, actionSlot);

    const footprints = [await readFootprint(page, "[data-surround-test]")];
    await page.getByRole("button", { name: "Check surround support" }).click();
    await expect(
      page.getByRole("button", { name: "Test all 5.1 channels" }),
    ).toBeVisible();
    await expectContained(
      page.locator('[data-surround-panel="five-one"]'),
      actionSlot,
    );
    footprints.push(await readFootprint(page, "[data-surround-test]"));

    await page.getByRole("button", { name: "Experimental 8-channel" }).click();
    await expect(
      page.getByRole("button", { name: "Test all 8 channels" }),
    ).toBeVisible();
    await expectContained(
      page.locator('[data-surround-panel="experimental-eight"]'),
      actionSlot,
    );
    footprints.push(await readFootprint(page, "[data-surround-test]"));

    await page.getByRole("button", { name: "Stereo spatial preview" }).click();
    await expect(page.getByText("Stereo position preview")).toBeVisible();
    await expectContained(
      page.locator('[data-surround-panel="stereo-preview"]'),
      actionSlot,
    );
    footprints.push(await readFootprint(page, "[data-surround-test]"));

    expectStableFootprints(footprints);
  });

  test(`Spectrum hidden input reservations collapse at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/spectrum-analyzer");

    const slots = await page.evaluate(() => ({
      input: document
        .querySelector<HTMLElement>(".spectrum-input-slot")!
        .getBoundingClientRect().height,
      selection: document
        .querySelector<HTMLElement>(".spectrum-selection-slot")!
        .getBoundingClientRect().height,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));

    expect(slots.input).toBeLessThanOrEqual(1);
    expect(slots.selection).toBeLessThanOrEqual(1);
    expect(slots.overflow).toBeLessThanOrEqual(0);
  });
}

test("Decibel collapsed calibration stays compact on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto("/decibel-meter");

  const calibration = page.locator(".db-calibration");
  await expect(calibration).not.toHaveAttribute("open", "");
  const collapsed = await calibration.boundingBox();
  expect(collapsed).not.toBeNull();
  expect(collapsed?.height ?? 999).toBeLessThanOrEqual(70);

  await calibration.locator("summary").click();
  await expect(calibration).toHaveAttribute("open", "");
  const expanded = await calibration.boundingBox();
  expect(expanded).not.toBeNull();
  expect(expanded?.height ?? 0).toBeGreaterThan(collapsed?.height ?? 0);
});
