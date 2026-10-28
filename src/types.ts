export type StimulusMode = "target" | "loom" | "wind";
export interface SensoryInput {
  left: number;
  right: number;
  looming: number;
  windLeft: number;
  windRight: number;
  enabled: boolean;
}
export interface NeuralState {
  left: number;
  right: number;
  escape: number;
  wing: number;
  sensory: number;
  windLeft: number;
  windRight: number;
  fired: number;
  stepMs: number;
  simTime: number;
  dt: number;
}
export const EMPTY_NEURAL: NeuralState = {
  left: 0,
  right: 0,
  escape: 0,
  wing: 0,
  sensory: 0,
  windLeft: 0,
  windRight: 0,
  fired: 0,
  stepMs: 0,
  simTime: 0,
  dt: 0.02,
};
export interface WorldState {
  x: number;
  z: number;
  heading: number;
  targetX: number;
  targetZ: number;
  running: boolean;
  trails: boolean;
  grid: boolean;
  mode: StimulusMode;
  intensity: number;
  pulse: number;
  reset: number;
  overhead: boolean;
  isolated: boolean;
  input: SensoryInput;
}
