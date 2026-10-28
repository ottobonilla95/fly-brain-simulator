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

Each neuron uses upstream leaky integrate-and-fire dynamics. Per step, its voltage decays, receives weighted input from the previous step's spikes, tonic drive, random background input, and our injected sensory drive. At threshold 1 it fires and resets. The time step is taken from the asset metadata (20 ms). The complete network is stepped in a dedicated worker, once per 20 ms wall-clock budget or slower when necessary. The UI reports measured step execution time and simulation time separately.

We do not train the network or a readout. Input strengths and sound mappings are manually chosen. The noise slider multiplies the exported model's noise amplitude, retaining its other parameters. Reset uses seed 64; identical sensory histories and noise settings on the same engine are reproducible. Live interaction is not saved as a complete replay.

## Sensory adapters

- **Target:** The scene computes bearing relative to specimen heading. Bearings within ±153° drive LC10a; left/right stimulation is split linearly within ±0.35 radians. Input is the intensity slider times that side's fraction. This broad field of view is an interface choice, not a calibrated eye model.
- **Loom:** A user-triggered 450 ms pulse drives bilateral LC4/LPLC2 at the selected intensity. Expanding the visual marker illustrates the pulse. This is an explicit stimulus button, not automatic image-based looming detection.
- **Wind:** Marker bearing determines stimulation of the Johnston's-organ neuron types used in the upstream drone example. Both bearing and intensity are calculated values, not a physical fluid simulation.
- **Isolation:** Disables all external stimulation. Intrinsic dynamics and background noise continue.

The visual front end bypasses the photoreceptors and lamina. In the upstream simplified model, that early visual route does not successfully relay the signal. The network receives numeric drive, never a rendered image or an image embedding.

## Outputs

Rates are exponentially smoothed (160 ms time constant) and normalized by population size, in Hz per neuron.

- Steering: DNa02, DNg111, DNae002, split left/right, following upstream Pong. Their difference turns the specimen and pans a harmonic voice.
- Escape: DNp01. Its rate raises the specimen; upward threshold crossings at 5 Hz trigger a synthesized falling-pitch drum, with a 300 ms minimum retrigger interval.
- Wings: the explicit wing motor neuron list in upstream `flytalk.py`. Population activity controls the amplitude and small pitch changes of a designed tone.
- Wind outputs: DNg05_a, DNg06_a, DNg29, DNge016. Their left/right difference contributes to turning.

The specimen's constant cruise, wall deflection, wing-flap visualization and geometrical constraints are authored body behavior. They are not a fly biomechanics simulation. A 3D model is used for presentation; movement is primarily in the horizontal plane with an escape-controlled altitude offset.

The brain illustration is a **population schematic**, not recorded neuron positions or individual live neurons. Channel traces use real measured population rates. The output oscilloscope reads the actual synthesized audio analyser. Rates remain visible when paused, while movement and sound stop.

## Scientific limits

Point neurons, simplified transmitter signs, globally chosen parameters, omitted graded responses, and quantized connectivity do not recreate all biological functions. There is no claim of consciousness, genuine musical intention, learning, or a complete functioning animal. Selected pathway responses are useful checks, not validation of the complete nervous system against real recordings.
