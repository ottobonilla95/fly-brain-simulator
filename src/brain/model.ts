import {
  ConnectomeBrain,
  cells,
  type ConnectomeMeta,
  type ConnectomeWeights,
} from "./connectome";
import type { NeuralState, SensoryInput } from "../types";

// Population choices follow upstream Pong, drone and flytalk. See MODEL.md.
const STEER = ["DNa02", "DNg111", "DNae002"];
const WIND = ["DNg05_a", "DNg06_a", "DNg29", "DNge016"];
const ANTENNA = [
  "JO-CL",
  "JO-CM",
  "JO-CA2",
  "JO-EV1",
  "JO-EV2",
  "JO-EV3",
  "JO-EV5",
  "JO-EV6",
  "JO-ED1",
  "JO-ED2_a",
  "JO-ED2_b",
  "JO-ED2_c",
];
const WINGS = [
  "DLMn a, b",
  "DLMn c-f",
  "DVMn 1a-c",
  "DVMn 2a, b",
  "DVMn 3a, b",
  "MNwm35",
  "MNwm36",
  "b1 MN",
  "b2 MN",
  "b3 MN",
  "hg1 MN",
  "hg2 MN",
  "hg3 MN",
  "hg4 MN",
  "i1 MN",
  "i2 MN",
  "iii1 MN",
  "iii3 MN",
  "ps1 MN",
  "tp1 MN",
  "tp2 MN",
  "tpn MN",
];

export class InstrumentBrain {
  brain: ConnectomeBrain;
  groups: Record<string, Int32Array>;
  rates: Record<string, number> = {};
  private mask: Uint8Array;
  private baseNoise: number;
  constructor(
    readonly meta: ConnectomeMeta,
    readonly weights: ConnectomeWeights,
    seed = 64,
  ) {
    this.brain = new ConnectomeBrain(weights, { ...meta.params }, seed);
    this.baseNoise = meta.params.noise_amp;
    this.groups = {
      seeL: cells(meta, ["LC10a"], "L"),
      seeR: cells(meta, ["LC10a"], "R"),
      loomL: cells(meta, ["LC4", "LPLC2"], "L"),
      loomR: cells(meta, ["LC4", "LPLC2"], "R"),
      left: cells(meta, STEER, "L"),
      right: cells(meta, STEER, "R"),
      escape: cells(meta, ["DNp01"]),
      wing: cells(meta, WINGS),
      antennaL: cells(meta, ANTENNA, "L"),
      antennaR: cells(meta, ANTENNA, "R"),
      earL: cells(
        meta,
        meta.types.filter((t) => t.startsWith("JO-A") || t.startsWith("JO-B")),
        "L",
      ),
      earR: cells(
        meta,
        meta.types.filter((t) => t.startsWith("JO-A") || t.startsWith("JO-B")),
        "R",
      ),
      smellL: cells(meta, ["ORN_DM1", "ORN_DM2"], "L"),
      smellR: cells(meta, ["ORN_DM1", "ORN_DM2"], "R"),
      touch: cells(meta, ["BM_InOm"]),
      taste: cells(meta, ["claw_tpGRN", "dorsal_tpGRN", "BM_Taste"]),
      windLeft: cells(meta, WIND, "L"),
      windRight: cells(meta, WIND, "R"),
    };
    for (const key of [
      "seeL",
      "seeR",
      "left",
      "right",
      "escape",
      "wing",
      "antennaL",
      "antennaR",
      "windLeft",
      "windRight",
      "earL",
      "earR",
      "smellL",
      "smellR",
      "touch",
      "taste",
    ]) {
      if (!this.groups[key].length)
        throw new Error(`Missing connectome population: ${key}`);
    }
    this.mask = new Uint8Array(weights.n);
    for (let k = 0; k < 25; k++) this.brain.step();
  }
  setNoise(factor: number) {
    this.brain.p.noise_amp = this.baseNoise * Math.max(0, Math.min(2, factor));
  }
  step(input: SensoryInput): NeuralState {
    const b = this.brain,
      g = this.groups;
    if (input.enabled) {
      b.stimulate(g.seeL, input.left);
      b.stimulate(g.seeR, input.right);
      b.stimulate(g.loomL, input.looming);
      b.stimulate(g.loomR, input.looming);
      b.stimulate(g.antennaL, input.windLeft);
      b.stimulate(g.antennaR, input.windRight);
      b.stimulate(g.earL, input.soundLeft ?? 0);
      b.stimulate(g.earR, input.soundRight ?? 0);
      b.stimulate(g.smellL, input.smellLeft ?? 0);
      b.stimulate(g.smellR, input.smellRight ?? 0);
      b.stimulate(g.touch, input.touch ?? 0);
      b.stimulate(g.taste, input.taste ?? 0);
    }
    b.step();
    this.mask.fill(0);
    for (let k = 0; k < b.firedCount; k++) this.mask[b.fired[k]] = 1;
    const a = Math.exp(-b.p.dt / 0.16);
    for (const key of [
      "left",
      "right",
      "escape",
      "wing",
      "seeL",
      "seeR",
      "windLeft",
      "windRight",
      "earL",
      "earR",
      "smellL",
      "smellR",
      "touch",
      "taste",
    ]) {
      const group = g[key];
      let count = 0;
      for (let k = 0; k < group.length; k++) count += this.mask[group[k]];
      this.rates[key] =
        a * (this.rates[key] || 0) +
        ((1 - a) * count) / (group.length * b.p.dt);
    }
    return {
      left: this.rates.left,
      right: this.rates.right,
      escape: this.rates.escape,
      wing: this.rates.wing,
      sensory: (this.rates.seeL + this.rates.seeR) / 2,
      windLeft: this.rates.windLeft,
      windRight: this.rates.windRight,
      fired: b.firedCount,
      stepMs: 0,
      simTime: Math.max(0, (b.steps - 25) * b.p.dt),
      dt: b.p.dt,
      hearing: (this.rates.earL + this.rates.earR) / 2,
      smell: (this.rates.smellL + this.rates.smellR) / 2,
      smellLeft: this.rates.smellL,
      smellRight: this.rates.smellR,
      contact: (this.rates.touch + this.rates.taste) / 2,
    };
  }
}
