// Exercise the actual production worker and streamed HTTP loader, without a UI driver.
import { Worker } from "node:worker_threads";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.FLY_TEST_BASE || "http://127.0.0.1:5174/";
const filename = readdirSync("dist/assets").find(
  (name) => name.startsWith("brain.worker-") && name.endsWith(".js"),
);
assert(filename, "Build the app first");
const html = await fetch(base).then((r) => {
  assert(r.ok);
  return r.text();
});
assert(html.includes("Fly Brain Simulator"));
const shim = `const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);parentPort.on('message',data=>globalThis.onmessage?.({data}));`;
const worker = new Worker(
  shim + readFileSync(`dist/assets/${filename}`, "utf8"),
  { eval: true },
);
const messages = [];
let workerError;
worker.on("message", (data) =>
  messages.push({ ...data, receivedAt: performance.now() }),
);
worker.on("error", (error) => {
  workerError = error;
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeout = 20000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    if (workerError) throw workerError;
    const error = messages.find((m) => m.type === "error");
    if (error) throw new Error(error.message);
    const found = messages.find(predicate);
    if (found) return found;
    await sleep(30);
  }
  throw new Error("Timed out waiting for the production worker");
}
try {
  worker.postMessage({ type: "load", base: `${base}connectome/` });
  const ready = await waitFor((m) => m.type === "ready");
  assert.equal(ready.neurons, 166700);
  assert.equal(ready.synapses, 25088107);
  assert(ready.populations.wing > 0 && ready.populations.left > 0);
  worker.postMessage({
    type: "input",
    value: {
      left: 1,
      right: 0,
      looming: 0,
      windLeft: 0,
      windRight: 0,
      enabled: true,
    },
  });
  worker.postMessage({ type: "running", value: true });
  const tracking = await waitFor(
    (m) =>
      m.type === "state" &&
      m.state.simTime >= 1.5 &&
      m.state.left > m.state.right + 2,
  );
  assert(Number.isFinite(tracking.state.stepMs));
  worker.postMessage({ type: "running", value: false });
  await sleep(100);
  const count = messages.filter((m) => m.type === "state").length;
  await sleep(200);
  assert.equal(
    messages.filter((m) => m.type === "state").length,
    count,
    "Pause must stop telemetry",
  );
  worker.postMessage({ type: "noise", value: 0 });
  worker.postMessage({ type: "reset" });
  const resetStart = messages.length;
  worker.postMessage({
    type: "input",
    value: {
      left: 0,
      right: 0,
      looming: 0.8,
      windLeft: 0,
      windRight: 0,
      enabled: true,
    },
  });
  worker.postMessage({ type: "running", value: true });
  await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= resetStart &&
      m.state.simTime <= 0.1,
  );
  const escape = await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= resetStart &&
      m.state.simTime >= 0.6 &&
      m.state.escape > 5,
  );
  worker.postMessage({ type: "running", value: false });
  await sleep(100);
  worker.postMessage({ type: "reset" });
  worker.postMessage({ type: "speed", value: 2 });
  const combinedStart = messages.length;
  const sources = ["sound", "smell", "taste", "touch"].map((kind, i) => ({
    id: `source-${i}`,
    kind,
    x: -1,
    z: 0.7,
    strength: 1,
    enabled: true,
    visible: false,
    pulseAt: -1,
  }));
  worker.postMessage({
    type: "environment",
    value: { sources, isolated: false },
  });
  worker.postMessage({ type: "running", value: true });
  const combined = await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= combinedStart &&
      m.state.simTime > 0.3 &&
      m.state.hearing > 5 &&
      m.state.smell > 5 &&
      m.state.contact > 5,
  );
  assert(
    Math.hypot(combined.pose.x + 1, combined.pose.z - 0.6) > 0.05,
    "Body must advance along with brain time",
  );
  assert(combined.input.soundLeft + combined.input.soundRight > 0);
  worker.postMessage({
    type: "environment",
    value: { sources, isolated: true },
  });
  const isolationStart = messages.length;
  const isolated = await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= isolationStart &&
      m.input.enabled === false,
  );
  assert(
    Object.entries(isolated.input).every(
      ([key, value]) => key === "enabled" || value === 0,
    ),
  );
  async function measureSpeed(value) {
    worker.postMessage({ type: "running", value: false });
    await sleep(80);
    worker.postMessage({ type: "reset" });
    worker.postMessage({ type: "speed", value });
    const start = messages.length;
    worker.postMessage({ type: "running", value: true });
    await sleep(1200);
    worker.postMessage({ type: "running", value: false });
    await sleep(80);
    const states = messages.slice(start).filter((m) => m.type === "state");
    assert(states.length >= 5);
    const first = states[0],
      last = states.at(-1);
    return (
      (last.state.simTime - first.state.simTime) /
      ((last.receivedAt - first.receivedAt) / 1000)
    );
  }
  const halfSpeed = await measureSpeed(0.5);
  const doubleSpeed = await measureSpeed(2);
  assert(
    halfSpeed > 0.35 && halfSpeed < 0.75,
    `Half-speed clock: ${halfSpeed}`,
  );
  assert(
    doubleSpeed > halfSpeed * 2,
    `Faster clock must advance more neural steps: ${doubleSpeed}`,
  );
  worker.postMessage({ type: "noise", value: 1 });
  worker.postMessage({ type: "reset" });
  worker.postMessage({ type: "speed", value: 5 });
  const threatSource = {
    id: "automatic-threat",
    kind: "loom",
    x: -1 + Math.sin(1.6) * 1.3,
    z: 0.6 + Math.cos(1.6) * 1.3,
    strength: 0.85,
    visible: true,
    enabled: true,
    pulseAt: -1,
  };
  const threatStart = messages.length;
  worker.postMessage({
    type: "environment",
    value: { sources: [threatSource], isolated: false },
  });
  worker.postMessage({ type: "running", value: true });
  const escaped = await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= threatStart &&
      m.pose.escapeUntil > 0 &&
      Math.hypot(m.pose.x - threatSource.x, m.pose.z - threatSource.z) > 2,
  );
  worker.postMessage({ type: "running", value: false });
  await sleep(80);
  worker.postMessage({ type: "reset" });
  const foodSource = {
    ...threatSource,
    id: "food",
    kind: "smell",
    x: -1,
    z: 3.2,
    visible: false,
  };
  const foodStart = messages.length;
  worker.postMessage({
    type: "environment",
    value: { sources: [foodSource], isolated: false },
  });
  worker.postMessage({ type: "running", value: true });
  const reachedFood = await waitFor(
    (m) =>
      m.type === "state" &&
      messages.indexOf(m) >= foodStart &&
      m.state.simTime > 1 &&
      Math.hypot(m.pose.x - foodSource.x, m.pose.z - foodSource.z) < 0.6,
  );
  worker.postMessage({ type: "running", value: false });
  writeFileSync(
    "worker-verification.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "HTTP production entry",
          "HTTP streamed gzip asset loading",
          "population metadata",
          "left-side tracking telemetry",
          "pause stops worker loop",
          "reset restores simulation clock",
          "resume and looming escape",
          "noise control accepted",
          "combined sound, smell, touch and taste sources activate sensory neurons",
          "worker advances body with neural time",
          "environment isolation clears all input channels",
          "0.5x and 2x change measured neural clock speed",
          "automatic threat triggers a visible escape carrying the body away",
          "smell-only food source is reached by olfactory motor decoding",
        ],
        neurons: ready.neurons,
        synapses: ready.synapses,
        populations: ready.populations,
        tracking: tracking.state,
        escape: escape.state,
        combined: combined.state,
        measuredSpeed: { halfSpeed, doubleSpeed },
        automaticEscape: {
          pose: escaped.pose,
          distance: Math.hypot(
            escaped.pose.x - threatSource.x,
            escaped.pose.z - threatSource.z,
          ),
        },
        foodSeeking: {
          simTime: reachedFood.state.simTime,
          pose: reachedFood.pose,
          distance: Math.hypot(
            reachedFood.pose.x - foodSource.x,
            reachedFood.pose.z - foodSource.z,
          ),
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: production worker loads, tracks, pauses, resets, combines senses, isolates input, advances the body and changes simulation speed.",
  );
} finally {
  await worker.terminate();
}
