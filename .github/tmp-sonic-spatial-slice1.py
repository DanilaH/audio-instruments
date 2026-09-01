from pathlib import Path


def replace_component(
    path: str,
    root_marker: str,
    import_old: str,
    import_new: str,
    markup: str,
    style: str,
) -> None:
    target = Path(path)
    text = target.read_text()
    if import_old not in text:
        raise SystemExit(f"import anchor not found in {path}")
    text = text.replace(import_old, import_new, 1)
    start = text.index(root_marker)
    script_start = text.index("<script>", start)
    script_end = text.index("</script>", script_start) + len("</script>")
    front = text[:start]
    script = text[script_start:script_end]
    target.write_text(front + markup.strip() + "\n\n" + script + "\n\n" + style.strip() + "\n")


surround_markup = r'''
<div data-surround-test data-surround-mode="unknown">
  <SonicInstrument label="Surround Sound Test controls" class="surround-sheet">
    <div class="surround-sheet__bar">
      <ToolStatus id="surround-status" label="Capability not checked" state="idle" />
      <div class="surround-sheet__state">
        <span>Requested route</span>
        <strong data-surround-visual-label>Not checked</strong>
      </div>
    </div>

    <section class="surround-field" aria-label="Output channel field">
      <div class="surround-field__heading">
        <div>
          <span>Spatial routing field</span>
          <strong>Test the digital channel target directly in the map</strong>
        </div>
        <span class="surround-field__reference">Requested routing · not physical verification</span>
      </div>

      <div class="surround-stage" data-surround-stage>
        <span class="surround-ring" aria-hidden="true"></span>
        <span class="surround-seat" aria-hidden="true">LISTENER</span>
        <span class="surround-stage__idle">Check output capability to choose a verified route.</span>

        <div class="surround-map surround-map--five-one" aria-label="5.1 channel targets">
          <button type="button" class="surround-node surround-node--fl" data-surround-51-channel="0" aria-label="Front Left">FL</button>
          <button type="button" class="surround-node surround-node--fr" data-surround-51-channel="1" aria-label="Front Right">FR</button>
          <button type="button" class="surround-node surround-node--c" data-surround-51-channel="2" aria-label="Center">C</button>
          <button type="button" class="surround-node surround-node--lfe" data-surround-51-channel="3" aria-label="LFE · 80 Hz">LFE</button>
          <button type="button" class="surround-node surround-node--sl" data-surround-51-channel="4" aria-label="Surround Left">SL</button>
          <button type="button" class="surround-node surround-node--sr" data-surround-51-channel="5" aria-label="Surround Right">SR</button>
        </div>

        <div class="surround-map surround-map--eight" aria-label="Experimental eight-channel targets">
          <button type="button" class="surround-node surround-node--raw-1" data-surround-8-channel="0" aria-label="Channel 1">1</button>
          <button type="button" class="surround-node surround-node--raw-2" data-surround-8-channel="1" aria-label="Channel 2">2</button>
          <button type="button" class="surround-node surround-node--raw-3" data-surround-8-channel="2" aria-label="Channel 3">3</button>
          <button type="button" class="surround-node surround-node--raw-4" data-surround-8-channel="3" aria-label="Channel 4">4</button>
          <button type="button" class="surround-node surround-node--raw-5" data-surround-8-channel="4" aria-label="Channel 5">5</button>
          <button type="button" class="surround-node surround-node--raw-6" data-surround-8-channel="5" aria-label="Channel 6">6</button>
          <button type="button" class="surround-node surround-node--raw-7" data-surround-8-channel="6" aria-label="Channel 7">7</button>
          <button type="button" class="surround-node surround-node--raw-8" data-surround-8-channel="7" aria-label="Channel 8">8</button>
        </div>

        <div class="surround-map surround-map--stereo" aria-label="Stereo preview targets">
          <span class="surround-stereo-rail" aria-hidden="true"></span>
          <button type="button" class="surround-node surround-node--left" data-surround-stereo="left">Left</button>
          <button type="button" class="surround-node surround-node--center" data-surround-stereo="center">Center</button>
          <button type="button" class="surround-node surround-node--right" data-surround-stereo="right">Right</button>
        </div>
      </div>

      <p class="surround-field__note">
        These are requested digital routing targets. A confirmed browser graph
        does not prove physical speaker placement, wiring, or acoustic output.
      </p>
    </section>

    <section class="surround-rail" aria-label="Surround Sound Test actions">
      <div class="surround-capability-zone">
        <div class="surround-check-panel">
          <div>
            <span>Capability</span>
            <strong>Confirm browser output first</strong>
            <p>maxChannelCount is only a ceiling; 5.1 requires exact destination readback.</p>
          </div>
          <button type="button" class="surround-primary" data-surround-check>Check surround support</button>
        </div>
        <div class="surround-capability-slot">
          <p class="surround-capability" data-surround-capability role="status" hidden></p>
        </div>
        <div class="surround-mode-slot">
          <div class="surround-mode-selector" data-surround-mode-selector hidden>
            <button type="button" data-surround-mode="five-one" aria-pressed="false" hidden>5.1</button>
            <button type="button" data-surround-mode="experimental-eight" aria-pressed="false" hidden>Experimental 8-channel</button>
            <button type="button" data-surround-mode="stereo-preview" aria-pressed="false" hidden>Stereo spatial preview</button>
          </div>
        </div>
      </div>

      <div class="surround-action-slot">
        <div class="surround-panel" data-surround-panel="five-one" hidden>
          <div class="surround-panel__heading">
            <span>Standardized 5.1</span>
            <strong>FL · FR · Center · LFE · SL · SR</strong>
            <p>Use the map for individual channels or run the deterministic sequence.</p>
          </div>
          <button type="button" class="surround-primary" data-surround-51-all>Test all 5.1 channels</button>
        </div>

        <div class="surround-panel" data-surround-panel="experimental-eight" hidden>
          <div class="surround-panel__heading">
            <span>Experimental 8-channel</span>
            <strong>Raw discrete outputs only</strong>
            <p>Not labeled or claimed as universal 7.1.</p>
          </div>
          <button type="button" class="surround-primary" data-surround-8-all>Test all 8 channels</button>
        </div>

        <div class="surround-panel" data-surround-panel="stereo-preview" hidden>
          <div class="surround-panel__heading">
            <span>Stereo spatial preview</span>
            <strong>Ordinary stereo routing/panning</strong>
            <p>This mode is not surround verification.</p>
          </div>
          <div class="surround-pan-actions">
            <button type="button" data-surround-stereo="left-to-right">L → R</button>
            <button type="button" data-surround-stereo="right-to-left">R → L</button>
          </div>
        </div>
      </div>

      <div class="surround-level"><LevelControl id="surround-level" valueDb={-24} /></div>
      <button type="button" class="surround-stop" data-surround-stop disabled><span class="transport-stop-shape" aria-hidden="true"></span>Stop</button>
    </section>

    <div class="surround-state-strip">
      <strong>Low volume</strong>
      <p>Start with your device/headphone volume low. Increase it only to a comfortable listening level. Do not turn the volume up to compensate for a tone you cannot hear.</p>
    </div>
    <p class="surround-error" data-surround-error role="alert" hidden></p>
  </SonicInstrument>
</div>
'''

