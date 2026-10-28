# Fly Brain Simulator

A local browser instrument: interact with a 3D fly chamber and hear selected neural populations from a connectome-based simulation become sound.

## Run

Requires Node.js 22.12+ or a supported newer version.

```sh
npm install
npm run dev
```

Open the Local URL Vite prints. Press **Start instrument** to load the bundled 58 MB connectome and enable audio. The simulation runs on your device in a Web Worker. No account, API key, backend or model training is required. Fonts and brain data are served locally.

## Play

- Choose a source under **World sources**, then click inside the chamber to place it. Add several sources at once: visual targets, approaching threats, sound, food smell, wind, touch and taste.
- Click a placed object or its list entry to select it. Drag objects or use the arrow keys to move the selected source. Right-drag to orbit; scroll to zoom.
- Adjust each source’s strength, enable/disable it, remove it, or turn **Visible to fly** on to combine its primary sense with vision. All editor markers remain visible to you.
- Approaching threats have a **Send looming pulse** button (also Enter). Touch and taste activate within 0.6 world units; sound, smell and wind fade with distance.
- **0.5× / 1× / 2× / 5×** controls neural and world simulation speed together. The footer shows achieved speed, which may be lower than requested on slower hardware.
- **T / L / W**: pick a visual target, threat or wind source for placement. **Escape** cancels placement; **Delete** removes the selected source.
- **Space**: pause/resume. Buttons and sliders retain their normal keyboard behavior.
- Use sensory disconnection and the background-noise slider to compare evoked and spontaneous activity.
- Mix steering, wing and escape sound channels; enable/mute sound and adjust master volume.
- **Record audio** downloads a WebM/Opus or M4A performance, depending on browser support. Stop recording to save it. Recording captures synthesized output, not microphone audio.
- **Export activity** saves JSON containing the latest 6,000 telemetry samples, simulation timestamps and current settings. This is an activity log, not a complete replay file.
- Reset returns neural state to seed 64 and resets specimen position and time.

## What is simulated

The application loads the complete upstream browser export: **166,700 neurons and 25,088,107 connections**, derived from MaleCNS v1.0. It uses the upstream TypeScript leaky integrate-and-fire engine, including its quantized synaptic weights. It does not replace the brain with a small random network or scripted telemetry.

The scene supplies numerical sensory features, not camera images. Musical tuning, movement decoding, constant cruise and wall handling are human-designed interfaces. This is a simplified simulation using measured connectivity, **not a complete emulation of an animal**. See [MODEL.md](MODEL.md) for the exact boundaries.

## Verification

```sh
npm run check:environment
npm run check:brain
npm run build
npm run preview -- --port 5174 --strictPort
# In another terminal:
npm run check:worker
```

The environment check covers direction, distance, visibility, contact, combined inputs and simulation-time pulse expiry. The brain check loads bundled data and measures tracking, escape, wind, hearing, smell, touch, taste and isolation. The worker check exercises the compiled worker, streamed HTTP loader, pause/resume, reset, combined sensory sources, body movement and measured playback speeds. Node worker threads supply a small messaging shim for that integration test; it does not validate browser rendering or audio playback.

## Source and attribution

Neural engine, loader, RNG and connectome export: [alextitonis/fly.ai](https://github.com/alextitonis/fly.ai), pinned to commit `59ff122b39e0f0b51bea9131324f4350c9a57318`, MIT license. The upstream license is preserved at `licenses/fly-ai-MIT.txt`. Population choices follow upstream Pong, drone and flytalk examples. Font licenses are in `licenses/`.

App stack: TypeScript, React, Three.js, Web Audio API, Vite. Assets are bundled in `public/connectome/` and copied to the production build; allow roughly 58 MB for the initial brain download and additional runtime memory for decompression and connectivity arrays.
