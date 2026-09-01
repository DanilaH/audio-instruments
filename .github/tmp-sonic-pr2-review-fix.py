from pathlib import Path

speaker_controller = Path("src/tools/speaker-test/SpeakerTestController.ts")
text = speaker_controller.read_text()
old = "    for (const button of this.#channelButtons) button.disabled = disableStarts;"
new = '''    for (const button of this.#channelButtons) {
      button.disabled = disableStarts || this.#mode !== "channel";
    }'''
if new not in text:
    if old not in text:
        raise SystemExit("Speaker channel-state anchor not found")
    text = text.replace(old, new, 1)
speaker_controller.write_text(text)

stereo_controller = Path("src/tools/stereo-test/StereoTestController.ts")
text = stereo_controller.read_text()
text = text.replace(
    'this.#setVisual("center", "None");',
    'this.#setVisual(null, "None");',
)
old_signature = '''  #setVisual(action: StereoAction | "center", label: string): void {
    this.#root.dataset.stereoVisual = action;
    this.#positionLabel.textContent = label;
    for (const button of this.#actionButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.stereoAction === action),
      );
    }
  }'''
new_signature = '''  #setVisual(action: StereoAction | null, label: string): void {
    this.#root.dataset.stereoVisual = action ?? "center";
    this.#positionLabel.textContent = label;
    for (const button of this.#actionButtons) {
      button.setAttribute(
        "aria-pressed",
        String(action !== null && button.dataset.stereoAction === action),
      );
    }
  }'''
if new_signature not in text:
    if old_signature not in text:
        raise SystemExit("Stereo setVisual anchor not found")
    text = text.replace(old_signature, new_signature, 1)
return_anchor = '''    this.#root.dataset.stereoVisual =
      action === "left-to-right" ? "return-from-right" : "return-from-left";'''
return_replacement = '''    for (const button of this.#actionButtons) {
      button.setAttribute("aria-pressed", "false");
    }
    this.#root.dataset.stereoVisual =
      action === "left-to-right" ? "return-from-right" : "return-from-left";'''
if return_replacement not in text:
    if return_anchor not in text:
        raise SystemExit("Stereo return-state anchor not found")
    text = text.replace(return_anchor, return_replacement, 1)
stereo_controller.write_text(text)

speaker_spec = Path("tests/browser/speaker-layout.spec.ts")
text = speaker_spec.read_text()
speaker_test = r'''

test("Speaker channel targets are disabled outside Channel mode", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/speaker-test");

  const targets = ["Left", "Both", "Right"] as const;
  for (const name of targets) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  }

  for (const mode of ["Phase", "Sweep", "Bass / rattle"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    for (const name of targets) {
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    }
  }

  await page.getByRole("button", { name: "Channel", exact: true }).click();
  for (const name of targets) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  }
});
'''
if "Speaker channel targets are disabled outside Channel mode" not in text:
    text += speaker_test
speaker_spec.write_text(text)

stereo_spec = Path("tests/browser/stereo-phase-layout.spec.ts")
text = stereo_spec.read_text()
stereo_test = r'''

test("Stereo neutral center is not exposed as an active playback selection", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stereo-test");

  await expect(page.locator('[data-stereo-action][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("[data-stereo-position-label]")).toHaveText("None");
  await expect(page.locator("[data-stereo-test]")).toHaveAttribute(
    "data-stereo-visual",
    "center",
  );
});
'''
if "Stereo neutral center is not exposed as an active playback selection" not in text:
    text += stereo_test
stereo_spec.write_text(text)
