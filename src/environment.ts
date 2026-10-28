import type {
  NeuralState,
  SensoryInput,
  SourceKind,
  WorldPose,
  WorldSource,
} from "./types";

export const SOURCE_INFO: Record<
  SourceKind,
  { label: string; color: string; glyph: string; description: string }
> = {
  target: {
    label: "Visual target",
    color: "#f2b56b",
    glyph: "◉",
    description:
      "A visible object stimulates target-tracking neurons on the side where the fly sees it.",
  },
  loom: {
    label: "Approaching threat",
    color: "#f18176",
    glyph: "!",
    description:
      "The fly detects this visible threat as it grows in view or comes close ahead. Escape-neuron activity triggers a turn and dash. You can also send a manual pulse.",
  },
  sound: {
    label: "Sound source",
    color: "#b8a4ec",
    glyph: "♪",
    description:
      "A speaker stimulates hearing neurons. Strength fades with distance; this is sensory input, separate from the instrument soundtrack.",
  },
  smell: {
    label: "Food smell",
    color: "#b8dc89",
    glyph: "❋",
    description:
      "Food odour fades with distance and reaches the fly from behind. A designed food-seeking decoder turns toward the side with stronger smell-neuron activity.",
  },
  wind: {
    label: "Wind source",
    color: "#8fcad5",
    glyph: "≈",
    description:
      "A fan stimulates wind-sensitive antenna neurons, split by direction and distance.",
  },
  touch: {
    label: "Touch object",
    color: "#e8b4d5",
    glyph: "✦",
    description:
      "Stimulates touch neurons only when the fly comes within 0.6 world units.",
  },
  taste: {
    label: "Taste source",
    color: "#e5d17d",
    glyph: "●",
    description:
      "Stimulates taste neurons when the fly comes within 0.6 world units.",
  },
};
export const INITIAL_POSE: WorldPose = {
  x: -1,
  z: 0.6,
  heading: 1.6,
  escapeUntil: 0,
  escapeLatched: false,
  escapeCharge: 0,
};
export type SensoryHistory = Map<string, { size: number; time: number }>;
export const initialSources = (): WorldSource[] => [
  {
    id: "target-1",
    kind: "target",
    x: 2,
    z: -1,
    strength: 0.85,
    visible: true,
    enabled: true,
    pulseAt: -1,
  },
];

/** Numerical sensory adapter, evaluated at every neural step in the worker. */
export function encodeSources(
  sources: WorldSource[],
  pose: WorldPose,
  time: number,
  isolated = false,
  history?: SensoryHistory,
): SensoryInput {
  const input: SensoryInput = {
    left: 0,
    right: 0,
    looming: 0,
    windLeft: 0,
    windRight: 0,
    soundLeft: 0,
    soundRight: 0,
    smellLeft: 0,
    smellRight: 0,
    touch: 0,
    taste: 0,
    enabled: !isolated,
  };
  if (isolated) {
    history?.clear();
    return input;
  }
  if (history) {
    const ids = new Set(sources.map((s) => s.id));
    for (const id of history.keys()) if (!ids.has(id)) history.delete(id);
  }
  for (const s of sources) {
    if (!s.enabled) continue;
    const distance = Math.hypot(s.x - pose.x, s.z - pose.z);
    const bearing = Math.atan2(s.x - pose.x, s.z - pose.z) - pose.heading;
    const angle = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    const left = Math.max(0, Math.min(1, 0.5 + angle / 0.7));
    const near = s.strength / (1 + (distance / 2.5) ** 2);
    const seen = Math.abs(angle) < Math.PI * 0.85;
    if (s.visible && seen && s.kind !== "loom") {
      input.left += near * left;
      input.right += near * (1 - left);
    }
    if (s.kind === "loom") {
      const size = 2 * Math.atan2(0.35, Math.max(0.15, distance));
      const previous = history?.get(s.id);
      const growth =
        previous && time > previous.time
          ? Math.max(0, (size - previous.size) / (time - previous.time))
          : 0;
      history?.set(s.id, { size, time });
      const manual =
        s.pulseAt >= 0 && time >= s.pulseAt && time - s.pulseAt < 0.45;
      const closeAhead = distance < 1.6 && Math.abs(angle) < Math.PI / 2;
      // Feature encoding follows the upstream drone: angular growth plus close frontal threats.
      if (s.visible && seen)
        input.looming += Math.max(
          manual ? near : 0,
          s.strength * Math.max(Math.min(1, growth * 8), closeAhead ? 0.8 : 0),
        );
    }
    if (s.kind === "wind") {
      input.windLeft += near * left;
      input.windRight += near * (1 - left);
    }
    if (s.kind === "sound") {
      input.soundLeft! += near * left;
      input.soundRight! += near * (1 - left);
    }
    if (s.kind === "smell") {
      input.smellLeft! += near * left;
      input.smellRight! += near * (1 - left);
    }
    if (distance < 0.6 && s.kind === "touch") input.touch! += s.strength;
    if (distance < 0.6 && s.kind === "taste") input.taste! += s.strength;
  }
  for (const key of Object.keys(input) as (keyof SensoryInput)[]) {
    if (key !== "enabled")
      (input[key] as number) = Math.min(1, input[key] as number);
  }
  return input;
}

/** Body controller advances by neural dt, never by render/wall time. */
export function advancePose(pose: WorldPose, n: NeuralState): WorldPose {
  const escapeCharge = n.escape >= 5 ? (pose.escapeCharge ?? 0) + n.dt : 0;
  const startled = escapeCharge >= 0.06 && !pose.escapeLatched;
  const escapeUntil = startled ? n.simTime + 0.65 : (pose.escapeUntil ?? 0);
  const escapeLatched = startled || (!!pose.escapeLatched && n.escape > 2);
  const smellTotal = n.smellLeft + n.smellRight;
  const smellConfidence = Math.max(0, Math.min(1, (smellTotal - 3) / 12));
  // This is an added olfactory motor readout, not innate steering inferred from wiring.
  // It reads receptor activity, never source coordinates or encoded input strengths.
  const smellTurn =
    ((n.smellLeft - n.smellRight) / Math.max(5, smellTotal)) *
    smellConfidence *
    1.8;
  const visualTurn = (n.left - n.right) * 0.16 * (1 - 0.75 * smellConfidence);
  const heading =
    pose.heading +
    (startled ? Math.PI : 0) +
    Math.max(
      -2,
      Math.min(
        2,
        visualTurn +
          (n.windLeft - n.windRight) * 0.09 +
          (n.simTime < escapeUntil ? 0 : smellTurn),
      ),
    ) *
      n.dt;
  // A chosen motor decoder: an escape onset reverses heading and gives a brief dash.
  // It reads neural activity only; it does not look up a threat's position.
  const speed =
    0.24 + Math.min(0.35, n.wing * 0.015) + (n.simTime < escapeUntil ? 1.8 : 0);
  const next = {
    x: pose.x + Math.sin(heading) * speed * n.dt,
    z: pose.z + Math.cos(heading) * speed * n.dt,
    heading,
    escapeUntil,
    escapeLatched,
    escapeCharge,
  };
  const radius = Math.hypot(next.x, next.z);
  if (radius > 4.65) {
    next.x *= 4.65 / radius;
    next.z *= 4.65 / radius;
    next.heading += Math.PI * 0.8;
  }
  return next;
}
