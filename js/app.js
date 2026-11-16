import { AudioEngine } from "./audio/engine.js";
import { Transport } from "./audio/transport.js";
import { coypuCode } from "./export/coypu.js";
import { MidiOutput } from "./midi/midi-output.js";
import { PatternBank } from "./persistence/pattern-bank.js";
import { canRestore, restore, restoreGlobals, restoreTracks, snapshot, snapshotGlobals, snapshotTracks } from "./persistence/snapshot.js";
import { Session } from "./sequencer/session.js";
import { CodeModal } from "./ui/code-modal.js";
import { ControlsView } from "./ui/controls-view.js";
import { DieView } from "./ui/die-view.js";
import { restartAnimation } from "./ui/dom.js";
import { HeroView } from "./ui/hero-view.js";
import { LaneInput } from "./ui/lane-input.js";
import { LanesView } from "./ui/lanes-view.js";
import { MidiPanel } from "./ui/midi-panel.js";
import { SlotsView } from "./ui/slots-view.js";
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
    this.bank = new PatternBank();

    this.die = new DieView();
    this.hero = new HeroView(this.session);
    this.lanes = new LanesView(this.session);
    this.controls = new ControlsView(this.session);
    this.slots = new SlotsView(this.bank);
    this.midiPanel = new MidiPanel(this.midi);
    this.toast = new Toast();
    this.modal = new CodeModal();
  }

  // data: a snapshot to restore (hot reload), else the pattern bank's active slot, else a fresh roll
  start(data) {
    this.die.setFace(5);
    const bankLoaded = this.bank.load();
    if (!(canRestore(data) && restore(this.session, data))) {
      const b = this.bank;
      if (!(bankLoaded && restoreGlobals(this.session, b.globals) && restoreTracks(this.session, b.get(b.active)))) this.session.roll();
    }
    if (!this.bank.has(this.bank.active)) this.#storeActive();          // first visit: slot 1 is this pattern
    this.controls.sync(); this.controls.setPlaying(false); this.renderAll();
    this.slots.bind({ selectSlot: this.selectSlot, saveSlot: this.saveSlot });
    this.slots.render();

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
        toggleSolo: this.toggleSolo,
        groupMute: group => { this.session.toggleGroup(group, "muted"); this.#applyMix(); },
        groupSolo: group => { this.session.toggleGroup(group, "solo"); this.#applyMix(); },
        rerollTrack: this.rerollTrack,
        setTrackLen: this.setTrackLen,
        setGate: (k, v) => this.session.setGate(k, v),
      },
    }).bind();
    this.modal.bind();
    bindShortcuts({ togglePlay: this.togglePlay, roll: this.roll, regenerate: this.regenerate, closeModal: () => this.modal.close() });

    this.transport.on("state", playing => {
      this.controls.setPlaying(playing);
      if (!playing && this.bank.pending != null) this.#switchTo(this.bank.pending);   // stopped before the bar line
    });
    this.transport.on("bar", () => { if (this.bank.pending != null) this.#switchTo(this.bank.pending, true); });
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

  toggleMute = k => { this.session.toggleMute(k); this.#applyMix(); };
  toggleSolo = k => { this.session.toggleSolo(k); this.#applyMix(); };

  // after a mute or solo: each synth lane's gain follows whether it is heard, and every lane repaints
  #applyMix() {
    this.session.tracks.forEach((_, k) => this.audio.setTrackMuted(k, !this.session.isAudible(k)));
    this.lanes.updateMix();
  }

  /* -------------------------- pattern slots ------------------------- */
  // While playing, the new slot waits for the next bar line; picking the playing slot again
  // cancels the wait.
  selectSlot = i => {
    const b = this.bank;
    if (this.transport.playing) {
      b.pending = i === b.active ? null : i;
      this.slots.render();
      return;
    }
    if (i !== b.active) this.#switchTo(i);
  };

  saveSlot = () => {
    this.#storeActive();
    this.toast.show(`Saved to pattern ${this.bank.active + 1}`);
  };

  // the session's tracks into the active slot, the globals beside them, all to localStorage
  #storeActive() {
    this.bank.put(this.bank.active, snapshotTracks(this.session));
    this.bank.globals = snapshotGlobals(this.session);
    this.bank.persist();
  }

  // Leaving a slot saves it; an empty slot starts as a copy of the one you leave.
  // fromScheduler: called while scheduling a bar line, so the redraw waits for the next frame.
  #switchTo(i, fromScheduler = false) {
    const b = this.bank;
    this.#storeActive();
    if (!(b.has(i) && restoreTracks(this.session, b.get(i)))) b.put(i, snapshotTracks(this.session));
    b.active = i;
    b.pending = null;
    b.persist();
    this.session.tracks.forEach((_, k) => this.audio.setTrackMuted(k, !this.session.isAudible(k)));
    const redraw = () => { this.lanes.render(); this.slots.render(); };
    if (fromScheduler) requestAnimationFrame(redraw); else redraw();
  }

  copyCoypu = async () => {
    const txt = coypuCode(this.session);
    try { await navigator.clipboard.writeText(txt); this.toast.show("Coypu code copied"); }
    catch (e) { this.modal.open(txt); }
  };
}
