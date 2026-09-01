from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if text.count(old) < count:
        raise SystemExit(f"missing replacement target in {path}: {old[:120]!r}")
    text = text.replace(old, new, count)
    file.write_text(text, encoding="utf-8")


# Speaker: keep the mode panel footprint stable without changing controls or behavior.
replace(
    "src/tools/speaker-test/SpeakerTest.astro",
    """          <p class=\"speaker-panel__copy\">\n            Listen for buzzing, rattles or resonances. Keep the system volume\n            moderate; low audibility is not a reason to turn it up aggressively.\n          </p>""",
    """          <p class=\"speaker-panel__copy\">\n            Listen for buzzing, rattles or resonances at moderate volume. Do not\n            raise system volume to chase hard-to-hear lows.\n          </p>""",
)
replace(
    "src/tools/speaker-test/SpeakerTest.astro",
    """  .speaker-panel {\n    display: grid;\n    gap: 9px;\n    min-height: 126px;\n  }""",
    """  .speaker-panel {\n    display: grid;\n    gap: 9px;\n    min-height: 167px;\n  }""",
)
replace(
    "src/tools/speaker-test/SpeakerTest.astro",
    """    .speaker-panel {\n      min-height: 118px;\n    }""",
    """    .speaker-panel {\n      min-height: 168px;\n    }\n  }\n\n  @media (max-width: 340px) {\n    .speaker-panel {\n      min-height: 185px;\n    }""",
)

# Headphone: reserve the actual mode-content area and tighten redundant bass copy.
replace(
    "src/tools/headphone-test/HeadphoneTest.astro",
    """          <p class=\"headphone-panel__copy\">\n            Listen for rattles or obvious asymmetry at moderate volume. If a low\n            tone is hard to hear, do not compensate by turning the system volume\n            up aggressively.\n          </p>""",
    """          <p class=\"headphone-panel__copy\">\n            Listen for rattles or obvious left/right asymmetry at moderate volume.\n            Do not raise system volume to chase hard-to-hear lows.\n          </p>""",
)
replace(
    "src/tools/headphone-test/HeadphoneTest.astro",
    """  .headphone-channel-hint,\n  .headphone-panel {\n    display: grid;\n    gap: 8px;\n    min-height: 118px;\n  }""",
    """  .headphone-channel-hint,\n  .headphone-panel {\n    display: grid;\n    gap: 8px;\n    min-height: 167px;\n  }""",
)
replace(
    "src/tools/headphone-test/HeadphoneTest.astro",
    """    .headphone-channel-hint,\n    .headphone-panel {\n      min-height: 112px;\n    }""",
    """    .headphone-channel-hint,\n    .headphone-panel {\n      min-height: 170px;\n    }\n  }\n\n  @media (max-width: 340px) {\n    .headphone-channel-hint,\n    .headphone-panel {\n      min-height: 185px;\n    }""",
)

# Bass: single-tone is already the tallest state; preserve that footprint for other modes.
replace(
    "src/tools/bass-test/BassTest.astro",
    """  .bass-panel {\n    display: grid;\n    gap: 9px;\n    min-height: 142px;\n  }""",
    """  .bass-panel {\n    display: grid;\n    gap: 9px;\n    min-height: 181px;\n  }""",
)
replace(
    "src/tools/bass-test/BassTest.astro",
    """    .bass-panel {\n      gap: 7px;\n      min-height: 118px;\n    }""",
    """    .bass-panel {\n      gap: 7px;\n      min-height: 181px;\n    }""",
)
replace(
    "src/tools/bass-test/BassTest.astro",
    """    .bass-panel {\n      min-height: 0;\n    }""",
    """    .bass-panel {\n      min-height: 239px;\n    }""",
)

