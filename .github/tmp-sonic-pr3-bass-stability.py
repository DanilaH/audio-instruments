from pathlib import Path

path = Path("src/tools/bass-test/BassTest.astro")
text = path.read_text()
old = '''    .bass-panel-slot {
      grid-column: auto;
      grid-row: auto;
      border-top: 1px solid var(--sonic-border-soft);
      border-bottom: 1px solid var(--sonic-border-soft);
    }
'''
new = '''    .bass-panel-slot {
      grid-column: auto;
      grid-row: auto;
      min-height: 237px;
      border-top: 1px solid var(--sonic-border-soft);
      border-bottom: 1px solid var(--sonic-border-soft);
    }

    .bass-panel {
      min-height: 237px;
    }
'''
if new not in text:
    if old not in text:
        raise SystemExit("Bass mobile panel-slot anchor not found")
    text = text.replace(old, new, 1)
path.write_text(text)
