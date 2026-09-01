from pathlib import Path

path = Path("src/tools/audio-latency/AudioLatency.astro")
text = path.read_text(encoding="utf-8")

old = """  .latency-field-header output {\n    font-weight: 700;\n  }"""
new = """  .latency-field-header output {\n    flex: 0 0 auto;\n    font-weight: 700;\n    white-space: nowrap;\n  }"""
if old not in text:
    raise SystemExit("latency field-header target missing")
text = text.replace(old, new, 1)

old = """    .latency-result {\n      padding: 8px 10px;\n      font-size: 0.8rem;\n    }"""
new = """    .latency-result {\n      padding: 8px 10px;\n      font-size: 0.75rem;\n      white-space: nowrap;\n    }\n\n    .latency-field-header {\n      gap: 6px;\n    }\n\n    .latency-field-header label {\n      flex: 0 0 auto;\n      font-size: 0.8rem;\n      white-space: nowrap;\n    }"""
if old not in text:
    raise SystemExit("latency mobile result target missing")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