# Noise: reserve only the optional timer reminder slot instead of shifting the footer.
replace(
    "src/tools/noise-generator/NoiseGenerator.astro",
    """        <fieldset class=\"noise-group\">\n          <legend>Timer</legend>""",
    """        <fieldset class=\"noise-group noise-group--timer\">\n          <legend>Timer</legend>""",
)
replace(
    "src/tools/noise-generator/NoiseGenerator.astro",
    """          <p class=\"noise-long-reminder\" data-noise-long-reminder hidden>\n            <i class=\"ph ph-timer\" aria-hidden=\"true\"></i>\n            Long playback: keep device/headphone volume at a comfortable level.\n          </p>""",
    """          <div class=\"noise-long-reminder-slot\">\n            <p class=\"noise-long-reminder\" data-noise-long-reminder hidden>\n              <i class=\"ph ph-timer\" aria-hidden=\"true\"></i>\n              Long playback: keep device/headphone volume at a comfortable level.\n            </p>\n          </div>""",
)
replace(
    "src/tools/noise-generator/NoiseGenerator.astro",
    """  .noise-long-reminder {\n    display: flex;\n    align-items: center;\n    gap: 7px;\n    margin-top: 7px;\n    padding: 8px 10px;""",
    """  .noise-long-reminder-slot {\n    display: grid;\n    min-height: 31px;\n    padding-top: 7px;\n  }\n\n  .noise-long-reminder {\n    display: flex;\n    align-items: center;\n    gap: 7px;\n    margin: 0;\n    padding: 8px 10px;""",
)
replace(
    "src/tools/noise-generator/NoiseGenerator.astro",
    """    .noise-long-reminder {\n      margin-top: 5px;\n      padding: 6px 8px;\n    }""",
    """    .noise-long-reminder-slot {\n      min-height: 48px;\n      padding-top: 5px;\n    }\n\n    .noise-long-reminder {\n      padding: 6px 8px;\n    }""",
)

# Frequency Sweep: force the intended mobile composition, then stack only at 320-class widths.
replace(
    "src/tools/frequency-sweep/FrequencySweep.astro",
    """    .sweep-selector {\n      grid-template-columns: 1fr;\n      gap: 2px;\n      padding: 3px;\n    }\n\n    .sweep-selector button {\n      min-height: 34px;\n      font-size: 0.72rem;\n    }""",
    """    .sweep-options .sweep-selector {\n      grid-template-columns: minmax(0, 1fr);\n      gap: 2px;\n      padding: 3px;\n    }\n\n    .sweep-selector button {\n      min-height: 44px;\n      font-size: 0.72rem;\n    }""",
)
replace(
    "src/tools/frequency-sweep/FrequencySweep.astro",
    """  @media (prefers-reduced-motion: reduce) {\n    [data-sweep-visual=\"playing\"] .sweep-cursor {""",
    """  @media (max-width: 340px) {\n    .sweep-range-grid,\n    .sweep-options {\n      grid-template-columns: 1fr;\n    }\n\n    .sweep-range-grid.sweep-range-grid :global(.frequency-control) {\n      grid-template-columns: 1fr;\n    }\n\n    .sweep-options .sweep-selector {\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n    }\n\n    .sweep-selector button {\n      min-width: 0;\n      padding-inline: 5px;\n      font-size: 0.7rem;\n    }\n  }\n\n  @media (prefers-reduced-motion: reduce) {\n    [data-sweep-visual=\"playing\"] .sweep-cursor {""",
)

# Spectrum: preserve three compact view tabs while making the longest label fit at 320.
replace(
    "src/tools/spectrum-analyzer/SpectrumAnalyzer.astro",
    """    .spectrum-view-switch button {\n      min-height: 42px;\n      font-size: 0.74rem;\n    }""",
    """    .spectrum-view-switch button {\n      min-height: 44px;\n      padding-inline: 4px;\n      font-size: 0.72rem;\n    }""",
)
replace(
    "src/tools/spectrum-analyzer/SpectrumAnalyzer.astro",
    """    .spectrum-canvas-meta {\n      display: none;\n    }\n  }\n</style>""",
    """    .spectrum-canvas-meta {\n      display: none;\n    }\n  }\n\n  @media (max-width: 340px) {\n    .spectrum-view-switch button {\n      padding-inline: 2px;\n      font-size: 0.68rem;\n      letter-spacing: -0.01em;\n    }\n  }\n</style>""",
)
