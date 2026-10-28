import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { parseMeta, parseWeights } from "../src/brain/connectome";
import { InstrumentBrain } from "../src/brain/model";
import { advancePose, encodeSources } from "../src/environment";
import type { SensoryHistory } from "../src/environment";
import type { WorldSource, WorldPose } from "../src/types";
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
function run(source: WorldSource, steps: number, others: WorldSource[] = []) {
  const model = new InstrumentBrain(meta, weights, 64);
  model.setNoise(1);
  let pose: WorldPose = {
    x: 0,
    z: 0,
    heading: 0,
    escapeUntil: 0,
    escapeLatched: false,
  };
  const history: SensoryHistory = new Map();
  const initialDistance = Math.hypot(source.x, source.z);
  let minDistance = initialDistance,
    peakEscape = 0,
    peakSmell = 0,
    firstEscapeDistance: number | null = null;
  const path = [];
  for (let i = 0; i < steps; i++) {
    const input = encodeSources(
      [source, ...others],
      pose,
      i * model.brain.p.dt,
      false,
      history,
    );
    const n = model.step(input);
    pose = advancePose(pose, n);
    const distance = Math.hypot(source.x - pose.x, source.z - pose.z);
    if (n.escape >= 5 && firstEscapeDistance === null)
      firstEscapeDistance = distance;
    minDistance = Math.min(minDistance, distance);
    peakEscape = Math.max(peakEscape, n.escape);
    peakSmell = Math.max(peakSmell, n.smellLeft + n.smellRight);
    if (i % 25 === 0)
      path.push({
        t: n.simTime,
        x: pose.x,
        z: pose.z,
        distance,
        escape: n.escape,
      });
  }
  return {
    initialDistance,
    finalDistance: Math.hypot(source.x - pose.x, source.z - pose.z),
    minDistance,
    peakEscape,
    peakSmell,
    firstEscapeDistance,
    pose,
    path,
  };
}
const source = (patch: Partial<WorldSource>): WorldSource => ({
  id: "test",
  kind: "smell",
  x: 2.8,
  z: 0,
  visible: false,
  strength: 0.85,
  enabled: true,
  pulseAt: -1,
  ...patch,
});
const threat = run(source({ kind: "loom", x: 0, z: 1.3, visible: true }), 125);
console.log(
  "threat",
  JSON.stringify({
    initialDistance: threat.initialDistance,
    finalDistance: threat.finalDistance,
    closestDistance: threat.minDistance,
    peakEscape: threat.peakEscape,
  }),
);
assert(
  threat.peakEscape > 5,
  "Placed threat must activate escape neurons without a manual pulse",
);
assert(
  threat.finalDistance > threat.initialDistance + 0.7,
  "Escape must carry the fly away from the threat, not merely raise it",
);
const hiddenThreat = run(
  source({ kind: "loom", x: 0, z: 1.3, visible: false }),
  125,
);
assert(
  hiddenThreat.peakEscape < 5,
  "Invisible threat must not trigger the visual escape response",
);
const smellRight = run(source({}), 900);
console.log(
  "smell right",
  JSON.stringify({
    initialDistance: smellRight.initialDistance,
    finalDistance: smellRight.finalDistance,
    closestDistance: smellRight.minDistance,
    peakEscape: smellRight.peakEscape,
  }),
);
assert(smellRight.peakSmell > 5, "Food source must reach smell neurons");
assert(
  smellRight.minDistance < 0.65,
  "The fly must reach the neighbourhood of the right-hand food source",
);
assert(
  smellRight.finalDistance < 0.65,
  "Food seeking must remain near the source after reaching it",
);
const smellLeft = run(source({ x: -2.8 }), 900);
console.log(
  "smell left",
  JSON.stringify({
    initialDistance: smellLeft.initialDistance,
    finalDistance: smellLeft.finalDistance,
    closestDistance: smellLeft.minDistance,
    peakEscape: smellLeft.peakEscape,
  }),
);
assert(
  smellLeft.minDistance < 0.65,
  "The fly must follow a food source on either side",
);
assert(
  smellLeft.finalDistance < 0.65,
  "Food seeking must remain near left-hand food",
);
const smellBehind = run(source({ x: 0, z: -2.8 }), 1000);
console.log(
  "food behind",
  JSON.stringify({
    finalDistance: smellBehind.finalDistance,
    closestDistance: smellBehind.minDistance,
  }),
);
assert(
  smellBehind.finalDistance < 0.8,
  "The fly must turn around and follow a smell behind it",
);
const competingVisual = run(source({}), 900, [
  source({ id: "visual", kind: "target", x: -2.8, z: 1, visible: true }),
]);
console.log(
  "food with competing visual target",
  JSON.stringify({
    closestDistance: competingVisual.minDistance,
    finalDistance: competingVisual.finalDistance,
  }),
);
assert(
  competingVisual.minDistance < 0.8,
  "Food seeking must still approach food with another visible target present",
);
assert(
  competingVisual.finalDistance < 0.8,
  "Food seeking must hold near the source despite a competing visual target",
);
const disabledSmell = run(source({ enabled: false }), 400);
assert(
  disabledSmell.minDistance > 2,
  "With smell disabled there must be no food-seeking response",
);
writeFileSync(
  "behavior-verification.json",
  JSON.stringify(
    {
      passed: true,
      noiseFactor: 1,
      conditions: {
        threat,
        hiddenThreat,
        smellRight,
        smellLeft,
        smellBehind,
        competingVisual,
        disabledSmell,
      },
      decoder:
        "Designed olfactory steering from ORN firing-rate difference; escape onset turn and dash from DNp01 firing",
    },
    null,
    2,
  ),
);
console.log(
  "PASS: source → brain → body: automatic threat escape increases distance; smell following reaches food from either side; hidden/disabled controls do not respond.",
);
