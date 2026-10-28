export type StimulusMode = "target" | "loom" | "wind";
export type SourceKind = StimulusMode | "sound" | "smell" | "touch" | "taste";
export interface WorldSource {
  id: string;
  kind: SourceKind;
  x: number;
  z: number;
  strength: number;
  visible: boolean;
  enabled: boolean;
  pulseAt: number;
}
export interface WorldPose {
  x: number;
  z: number;
  heading: number;
  escapeUntil?: number;
  escapeLatched?: boolean;
  escapeCharge?: number;
}
export interface SensoryInput {
  left: number;
  right: number;
  looming: number;
  windLeft: number;
  windRight: number;
  soundLeft?: number;
  soundRight?: number;
  smellLeft?: number;
  smellRight?: number;
  touch?: number;
  taste?: number;
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
  hearing: number;
  smell: number;
  smellLeft: number;
  smellRight: number;
  contact: number;
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
  hearing: 0,
  smell: 0,
  smellLeft: 0,
  smellRight: 0,
  contact: 0,
};
export interface WorldState {
  x: number;
  z: number;
  heading: number;
  running: boolean;
  trails: boolean;
  grid: boolean;
  sources: WorldSource[];
  selectedId: string | null;
  placing: SourceKind | null;
  simTime: number;
  reset: number;
  overhead: boolean;
  isolated: boolean;
  input: SensoryInput;
}
