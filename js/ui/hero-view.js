import { PARTCH_R, TUNING } from "../data/tunings.js";
import { harmonyText } from "../theory/chords.js";
import { LET, accStr, pcName } from "../theory/spelling.js";
import { $ } from "./dom.js";

// The current scale: root, name, SuperCollider code, scale tones, tuning and harmony.
export class HeroView {
  constructor(session) { this.session = session; }

  render() {
    const ctx = this.session.ctx, sc = ctx.scale, h = this.session.harmony;
    const acc = accStr(ctx.root.acc);                                  // the accidental set as a superior
    $("#root").innerHTML = LET[ctx.root.L] + (acc ? `<span class="acc">${acc}</span>` : "");
    $("#sname").textContent = sc.name;
    $("#sccode").innerHTML = `Scale.<em>${sc.key}</em> #[${sc.deg.join(", ")}]${sc.desc ? ` / desc #[${sc.desc.join(", ")}]` : ""}`;
    const tones = h[0].tones;
    $("#tones").innerHTML = ctx.degs.map(d => {
      const cls = d.ai === 0 ? "tone r" : tones.has(d.ai) ? "tone c" : d.asc ? "tone" : "tone d";
      const sub = sc.ppo === 43 ? `${PARTCH_R[d.step]}${d.sp.cents ? ` ${d.sp.cents > 0 ? "+" : "−"}${Math.abs(d.sp.cents)}¢` : ""}` : d.asc ? d.step : `${d.step} desc`;
      return `<span class="${cls}"><b>${pcName(d.sp)}</b><small>${sub}</small></span>`;
    }).join("");
    $("#tuning").textContent = `${TUNING[sc.ppo].label} · ${sc.deg.length} notes${sc.desc ? " asc/desc" : ""}`;
    $("#harmony").textContent = harmonyText(ctx, h);
  }
}