surround_style = r'''
<style>
  .surround-sheet__bar { display:flex; min-height:48px; align-items:center; justify-content:space-between; gap:18px; padding:6px 18px; border-bottom:1px solid var(--sonic-border-soft); }
  .surround-sheet__state { display:grid; justify-items:end; gap:1px; min-width:0; text-align:right; }
  .surround-sheet__state span,.surround-field__heading>div>span,.surround-check-panel span,.surround-panel__heading>span { color:var(--sonic-muted); font-size:.67rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
  .surround-sheet__state strong { max-width:310px; overflow:hidden; font-size:.82rem; text-overflow:ellipsis; white-space:nowrap; }
  .surround-field { display:grid; gap:8px; min-height:286px; padding:14px 22px 12px; border-bottom:1px solid var(--sonic-border); background:var(--sonic-field); }
  .surround-field__heading { display:flex; align-items:end; justify-content:space-between; gap:18px; }
  .surround-field__heading>div { display:grid; gap:2px; }
  .surround-field__heading strong { font-size:.88rem; }
  .surround-field__reference { color:var(--sonic-muted); font-size:.69rem; white-space:nowrap; }
  .surround-stage { position:relative; width:min(100%,650px); height:196px; min-height:196px; margin-inline:auto; }
  .surround-ring { position:absolute; inset:8px 64px; border:1px dashed var(--sonic-border); border-radius:50%; opacity:.82; }
  .surround-seat { position:absolute; z-index:2; top:50%; left:50%; display:grid; width:72px; height:38px; place-items:center; border:1px solid var(--sonic-border); border-radius:5px; background:var(--sonic-sheet); color:var(--sonic-muted); font-size:.57rem; font-weight:850; letter-spacing:.08em; transform:translate(-50%,-50%); }
  .surround-stage__idle { position:absolute; z-index:3; left:50%; bottom:4px; width:max-content; max-width:90%; color:var(--sonic-muted); font-size:.7rem; font-weight:750; text-align:center; transform:translateX(-50%); }
  [data-surround-mode]:not([data-surround-mode="unknown"]) .surround-stage__idle { visibility:hidden; }
  .surround-map { position:absolute; inset:0; display:none; }
  [data-surround-mode="five-one"] .surround-map--five-one,[data-surround-mode="experimental-eight"] .surround-map--eight,[data-surround-mode="stereo-preview"] .surround-map--stereo { display:block; }
  .surround-node { position:absolute; z-index:4; display:grid; min-width:48px; min-height:48px; place-items:center; padding:5px 8px; border:1px solid var(--sonic-border); border-radius:7px; background:rgb(238 234 224 / .94); color:var(--sonic-ink); font-size:.72rem; font-weight:850; cursor:pointer; transition:border-color 120ms ease,background-color 120ms ease,color 120ms ease; }
  .surround-node:hover:not(:disabled),.surround-node:focus-visible { border-color:var(--sonic-signal); }
  .surround-node--fl { top:18px; left:15%; } .surround-node--fr { top:18px; right:15%; } .surround-node--c { top:0; left:50%; transform:translateX(-50%); } .surround-node--lfe { right:4%; bottom:58px; } .surround-node--sl { bottom:5px; left:17%; } .surround-node--sr { right:17%; bottom:5px; }
  .surround-node--raw-1 { top:0; left:50%; transform:translateX(-50%); } .surround-node--raw-2 { top:22px; right:15%; } .surround-node--raw-3 { top:74px; right:5%; } .surround-node--raw-4 { right:18%; bottom:4px; } .surround-node--raw-5 { bottom:0; left:50%; transform:translateX(-50%); } .surround-node--raw-6 { bottom:4px; left:18%; } .surround-node--raw-7 { top:74px; left:5%; } .surround-node--raw-8 { top:22px; left:15%; }
  .surround-stereo-rail { position:absolute; top:50%; right:12%; left:12%; height:1px; background:var(--sonic-border); }
  .surround-node--left { top:50%; left:9%; transform:translateY(-50%); } .surround-node--center { top:50%; left:50%; transform:translate(-50%,-50%); } .surround-node--right { top:50%; right:9%; transform:translateY(-50%); }
  .surround-field__note { margin:0; color:var(--sonic-muted); font-size:.7rem; line-height:1.35; }
  .surround-rail { display:grid; grid-template-columns:minmax(320px,1.15fr) minmax(300px,1fr) minmax(180px,.65fr) 110px; min-height:186px; border-bottom:1px solid var(--sonic-border-soft); }
  .surround-rail>* { min-width:0; padding:10px 14px; } .surround-rail>*+* { border-left:1px solid var(--sonic-border-soft); }
  .surround-capability-zone { display:grid; align-content:start; gap:5px; }
  .surround-check-panel { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:9px; }
  .surround-check-panel>div,.surround-panel__heading { display:grid; gap:1px; }
  .surround-check-panel strong,.surround-panel__heading strong { font-size:.82rem; }
  .surround-check-panel p,.surround-panel__heading p,.surround-capability { margin:0; color:var(--sonic-muted); font-size:.66rem; line-height:1.3; }
  .surround-capability-slot { min-height:34px; }
  .surround-capability { padding:4px 0; }
  .surround-capability[hidden] { display:none; }
  .surround-mode-slot { min-height:46px; }
  .surround-mode-selector { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
  .surround-mode-selector[hidden] { display:none; }
  .surround-action-slot { position:relative; min-height:166px; overflow:hidden; }
  .surround-panel { position:absolute; inset:10px 14px; display:grid; align-content:start; gap:8px; }
  .surround-panel[hidden] { display:none; }
  .surround-pan-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
  .surround-rail button,.surround-stop { min-height:44px; border:1px solid var(--sonic-border); border-radius:5px; background:transparent; color:var(--sonic-ink); font-weight:800; cursor:pointer; }
  .surround-primary { border-color:var(--sonic-ink)!important; background:var(--sonic-ink)!important; color:#f7f6ef!important; }
  .surround-mode-selector button[aria-pressed="true"] { border-color:var(--sonic-signal); background:rgb(39 127 138 / .07); color:#0b6570; }
  .surround-level { display:flex; align-items:center; } .surround-level :global(.level-control) { width:100%; }
  .surround-stop { align-self:center; margin:10px; padding:0 9px; } .transport-stop-shape { display:inline-block; width:9px; height:9px; margin-right:7px; border-radius:1px; background:currentColor; }
  button:disabled { cursor:not-allowed; opacity:.5; }
  .surround-state-strip { display:grid; grid-template-columns:92px minmax(0,1fr); gap:12px; padding:8px 18px; color:var(--sonic-muted); }
  .surround-state-strip strong { color:var(--sonic-current); font-size:.68rem; letter-spacing:.06em; text-transform:uppercase; }
  .surround-state-strip p,.surround-error { margin:0; font-size:.7rem; line-height:1.35; } .surround-error { padding:8px 18px 10px; color:var(--sonic-opposing); } .surround-error[hidden] { display:none; }
  @media (min-width:981px) and (max-height:920px) { .surround-field { min-height:256px; padding-block:10px 9px; } .surround-stage { height:174px; min-height:174px; } .surround-ring { inset-block:5px; } .surround-rail { min-height:170px; } .surround-action-slot { min-height:150px; } .surround-panel { inset-block:8px; } }
  @media (max-width:1040px) { .surround-rail { grid-template-columns:1.15fr 1fr; } .surround-rail>*:nth-child(3) { border-left:0; border-top:1px solid var(--sonic-border-soft); } .surround-rail>*:nth-child(4) { border-top:1px solid var(--sonic-border-soft); } }
  @media (max-width:660px) { .surround-sheet__bar { padding-inline:14px; } .surround-field { min-height:268px; padding:12px 12px 10px; } .surround-field__heading { align-items:start; } .surround-field__reference { display:none; } .surround-stage { height:182px; min-height:182px; } .surround-ring { inset-inline:34px; } .surround-node { min-width:44px; min-height:44px; padding:4px 6px; font-size:.65rem; } .surround-node--fl { left:10%; } .surround-node--fr { right:10%; } .surround-node--sl { left:11%; } .surround-node--sr { right:11%; } .surround-rail { grid-template-columns:1fr; } .surround-rail>*+* { border-left:0; border-top:1px solid var(--sonic-border-soft); } .surround-check-panel { grid-template-columns:1fr; } .surround-action-slot { min-height:146px; } .surround-state-strip { grid-template-columns:1fr; gap:4px; padding-inline:14px; } }
  @media (max-width:360px) { .surround-node { min-width:42px; padding-inline:4px; } .surround-node--fl,.surround-node--sl { left:5%; } .surround-node--fr,.surround-node--sr { right:5%; } }
  @media (prefers-reduced-motion:reduce) { .surround-node { transition:none; } }
</style>
'''

