import { loadConnectome } from "./upstream-loader";
import { InstrumentBrain } from "./model";
import { advancePose, encodeSources, INITIAL_POSE } from "../environment";
import type { SensoryInput, WorldSource } from "../types";
const ctx = self as unknown as {
  postMessage: (data: unknown) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};
let model: InstrumentBrain | null = null;
let loading = false,
  running = false;
let loopTimer: ReturnType<typeof setTimeout> | undefined;
let noise = 1,
  emaMs = 0,
  speed = 1,
  credit = 0;
let lastWall = 0,
  lastReport = -Infinity,
  rateStart = 0,
  rateSim = 0,
  actualSpeed = 0;
let pose = { ...INITIAL_POSE };
let environment: { sources: WorldSource[]; isolated: boolean } | null = null;
let input: SensoryInput = {
  left: 0,
  right: 0,
  looming: 0,
  windLeft: 0,
  windRight: 0,
  enabled: true,
};
function loop() {
  if (!running || !model) return;
  try {
    const start = performance.now();
    credit = Math.min(
      credit + (Math.max(0, start - lastWall) / 1000) * speed,
      0.2 * speed,
    );
    lastWall = start;
    let state;
    let steps = 0;
    // Short batches yield to pause, source edits and other worker messages.
    while (
      credit + 1e-9 >= model.brain.p.dt &&
      steps < 8 &&
      performance.now() - start < 12
    ) {
      if (environment)
        input = encodeSources(
          environment.sources,
          pose,
          Math.max(0, (model.brain.steps - 25) * model.brain.p.dt),
          environment.isolated,
        );
      const before = performance.now();
      state = model.step(input);
      const took = performance.now() - before;
      emaMs = emaMs ? emaMs * 0.95 + took * 0.05 : took;
      if (environment) pose = advancePose(pose, state);
      credit -= model.brain.p.dt;
      steps++;
    }
    const now = performance.now();
    if (state && now - lastReport >= 40) {
      if (now - rateStart >= 300) {
        actualSpeed = (state.simTime - rateSim) / ((now - rateStart) / 1000);
        rateStart = now;
        rateSim = state.simTime;
      }
      ctx.postMessage({
        type: "state",
        state: { ...state, stepMs: emaMs },
        pose,
        input,
        actualSpeed,
      });
      lastReport = now;
    }
    const wait = Math.max(
      0,
      ((model.brain.p.dt - credit) / speed) * 1000 - (now - start),
    );
    loopTimer = setTimeout(loop, wait);
  } catch (error) {
    fail(error);
  }
}
function fail(error: unknown) {
  running = false;
  loading = false;
  clearTimeout(loopTimer);
  ctx.postMessage({
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  });
}
ctx.onmessage = async ({ data }) => {
  try {
    if (data.type === "load" && !model && !loading) {
      loading = true;
      const { meta, weights } = await loadConnectome(data.base, ctx);
      model = new InstrumentBrain(meta, weights);
      model.setNoise(noise);
      ctx.postMessage({
        type: "ready",
        neurons: weights.n,
        synapses: weights.nnz,
        populations: Object.fromEntries(
          Object.entries(model.groups).map(([k, v]) => [k, v.length]),
        ),
      });
      loading = false;
    } else if (data.type === "running") {
      clearTimeout(loopTimer);
      running = data.value;
      credit = 0;
      lastWall =
        performance.now() - ((model?.brain.p.dt ?? 0.02) / speed) * 1000;
      rateStart = performance.now();
      rateSim = model
        ? Math.max(0, (model.brain.steps - 25) * model.brain.p.dt)
        : 0;
      if (running) loop();
    } else if (data.type === "environment") {
      environment = data.value;
    } else if (data.type === "speed") {
      speed = Math.max(0.5, Math.min(5, Number(data.value) || 1));
      credit = 0;
      lastWall = performance.now();
      rateStart = lastWall;
      rateSim = model
        ? Math.max(0, (model.brain.steps - 25) * model.brain.p.dt)
        : 0;
    } else if (data.type === "input") {
      environment = null;
      input = data.value;
    } else if (data.type === "noise") {
      noise = data.value;
      model?.setNoise(noise);
    } else if (data.type === "reset" && model) {
      model = new InstrumentBrain(model.meta, model.weights);
      model.setNoise(noise);
      pose = { ...INITIAL_POSE };
      emaMs = 0;
      credit = 0;
      actualSpeed = 0;
      lastReport = -Infinity;
      rateStart = lastWall = performance.now();
      rateSim = 0;
    }
  } catch (error) {
    fail(error);
  }
};
