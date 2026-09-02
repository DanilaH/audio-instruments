from pathlib import Path

# Preserve the established Tone safety hook while keeping the Sonic Field strip.
tone = Path("src/tools/tone-generator/ToneGenerator.astro")
text = tone.read_text()
old = '<div class="tone-state-strip">'
new = '<div class="tone-state-strip tone-safety">'
if new not in text:
    if old not in text:
        raise SystemExit("Tone safety anchor not found")
    text = text.replace(old, new, 1)
tone.write_text(text)

# Assert the controller-owned runtime state, not a made-up copy string.
spec = Path("tests/browser/sonic-field-generated-signal-production-layout.spec.ts")
text = spec.read_text()
old = 'await expect(page.locator("#frequency-sweep-status")).toContainText("Playing");'
new = '''await expect(page.locator("#frequency-sweep-status")).toHaveAttribute(
      "data-state",
      "playing",
    );'''
if 'page.locator("#frequency-sweep-status")).toHaveAttribute(' not in text:
    if old not in text:
        raise SystemExit("Frequency active-state assertion anchor not found")
    text = text.replace(old, new, 1)
spec.write_text(text)

# Recover low-height desktop budget from the non-interactive visualization and
# spacing only. 44/48px controls stay unchanged.
sweep = Path("src/tools/frequency-sweep/FrequencySweep.astro")
text = sweep.read_text()
compact = '''
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
if compact.strip() not in text:
    if anchor not in text:
        raise SystemExit("Frequency compact-media anchor not found")
    text = text.replace(anchor, compact + "\n" + anchor, 1)
sweep.write_text(text)