phase_markup = r'''
<div data-phase-test data-phase-mode="idle">
  <SonicInstrument label="Phase Test output controls" class="phase-sheet">
    <div class="phase-sheet__bar">
      <ToolStatus id="phase-status" label="Ready" state="idle" />
      <div class="phase-reference">
        <span>Reference</span>
        <strong>Correlated pink noise</strong>
        <small>same source · same playback position</small>
      </div>
    </div>

    <section class="phase-field" aria-label="Phase relationship visualization">
      <div class="phase-field__heading">
        <div><span>Channel relationship</span><strong>Compare polarity without moving the visual stage</strong></div>
        <p class="phase-mode">Relationship: <strong data-phase-mode-label>None</strong></p>
      </div>
      <div class="phase-waveforms" data-phase-stage aria-hidden="true">
        <div class="phase-waveform-row">
          <span>L</span>
          <svg viewBox="0 0 420 92" preserveAspectRatio="none"><path d="M0 46 C28 18 48 74 78 46 S130 20 160 46 S214 72 244 46 S296 18 326 46 S382 74 420 46"></path></svg>
        </div>
        <div class="phase-waveform-row phase-waveform-row--right">
          <span>R</span>
          <svg viewBox="0 0 420 92" preserveAspectRatio="none"><path d="M0 46 C28 18 48 74 78 46 S130 20 160 46 S214 72 244 46 S296 18 326 46 S382 74 420 46"></path></svg>
        </div>
      </div>
      <p class="phase-field__note">Relationship cue only — not a measured waveform or a physical wiring diagnosis.</p>
    </section>

    <section class="phase-rail" aria-label="Phase Test actions">
      <div class="phase-copy"><span>Compare relationship</span><strong>One deterministic source stays running</strong><p>Switching changes only the requested right-channel sign.</p></div>
      <div class="phase-actions phase-actions--modes">
        <button type="button" data-phase-in-phase aria-pressed="false">In phase</button>
        <button type="button" data-phase-inverted aria-pressed="false">Inverted</button>
      </div>
      <div class="phase-actions phase-actions--utility">
        <button type="button" class="phase-toggle" data-phase-toggle disabled>A/B toggle</button>
        <button type="button" class="phase-stop" data-phase-stop disabled><span class="transport-stop-shape" aria-hidden="true"></span>Stop</button>
      </div>
    </section>

    <div class="phase-state-strip"><strong>Low volume</strong><p>Start with your device/headphone volume low. Increase it only to a comfortable listening level. Do not turn the volume up to compensate for a tone you cannot hear.</p></div>
    <p class="phase-error" data-phase-error role="alert" hidden></p>
  </SonicInstrument>
</div>
'''

