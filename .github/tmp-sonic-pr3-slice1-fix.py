from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


# Preserve the established Tone safety hook while keeping the Sonic Field strip.
tone = Path("src/tools/tone-generator/ToneGenerator.astro")
text = tone.read_text()
text = replace_once(
    text,
    '<div class="tone-state-strip">',
    '<div class="tone-state-strip tone-safety">',
    "Tone safety",
)

# The canvas has an intrinsic 2:1 aspect ratio. With an indefinite 1fr grid row
# it expands to roughly half the desktop sheet width, which pushes transport and
# safety below the viewport. Give the visualization a deliberate bounded row;
# do not shrink interactive controls to recover vertical budget.
text = replace_once(
    text,
    "grid-template-rows: auto minmax(132px, 1fr) auto;",
    "grid-template-rows: auto clamp(132px, 20vh, 180px) auto;",
    "Tone field row",
)

# Waveform and output mode groups can share the desktop rail horizontally.
# Their 44px pills remain untouched; this removes the max-content height that
# was stretching every rail column to ~240px.
text = replace_once(
    text,
    """  .tone-modes {
    grid-template-columns: 1fr;
  }
""",
    """  .tone-modes {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .tone-modes > .tone-rail__label {
    grid-column: 1 / -1;
  }
""",
    "Tone mode rail",
)

# At narrower layouts the rail itself becomes two columns, so each mode group
# returns to a vertical stack to keep labels and pills readable.
needle = """  @media (max-width: 900px) {
    .tone-field {
      min-height: 210px;
    }
"""
replacement = """  @media (max-width: 900px) {
    .tone-field {
      min-height: 210px;
    }

    .tone-modes {
      grid-template-columns: 1fr;
    }

    .tone-modes > .tone-rail__label {
      grid-column: auto;
    }
"""
text = replace_once(text, needle, replacement, "Tone narrow mode layout")

# Compact desktop gets a deliberately shallow visualization and tighter
# non-interactive spacing. The waveform is a reference visualization, while
# exact frequency/level state remains in the bar and controls. 44/48px control
# heights are deliberately unchanged.
compact_tone = """
  @media (min-width: 901px) and (max-height: 820px) {
    .tone-bar {
      min-height: 48px;
      padding: 8px 14px;
    }

    .tone-field {
      grid-template-rows: auto 88px auto;
      min-height: 0;
      gap: 4px;
      padding: 7px 14px 5px;
    }

    .tone-canvas-wrap,
    .tone-canvas-wrap canvas {
      min-height: 88px;
    }

    .tone-rail {
      grid-template-columns:
        minmax(235px, 1.1fr) minmax(315px, 1.55fr) minmax(165px, 0.72fr)
        minmax(150px, 0.58fr);
      min-height: 154px;
    }

    .tone-rail > div {
      gap: 4px;
      padding: 6px 10px;
    }

    .tone-state-strip {
      min-height: 44px;
      padding-block: 4px;
    }
  }
"""
anchor = "  @media (max-width: 1120px) {"
if compact_tone.strip() not in text:
    if anchor not in text:
        raise SystemExit("Tone compact-media anchor not found")
    text = text.replace(anchor, compact_tone + "\n" + anchor, 1)

tone.write_text(text)

# Assert the controller-owned runtime state, not a made-up copy string.
spec = Path("tests/browser/sonic-field-generated-signal-production-layout.spec.ts")
text = spec.read_text()
text = replace_once(
    text,
    'await expect(page.locator("#frequency-sweep-status")).toContainText("Playing");',
    '''await expect(page.locator("#frequency-sweep-status")).toHaveAttribute(
      "data-state",
      "playing",
    );''',
    "Frequency active-state assertion",
)

# Playwright scrolls off-screen buttons into view before click. Measure the
# sheet in document coordinates so an oversized sheet cannot pass because the
# page was scrolled during activation.
old_fit = '''  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? viewport.height) + (box?.height ?? 0)).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);'''
new_fit = '''  const bounds = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(
    viewport.height - viewport.bottomAir,
  );
  await expectNoHorizontalOverflow(page);'''
text = replace_once(text, old_fit, new_fit, "Generated-signal document bounds")
spec.write_text(text)

# Recover low-height desktop budget from Frequency Sweep's non-interactive
# visualization and spacing only. 44/48px controls stay unchanged.
sweep = Path("src/tools/frequency-sweep/FrequencySweep.astro")
text = sweep.read_text()
compact_sweep = '''
  @media (min-width: 901px) and (max-height: 820px) {
    .sweep-field {
      grid-template-rows: auto 104px auto;
      min-height: 0;
      gap: 5px;
      padding-block: 10px 7px;
    }

    .sweep-stage {
      min-height: 104px;
    }

    .sweep-rail {
      min-height: 0;
    }

    .sweep-rail > div {
      gap: 5px;
      padding: 8px 11px;
    }

    .sweep-state-strip {
      min-height: 44px;
      padding-block: 7px;
    }
  }
'''
anchor = '  @media (max-width: 1180px) {'
if compact_sweep.strip() not in text:
    if anchor not in text:
        raise SystemExit("Frequency compact-media anchor not found")
    text = text.replace(anchor, compact_sweep + "\n" + anchor, 1)
sweep.write_text(text)

# Legacy viewport specs predate the migration contract and required mobile
# one-screen fit. Preserve their desktop assertions; on mobile verify the
# controls remain reachable in document flow and horizontal overflow stays off.
tone_spec = Path("tests/browser/tone-generator.spec.ts")
text = tone_spec.read_text()
old = '''    expect((playBox?.y ?? 9999) + (playBox?.height ?? 0)).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(
      (safetyBox?.y ?? 9999) + (safetyBox?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);'''
new = '''    if (viewport.width >= 900) {
      expect((playBox?.y ?? 9999) + (playBox?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(
        (safetyBox?.y ?? 9999) + (safetyBox?.height ?? 0),
      ).toBeLessThanOrEqual(viewport.height);
    } else {
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
      expect((playBox?.y ?? -1) + (playBox?.height ?? 0)).toBeLessThanOrEqual(
        dimensions.scrollHeight,
      );
      expect((safetyBox?.y ?? -1) + (safetyBox?.height ?? 0)).toBeLessThanOrEqual(
        dimensions.scrollHeight,
      );
      expect(safetyBox?.y ?? -1).toBeGreaterThan(playBox?.y ?? -1);
    }'''
text = replace_once(text, old, new, "Tone legacy mobile viewport")
tone_spec.write_text(text)

sweep_spec = Path("tests/browser/frequency-sweep-layout.spec.ts")
text = sweep_spec.read_text()
old = '''    if (playBox && safetyBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(0);
      expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(playBox.y).toBeGreaterThanOrEqual(0);
      expect(playBox.y + playBox.height).toBeLessThanOrEqual(viewport.height);
    }'''
new = '''    if (playBox && safetyBox) {
      expect(safetyBox.y).toBeGreaterThanOrEqual(0);
      expect(playBox.y).toBeGreaterThanOrEqual(0);
      if (viewport.width >= 900) {
        expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(
          viewport.height,
        );
        expect(playBox.y + playBox.height).toBeLessThanOrEqual(viewport.height);
      } else {
        const scrollHeight = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        expect(playBox.y + playBox.height).toBeLessThanOrEqual(scrollHeight);
        expect(safetyBox.y + safetyBox.height).toBeLessThanOrEqual(scrollHeight);
        expect(safetyBox.y).toBeGreaterThan(playBox.y);
      }
    }'''
text = replace_once(text, old, new, "Frequency legacy mobile viewport")
sweep_spec.write_text(text)
