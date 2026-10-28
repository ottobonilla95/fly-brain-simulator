import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { parseMeta, parseWeights } from "../src/brain/connectome";
import { InstrumentBrain } from "../src/brain/model";
import type { SensoryInput } from "../src/types";
const buffer = (data: Buffer) =>
  data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
const meta = parseMeta(
  buffer(gunzipSync(readFileSync("public/connectome/meta.bin"))),
);
const weights = parseWeights(
  buffer(
    gunzipSync(
      Buffer.concat(
        ["0", "1"].map((n) =>
          readFileSync(`public/connectome/weights.${n}.bin`),
        ),
      ),
    ),
  ),
);
assert.equal(weights.n, 166700);
assert.equal(weights.nnz, 25088107);
const silent: SensoryInput = {
  left: 0,
  right: 0,
  looming: 0,
  windLeft: 0,
  windRight: 0,
  enabled: true,
};
const conditions = {
  baseline: silent,
  left: { ...silent, left: 1 },
  right: { ...silent, right: 1 },
  loom: { ...silent, looming: 0.8 },
  wind: { ...silent, windLeft: 0.8 },
  sound: { ...silent, soundLeft: 0.8 },
  smell: { ...silent, smellLeft: 0.8 },
  touch: { ...silent, touch: 0.8 },
  taste: { ...silent, taste: 0.8 },
};
const result: Record<string, Record<string, number>> = {};
for (const [name, input] of Object.entries(conditions)) {
  const model = new InstrumentBrain(meta, weights, 64);
  const totals: Record<string, number> = {};
  let ms = 0;
  for (let i = 0; i < 150; i++) {
    const start = performance.now();
    const state = model.step(input);
    ms += performance.now() - start;
    if (i >= 50)
      for (const key of [
        "left",
        "right",
        "escape",
        "wing",
        "windLeft",
        "windRight",
        "hearing",
        "smell",
        "contact",
      ] as const)
        totals[key] = (totals[key] || 0) + state[key] / 100;
  }
  result[name] = { ...totals, stepMs: ms / 150 };
  console.log(name, JSON.stringify(result[name]));
}
assert(
  result.left.left > result.left.right + 1,
  "Left stimulus should drive left steering",
);
assert(
  result.right.right > result.right.left + 1,
  "Right stimulus should drive right steering",
);
assert(
  result.loom.escape > result.baseline.escape + 2,
  "Looming should increase escape activity",
);
assert(
  result.wind.windLeft > result.wind.windRight + 1,
  "Left wind should drive ipsilateral wind DNs",
);
assert(
  result.sound.hearing > result.baseline.hearing + 5,
  "Sound must activate hearing neurons",
);
assert(
  result.smell.smell > result.baseline.smell + 5,
  "Food odour must activate olfactory neurons",
);
assert(
  result.touch.contact > result.baseline.contact + 2,
  "Touch must activate contact neurons",
);
assert(
  result.taste.contact > result.baseline.contact + 2,
  "Taste must activate contact neurons",
);
// Stimulus isolation must be exactly equivalent to no stimulus for a fixed seed.
const a = new InstrumentBrain(meta, weights, 42),
  b = new InstrumentBrain(meta, weights, 42);
for (let i = 0; i < 30; i++)
  assert.deepEqual(
    a.step(silent),
    b.step({
      ...conditions.left,
      looming: 0.8,
      soundLeft: 0.8,
      smellLeft: 0.8,
      touch: 0.8,
      taste: 0.8,
      enabled: false,
    }),
  );
writeFileSync(
  "brain-verification.json",
  JSON.stringify(
    {
      upstreamCommit: "59ff122b39e0f0b51bea9131324f4350c9a57318",
      neurons: weights.n,
      synapses: weights.nnz,
      results: result,
      isolationCheck: "passed",
    },
    null,
    2,
  ),
);
console.log(
  "PASS: tracking, escape, wind, sound, smell, touch, taste and complete input isolation.",
);