phase_style = r'''
<style>
  .phase-sheet__bar { display:flex; min-height:48px; align-items:center; justify-content:space-between; gap:18px; padding:6px 18px; border-bottom:1px solid var(--sonic-border-soft); }
  .phase-reference { display:grid; justify-items:end; gap:1px; text-align:right; } .phase-reference span,.phase-field__heading>div>span,.phase-copy>span { color:var(--sonic-muted); font-size:.67rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; } .phase-reference strong { font-size:.82rem; } .phase-reference small { color:var(--sonic-muted); font-size:.65rem; }
  .phase-field { display:grid; gap:8px; min-height:272px; padding:15px 22px 12px; border-bottom:1px solid var(--sonic-border); background:var(--sonic-field); }
  .phase-field__heading { display:flex; align-items:end; justify-content:space-between; gap:18px; } .phase-field__heading>div { display:grid; gap:2px; } .phase-field__heading strong { font-size:.88rem; }
  .phase-mode { margin:0; color:var(--sonic-muted); font-size:.76rem; } .phase-mode strong { color:var(--sonic-ink); }
  .phase-waveforms { display:grid; align-content:center; gap:6px; width:min(100%,760px); min-height:176px; margin-inline:auto; }
  .phase-waveform-row { display:grid; grid-template-columns:26px 1fr; align-items:center; gap:10px; } .phase-waveform-row>span { color:var(--sonic-muted); font-weight:850; }
  .phase-waveform-row svg { width:100%; height:72px; overflow:visible; } .phase-waveform-row path { fill:none; stroke:var(--sonic-signal); stroke-width:4; stroke-linecap:round; vector-effect:non-scaling-stroke; opacity:.48; transition:opacity 120ms ease,transform 60ms linear; transform-origin:50% 50%; }
  [data-phase-mode="in-phase"] .phase-waveform-row path { opacity:.95; } [data-phase-mode="inverted"] .phase-waveform-row path { opacity:.72; } [data-phase-mode="inverted"] .phase-waveform-row--right path { stroke:var(--sonic-opposing); transform:scaleY(-1); opacity:1; }
  .phase-field__note { margin:0; color:var(--sonic-muted); font-size:.7rem; line-height:1.35; text-align:center; }
  .phase-rail { display:grid; grid-template-columns:minmax(300px,1.1fr) minmax(220px,.8fr) minmax(250px,.9fr); min-height:128px; border-bottom:1px solid var(--sonic-border-soft); }
  .phase-rail>* { min-width:0; padding:13px 15px; } .phase-rail>*+* { border-left:1px solid var(--sonic-border-soft); }
  .phase-copy { display:grid; align-content:center; gap:2px; } .phase-copy strong { font-size:.84rem; } .phase-copy p { margin:0; color:var(--sonic-muted); font-size:.7rem; line-height:1.35; }
  .phase-actions { display:grid; align-content:center; gap:7px; } .phase-actions--modes,.phase-actions--utility { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .phase-actions button { min-height:44px; border:1px solid var(--sonic-border); border-radius:5px; background:transparent; color:var(--sonic-ink); font-weight:800; cursor:pointer; }
  .phase-actions--modes button[aria-pressed="true"] { border-color:var(--sonic-signal); background:rgb(39 127 138 / .07); color:#0b6570; }
  .phase-toggle { border-color:var(--sonic-ink)!important; background:var(--sonic-ink)!important; color:#f7f6ef!important; }
  .transport-stop-shape { display:inline-block; width:9px; height:9px; margin-right:7px; border-radius:1px; background:currentColor; }
  button:disabled { cursor:not-allowed; opacity:.5; }
  .phase-state-strip { display:grid; grid-template-columns:92px minmax(0,1fr); gap:12px; padding:8px 18px; color:var(--sonic-muted); } .phase-state-strip strong { color:var(--sonic-current); font-size:.68rem; letter-spacing:.06em; text-transform:uppercase; } .phase-state-strip p,.phase-error { margin:0; font-size:.7rem; line-height:1.35; } .phase-error { padding:8px 18px 10px; color:var(--sonic-opposing); } .phase-error[hidden] { display:none; }
  @media (min-width:981px) and (max-height:920px) { .phase-field { min-height:238px; padding-block:11px 9px; } .phase-waveforms { min-height:148px; } .phase-waveform-row svg { height:60px; } .phase-rail { min-height:112px; } .phase-rail>* { padding-block:10px; } }
  @media (max-width:760px) { .phase-sheet__bar { padding-inline:14px; } .phase-reference small { display:none; } .phase-field { min-height:244px; padding:12px 14px 10px; } .phase-field__heading { align-items:start; } .phase-mode { text-align:right; } .phase-waveforms { min-height:148px; } .phase-waveform-row svg { height:62px; } .phase-rail { grid-template-columns:1fr; } .phase-rail>*+* { border-left:0; border-top:1px solid var(--sonic-border-soft); } .phase-state-strip { grid-template-columns:1fr; gap:4px; padding-inline:14px; } }
  @media (prefers-reduced-motion:reduce) { .phase-waveform-row path { transition:none; } }
</style>
'''

