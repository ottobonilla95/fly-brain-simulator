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
worker.on("message", (data) => messages.push(data));
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
        ],
        neurons: ready.neurons,
        synapses: ready.synapses,
        populations: ready.populations,
        tracking: tracking.state,
        escape: escape.state,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: production worker loads over HTTP, tracks, pauses, resets and resumes with an escape response.",
  );
} finally {
  await worker.terminate();
}
