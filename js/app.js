import { AudioEngine } from "./audio/engine.js";
import { Transport } from "./audio/transport.js";
import { coypuCode } from "./export/coypu.js";
import { MidiOutput } from "./midi/midi-output.js";
import { canRestore, restore, snapshot } from "./persistence/snapshot.js";
import { Session } from "./sequencer/session.js";
import { CodeModal } from "./ui/code-modal.js";
import { ControlsView } from "./ui/controls-view.js";
import { DieView } from "./ui/die-view.js";
import { restartAnimation } from "./ui/dom.js";
import { HeroView } from "./ui/hero-view.js";
import { LaneInput } from "./ui/lane-input.js";
import { LanesView } from "./ui/lanes-view.js";
import { MidiPanel } from "./ui/midi-panel.js";
import { bindShortcuts } from "./ui/shortcuts.js";
import { Toast } from "./ui/toast.js";

// Mediator / composition root: builds the model, the services and the views, and is the one
// place that knows which of them a user action touches. Nothing else imports across layers.
export class App {
  constructor() {
    this.session = new Session();
    this.audio = new AudioEngine();
    this.midi = new MidiOutput(this.audio);
    this.transport = new Transport({ session: this.session, audio: this.audio, midi: this.midi });

    this.die = new DieView();
    this.hero = new HeroView(this.session);
    this.lanes = new LanesView(this.session);
    this.controls = new ControlsView(this.session);
    this.midiPanel = new MidiPanel(this.midi);
    this.toast = new Toast();
    this.modal = new CodeModal();
  }

  // data: a snapshot to restore, else a fresh roll
  start(data) {
    this.die.setFace(5);
    if (!(canRestore(data) && restore(this.session, data))) this.session.roll();
    this.controls.sync(); this.controls.setPlaying(false); this.renderAll();

    this.die.onClick(this.roll);
    this.controls.bind({
      togglePlay: this.togglePlay,
      regenerate: this.regenerate,
      copyCoypu: this.copyCoypu,
      setMaster: this.setMaster,
      setBpm: bpm => { this.session.bpm = bpm; this.controls.showBpm(); this.audio.setDelayTime(this.session.stepDuration); },
      setRnd: pct => { this.session.rnd = pct; this.controls.sync(); },
      setMicro: on => { this.session.micro = on; this.controls.sync(); },
    });
    new LaneInput({
      session: this.session,
      view: this.lanes,
      actions: {
        toggleMute: this.toggleMute,
        rerollTrack: this.rerollTrack,
        setTrackLen: this.setTrackLen,
        setGate: (k, v) => this.session.setGate(k, v),
      },
    }).bind();
    this.modal.bind();
    bindShortcuts({ togglePlay: this.togglePlay, roll: this.roll, regenerate: this.regenerate, closeModal: () => this.modal.close() });

    this.transport.on("state", playing => this.controls.setPlaying(playing));
    this.transport.on("playhead", g => this.lanes.setPlayhead(g));
    this.transport.on("notice", msg => this.toast.show(msg));
    this.midi.on("notice", msg => this.toast.show(msg));
    this.midiPanel.bind();
    if (this.midi.supported) {
      addEventListener("pagehide", () => this.midi.panic());
      this.midi.autoConnect();
    }
  }

  snapshot() { return snapshot(this.session); }

  renderAll() { this.hero.render(); this.lanes.render(); }

  /* ----------------------------- actions ---------------------------- */
  // arrow properties, so they can be handed out as event handlers
  roll = () => this.die.roll(() => { this.session.roll(); this.renderAll(); });

  regenerate = () => { this.session.regenerate(); this.renderAll(); this.controls.spinRegen(); };

  togglePlay = () => this.transport.toggle();

  setMaster = n => {
    if (!this.session.setMaster(n)) return;
    this.transport.wrap(n);
    this.controls.sync();
    this.renderAll();
  };

  setTrackLen = (k, n) => {
    if (!this.session.setTrackLen(k, n)) return;
    this.lanes.fillGrid(k);
    if (this.transport.playing) this.lanes.setPlayhead(this.lanes.patternStep);
  };

  rerollTrack = (k, button) => {
    this.session.rerollTrack(k);
    this.lanes.fillGrid(k);
    restartAnimation(button, "spin");
  };

  toggleMute = k => {
    const muted = this.session.toggleMute(k);
    if (k >= 0) this.audio.setTrackMuted(k, muted);
    this.lanes.updateLane(k);
  };

  copyCoypu = async () => {
    const txt = coypuCode(this.session);
    try { await navigator.clipboard.writeText(txt); this.toast.show("Coypu code copied"); }
    catch (e) { this.modal.open(txt); }
  };
}