replace_component(
    "src/tools/surround-sound-test/SurroundSoundTest.astro",
    "<div data-surround-test",
    'import InstrumentSurface from "../../components/layout/InstrumentSurface.astro";',
    'import SonicInstrument from "../../components/layout/SonicInstrument.astro";',
    surround_markup,
    surround_style,
)
replace_component(
    "src/tools/phase-test/PhaseTest.astro",
    "<div data-phase-test",
    'import InstrumentSurface from "../../components/layout/InstrumentSurface.astro";',
    'import SonicInstrument from "../../components/layout/SonicInstrument.astro";',
    phase_markup,
    phase_style,
)

surround_layout = Path("tests/browser/surround-layout.spec.ts")
text = surround_layout.read_text()
text += r'''

async function readStageBox(page: Page) {
  return page.locator("[data-surround-stage]").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
}

test("Surround keeps its spatial stage footprint fixed through capability negotiation and mode changes", async ({ page }) => {
  await installExactFiveOneContext(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/surround-sound-test");

  const before = await readStageBox(page);
  await page.getByRole("button", { name: "Check surround support" }).click();
  const afterCapability = await readStageBox(page);

  for (const key of ["x", "y", "width", "height"] as const) {
    expect(afterCapability[key]).toBeCloseTo(before[key], 1);
  }

  await expect(page.locator("[data-surround-51-channel]")).toHaveCount(6);
  await expect(page.locator("[data-surround-stereo]")).toHaveCount(5);

  const stereoMode = page.getByRole("button", { name: "Stereo spatial preview" });
  if (await stereoMode.isVisible()) {
    await stereoMode.click();
    const afterMode = await readStageBox(page);
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(afterMode[key]).toBeCloseTo(before[key], 1);
    }
  }
});
'''
surround_layout.write_text(text)

stereo_phase_layout = Path("tests/browser/stereo-phase-layout.spec.ts")
text = stereo_phase_layout.read_text()
text += r'''

test("Phase uses one stable Sonic Field relationship stage across polarity changes", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/phase-test");
  await expect(page.locator("[data-sonic-instrument]")).toHaveCount(1);
  const stage = page.locator("[data-phase-stage]");
  const before = await stage.boundingBox();
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "In phase" }).click();
  const inPhase = await stage.boundingBox();
  await page.getByRole("button", { name: "Inverted" }).click();
  const inverted = await stage.boundingBox();

  expect(inPhase).toEqual(before);
  expect(inverted).toEqual(before);
  await expect(page.getByText("Relationship cue only — not a measured waveform or a physical wiring diagnosis.")).toBeVisible();
});
'''
stereo_phase_layout.write_text(text)
