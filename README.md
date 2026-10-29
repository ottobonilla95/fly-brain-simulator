# What does a fly’s brain sound like?

**Fly Brain Simulator** turns a mapped fly brain into an instrument. Build its world, watch it react, and hear neural activity become sound.

[![166,700 neurons](docs/images/badge-neurons.svg)](MODEL.md)
[![25.1 million connections](docs/images/badge-connections.svg)](MODEL.md)
[![7 sensory source types](docs/images/badge-sources.svg)](docs/README.md#play)
[![Runs in your browser](docs/images/badge-runs.svg)](#try-it)

![The charcoal 3D chamber with a fly, visual target, food smell and sound source, alongside placement and speed controls](docs/images/chamber.jpg)

## Change the world. Hear what happens.

- **Give it something to sense.** Place light targets, threats, sound, food smells, wind, touch or taste sources.
- **Watch the response.** Move objects, follow live neural activity, and slow down or speed up time.
- **Make a little noise.** Mix steering, wing and escape signals into sound. Record audio or export activity as JSON.

![Live steering, wing motor and escape traces beside the audio mixer](docs/images/neural-sound.jpg)

## Try it

With Node.js **22.12+** or a supported newer version:

```sh
git clone https://github.com/ottobonilla95/fly-brain-simulator.git
cd fly-brain-simulator
npm install
npm run dev
```

Open the local URL, press **Start instrument**, then choose a source and click the chamber. Headphones recommended. The bundled brain loads about **58 MB**; everything runs locally, with no account or API key.

## From world to sound

```mermaid
flowchart LR
    A["Your world<br/>Sight · sound · smell · wind · contact"] --> B["Simulated fly network<br/>166,700 neurons"]
    B --> C["Designed mappings<br/>Movement · sound · activity"]
    C -->|Movement changes sensory input| A
```

Measured wiring, simplified neurons, designed movement and music. Food seeking uses an added decoder. [See exactly what is simulated →](MODEL.md)

**Keep exploring:** [Controls & setup](docs/README.md) · [Model & limits](MODEL.md) · [Verification](docs/README.md#verification)

Built on [alextitonis/fly.ai](https://github.com/alextitonis/fly.ai). [Upstream MIT license](licenses/fly-ai-MIT.txt).
