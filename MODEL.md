# Model and interpretation

## Provenance

Upstream source: https://github.com/alextitonis/fly.ai/tree/59ff122b39e0f0b51bea9131324f4350c9a57318

Copied with its MIT license:

- `pong/lib/connectome.ts` → `src/brain/connectome.ts`
- `pong/lib/brainload.ts` → `src/brain/upstream-loader.ts`
- `pong/lib/rng.ts` → `src/brain/rng.ts`
- `world/public/connectome/` → `public/connectome/`

The browser export contains 166,700 neurons and 25,088,107 connections. It uses 8-bit logarithmically quantized weight codes. The upstream manifest reports mean relative weight error 0.023, maximum 0.0471. We reuse this export as supplied and do not claim numerical identity with the upstream full-precision Python simulation.

## Neural dynamics

Each neuron uses upstream leaky integrate-and-fire dynamics. Per step, its voltage decays, receives weighted input from the previous step's spikes, tonic drive, random background input, and our injected sensory drive. At threshold 1 it fires and resets. The time step is taken from the asset metadata (20 ms). The complete network is stepped in a dedicated worker with a fixed 20 ms neural step. Playback speed changes how many fixed steps run per wall-clock second. The worker updates body position and sensory encodings every neural step, so world movement, contact and stimulus timing use the same simulation clock. Work is batched with short yields; requested speed can exceed available CPU throughput. The UI reports achieved speed separately.

We do not train the network or a readout. Input strengths and sound mappings are manually chosen. The noise slider multiplies the exported model's noise amplitude, retaining its other parameters. Reset uses seed 64; identical sensory histories and noise settings on the same engine are reproducible. Live interaction is not saved as a complete replay.

## Sensory adapters

Several placed sources may be active at once. Each has a position, strength, on/off switch and independent visibility flag. Contributions sum per channel and are capped at 1. These are authored numerical encoders, not physical models of light, acoustics or fluid flow.

- **Vision:** Visible objects other than threats drive LC10a on the side of their bearing within ±153°. The side split interpolates within ±0.35 radians. Strength attenuates with horizontal distance as `strength / (1 + (distance / 2.5)^2)`.
- **Loom:** Visible threats stimulate bilateral LC4/LPLC2 when their angular size grows (estimated from relative distance between neural steps), or when within 1.6 units in the frontal hemisphere. This follows the upstream drone’s angular-growth and near-threat encoder pattern, with chosen gains and proximity thresholds. Threats do not also stimulate target-chasing LC10a. The manual 450 ms pulse remains available; timing and growth use simulation time. No rendered image is processed.
- **Wind:** Source direction splits stimulation of the upstream drone example’s wind-sensitive Johnston’s-organ neurons. Wind uses the same distance falloff.
- **Sound:** Source direction and distance drive JO-A/JO-B hearing populations. A speaker is a neural stimulus source; the existing instrument soundtrack is a separate audio output.
- **Smell:** Food sources stimulate ORN_DM1/ORN_DM2, with directional split and distance falloff, including behind the fly. The supplied export already has `sensory_input: false`, avoiding the upstream sensory-neuron feedback problem.
- **Touch / taste:** Contact within 0.6 horizontal world units drives BM_InOm or claw_tpGRN/dorsal_tpGRN/BM_Taste respectively. This is proximity-based contact, not a physics collision solver.
- **Isolation:** Disables every external stimulation channel. Intrinsic dynamics and background noise continue.

Hearing, smell and contact readouts measure actual sensory-population firing rates. Food seeking is an explicitly added motor decoder using left/right smell-neuron firing rates, not evidence that innate food-seeking emerges through the original motor circuits. Sound and contact still have no added locomotor policy; their neural responses may not produce obvious movement.

The visual front end bypasses the photoreceptors and lamina. In the upstream simplified model, that early visual route does not successfully relay the signal. The network receives numeric drive, never a rendered image or an image embedding.

## Outputs

Rates are exponentially smoothed (160 ms time constant) and normalized by population size, in Hz per neuron.

- Steering: DNa02, DNg111, DNae002, split left/right, following upstream Pong. Their difference turns the specimen and pans a harmonic voice.
- Escape: DNp01. Its rate raises the specimen. Activity at or above 5 Hz for 60 ms reverses heading and adds 1.8 world units/s for a 650 ms dash, using a latch that rearms below 2 Hz. This is an authored motor interpretation driven by the escape circuit; it does not read the threat’s coordinates. The same 5 Hz crossing triggers percussion with a 300 ms minimum retrigger interval.
- Food seeking: normalized left-minus-right ORN_DM1/DM2 firing rates add steering, with a confidence gate above resting sensory activity. A strong olfactory signal reduces visual steering to 25% so a competing visual target does not pull the fly away from food. It reads measured neuron activity, not object coordinates or injected strengths. Escape bursts temporarily suppress food-seeking steering. This is an added decoder, not an upstream behavior or trained readout.
- Wings: the explicit wing motor neuron list in upstream `flytalk.py`. Population activity controls the amplitude and small pitch changes of a designed tone.
- Wind outputs: DNg05_a, DNg06_a, DNg29, DNge016. Their left/right difference contributes to turning.

The specimen's constant cruise, wall deflection, wing-flap visualization and geometrical constraints are authored body behavior. They are not a fly biomechanics simulation. A 3D model is used for presentation; movement is primarily in the horizontal plane with an escape-controlled altitude offset.

The brain illustration is a **population schematic**, not recorded neuron positions or individual live neurons. Channel traces use real measured population rates. The output oscilloscope reads the actual synthesized audio analyser. Rates remain visible when paused, while movement and sound stop.

## Scientific limits

Point neurons, simplified transmitter signs, globally chosen parameters, omitted graded responses, and quantized connectivity do not recreate all biological functions. There is no claim of consciousness, genuine musical intention, learning, or a complete functioning animal. Selected pathway responses are useful checks, not validation of the complete nervous system against real recordings.
