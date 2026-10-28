import assert from "node:assert/strict";
import { advancePose, encodeSources, INITIAL_POSE } from "../src/environment";
import { EMPTY_NEURAL } from "../src/types";
import type { WorldSource } from "../src/types";
const pose = { x: 0, z: 0, heading: 0 };
const source = (patch: Partial<WorldSource>): WorldSource => ({
  id: "test",
  kind: "sound",
  x: 1,
  z: 1,
  strength: 0.8,
  visible: false,
  enabled: true,
  pulseAt: -1,
  ...patch,
});
const left = encodeSources([source({})], pose, 0);
const right = encodeSources([source({ x: -1 })], pose, 0);
assert(
  left.soundLeft! > left.soundRight! && right.soundRight! > right.soundLeft!,
  "Sound must follow source bearing",
);
assert.equal(
  left.left + left.right,
  0,
  "A sound-only source must not inject vision",
);
assert(
  encodeSources([source({ visible: true })], pose, 0).left > 0,
  "Combined senses must include visual stimulation",
);
assert(
  encodeSources([source({ x: 0.5, z: 0.5 })], pose, 0).soundLeft! >
    left.soundLeft!,
  "Closer source must sound stronger",
);
const smell = source({ kind: "smell", z: -1 });
assert(
  encodeSources([smell], pose, 0).smellLeft! > 0,
  "Smell must reach the fly from behind",
);
for (const kind of ["touch", "taste"] as const) {
  assert.equal(
    encodeSources([source({ kind })], pose, 0)[kind],
    0,
    "Contact requires proximity",
  );
  assert(encodeSources([source({ kind, x: 0.2, z: 0 })], pose, 0)[kind]! > 0);
}
const threat = source({ kind: "loom", pulseAt: 1 });
assert(encodeSources([threat], pose, 1.2).looming > 0);
assert.equal(
  encodeSources([threat], pose, 1.5).looming,
  0,
  "Loom pulse must expire in simulation time",
);
const combined = encodeSources(
  [source({}), source({ kind: "smell" }), source({ kind: "wind" })],
  pose,
  0,
);
assert(
  combined.soundLeft! > 0 && combined.smellLeft! > 0 && combined.windLeft > 0,
  "Several sensory sources must combine",
);
assert.equal(
  encodeSources(
    Array.from({ length: 10 }, () => source({})),
    pose,
    0,
  ).soundLeft,
  1,
  "Combined input must remain bounded",
);
assert.equal(encodeSources([source({ enabled: false })], pose, 0).soundLeft, 0);
const isolated = encodeSources([source({ visible: true })], pose, 0, true);
assert.equal(isolated.enabled, false);
assert(
  Object.entries(isolated).every(
    ([key, value]) => key === "enabled" || value === 0,
  ),
);
let a = { ...INITIAL_POSE },
  b = { ...INITIAL_POSE };
for (let i = 0; i < 50; i++) a = advancePose(a, { ...EMPTY_NEURAL, left: 8 });
for (let batch = 0; batch < 10; batch++)
  for (let i = 0; i < 5; i++) b = advancePose(b, { ...EMPTY_NEURAL, left: 8 });
assert.deepEqual(
  a,
  b,
  "Batching steps for faster playback must preserve the trajectory",
);
console.log(
  "PASS: source direction, distance, combined senses, visibility, contact, pulse timing, isolation and speed-independent body steps.",
);
