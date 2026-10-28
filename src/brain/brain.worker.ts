import { loadConnectome } from "./upstream-loader";
import { InstrumentBrain } from "./model";
import type { SensoryInput } from "../types";
const ctx = self as unknown as {
  postMessage: (data: unknown) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};
let model: InstrumentBrain | null = null;
let loading = false,
  running = false,
  loopTimer: ReturnType<typeof setTimeout> | undefined;
let noise = 1,
  emaMs = 0,
  tick = 0;
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
  const start = performance.now();
  const state = model.step(input);
  const took = performance.now() - start;
  emaMs = emaMs ? emaMs * 0.95 + took * 0.05 : took;
  // Telemetry at 25 Hz; the simulation itself retains its original 20 ms time step.
  if (++tick % 2 === 0)
    ctx.postMessage({ type: "state", state: { ...state, stepMs: emaMs } });
  loopTimer = setTimeout(loop, Math.max(0, model.brain.p.dt * 1000 - took));
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
      if (running) loop();
    } else if (data.type === "input") input = data.value;
    else if (data.type === "noise") {
      noise = data.value;
      model?.setNoise(noise);
    } else if (data.type === "reset" && model) {
      model = new InstrumentBrain(model.meta, model.weights);
      model.setNoise(noise);
      emaMs = 0;
      tick = 0;
    }
  } catch (error) {
    running = false;
    loading = false;
    clearTimeout(loopTimer);
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
