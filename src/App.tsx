import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  CircleStop,
  Expand,
  Eye,
  Grid2X2,
  Headphones,
  Leaf,
  MousePointer2,
  MoveUpRight,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { NeuralAudio } from "./audio";
import { EMPTY_NEURAL } from "./types";
import { initialSources, INITIAL_POSE, SOURCE_INFO } from "./environment";
import SourcePanel from "./SourcePanel";
import type { NeuralState, SourceKind, WorldSource, WorldState } from "./types";
const Chamber = lazy(() => import("./Chamber"));

const palette = ["#d0edaa", "#bfb5e4", "#e5aa83"];
const brainDots = Array.from({ length: 136 }, (_, i) => {
  const a = i * 2.39996,
    r = Math.sqrt(((i * 47) % 137) / 137);
  const side = i % 2 === 0 ? -1 : 1;
  return {
    x: 91 + side * 23 + Math.cos(a) * r * 34,
    y: 58 + Math.sin(a) * r * 39,
    group: i % 4,
  };
});
function seconds(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function FlyMark() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 15c-3-12-14-13-14-5s11 13 14 13M20 15c3-12 14-13 14-5S23 23 20 23M20 12v23M13 29l7-6 7 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Trace({ values, color }: { values: number[]; color: string }) {
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * 240},${38 - Math.min(1, v / 20) * 31}`,
    )
    .join(" ");
  return (
    <svg
      className="trace"
      viewBox="0 0 240 44"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 38H240M0 20H240" stroke="currentColor" strokeOpacity=".07" />
      <polyline
        points={points || "0,38 240,38"}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function Scope({ audio, running }: { audio: NeuralAudio; running: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext("2d")!;
    const samples = new Uint8Array(2048);
    const observer = new ResizeObserver(() => {
      el.width = el.clientWidth * window.devicePixelRatio;
      el.height = el.clientHeight * window.devicePixelRatio;
    });
    observer.observe(el);
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const w = el.width,
        h = el.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#ffffff09";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += w / 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      audio.waveform(samples);
      ctx.strokeStyle = running && audio.enabled ? "#d0edaa" : "#57705e";
      ctx.lineWidth = 1.5 * window.devicePixelRatio;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 4) {
        const x = (i / (samples.length - 1)) * w,
          y = h / 2 + ((samples[i] - 128) / 128) * h * 0.43;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [audio, running]);
  return (
    <canvas
      ref={canvas}
      className="scope-canvas"
      aria-label="Live synthesized audio waveform"
    />
  );
}
function BrainMap({ n }: { n: NeuralState }) {
  const rates = [n.sensory, n.left + n.right, n.escape, n.wing];
  return (
    <svg
      className="brain-map"
      viewBox="0 0 184 120"
      role="img"
      aria-label="Schematic of population activity, not individual neuron positions"
    >
      <path
        d="M89 22C62-5 13 24 24 65C26 91 55 105 83 88M95 22C122-5 171 24 160 65C158 91 129 105 101 88M88 75L87 109M96 75L97 109"
        fill="none"
        stroke="#6b8574"
        strokeOpacity=".22"
      />
      {brainDots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={rates[d.group] > 8 ? 1.7 : 1.15}
          fill={palette[d.group % 3]}
          opacity={0.18 + Math.min(1, rates[d.group] / 20) * 0.8}
        />
      ))}
      <path d="M92 19V102" stroke="#50634f" strokeDasharray="2 5" />
    </svg>
  );
}
export default function App() {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [progress, setProgress] = useState("Loading connectome…");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false),
    [sound, setSound] = useState(false);
  const [sources, setSources] = useState(initialSources);
  const [selectedId, setSelectedId] = useState<string | null>("target-1");
  const [placing, setPlacing] = useState<SourceKind | null>(null);
  const [speed, setSpeed] = useState(1);
  const [actualSpeed, setActualSpeed] = useState(0);
  const [volume, setVolume] = useState(0.5),
    [mix, setMix] = useState([0.65, 0.65, 0.6]),
    [noise, setNoise] = useState(1);
  const [trails, setTrails] = useState(true),
    [grid, setGrid] = useState(true),
    [overhead, setOverhead] = useState(false),
    [isolated, setIsolated] = useState(false);
  const [n, setN] = useState<NeuralState>(EMPTY_NEURAL),
    [history, setHistory] = useState<number[][]>([[], [], []]);
  const [dialog, setDialog] = useState(false),
    [recording, setRecording] = useState(false),
    [recordTime, setRecordTime] = useState(0);
  const [notice, setNotice] = useState(""),
    [sceneError, setSceneError] = useState("");
  const worker = useRef<Worker | null>(null),
    wantRunning = useRef(false),
    neural = useRef<NeuralState>({ ...EMPTY_NEURAL });
  const audioRef = useRef<NeuralAudio | null>(null);
  if (!audioRef.current) audioRef.current = new NeuralAudio();
  const audio = audioRef.current;
  const samples = useRef<
    { t: number; left: number; right: number; escape: number; wing: number }[]
  >([]);
  const world = useRef<WorldState>({
    ...INITIAL_POSE,
    running: false,
    trails: true,
    grid: true,
    sources,
    selectedId: "target-1",
    placing: null,
    simTime: 0,
    reset: 0,
    overhead: false,
    isolated: false,
    input: {
      left: 0,
      right: 0,
      looming: 0,
      windLeft: 0,
      windRight: 0,
      enabled: true,
    },
  });
  const chamber = useRef<HTMLDivElement>(null),
    lastUi = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL("./brain/brain.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.type === "progress") setProgress(data.text);
      if (data.type === "ready") {
        setPhase("ready");
        setRunning(wantRunning.current);
        world.current.running = wantRunning.current;
        w.postMessage({ type: "running", value: wantRunning.current });
      }
      if (data.type === "state") {
        const state: NeuralState = data.state;
        neural.current = state;
        world.current.simTime = state.simTime;
        if (data.pose) Object.assign(world.current, data.pose);
        if (data.input) world.current.input = data.input;
        audio.update(state, world.current.running);
        samples.current.push({
          t: state.simTime,
          left: state.left,
          right: state.right,
          escape: state.escape,
          wing: state.wing,
        });
        if (samples.current.length > 6000) samples.current.shift();
        if (performance.now() - lastUi.current > 100) {
          setN(state);
          setActualSpeed(data.actualSpeed ?? 0);
          setHistory((prev) =>
            [state.left + state.right, state.wing, state.escape].map((v, i) => [
              ...prev[i].slice(-79),
              v,
            ]),
          );
          lastUi.current = performance.now();
        }
      }
      if (data.type === "error") {
        setError(data.message);
        setPhase("error");
        setRunning(false);
        world.current.running = false;
        audio.update(neural.current, false);
      }
    };
    w.onerror = (event) => {
      setError(
        event.message ||
          "The simulation worker failed. Reload the page to retry.",
      );
      setPhase("error");
      setRunning(false);
      world.current.running = false;
      audio.update(neural.current, false);
    };
    return () => {
      w.terminate();
      audio.dispose();
    };
  }, [audio]);
  useEffect(() => {
    world.current.running = running;
    audio.update(neural.current, running);
  }, [running, audio]);
  useEffect(() => {
    audio.enabled = sound;
    audio.volume = volume;
    audio.mix = mix;
    audio.update(neural.current, running);
  }, [sound, volume, mix, running, audio]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordTime((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    world.current.sources = sources;
    world.current.isolated = isolated;
    worker.current?.postMessage({
      type: "environment",
      value: { sources, isolated },
    });
  }, [sources, isolated]);
  useEffect(() => {
    worker.current?.postMessage({ type: "speed", value: speed });
  }, [speed]);
  const selectSource = useCallback((id: string) => {
    world.current.selectedId = id;
    world.current.placing = null;
    setSelectedId(id);
    setPlacing(null);
  }, []);
  const chooseSource = useCallback((kind: SourceKind | null) => {
    world.current.placing = kind;
    setPlacing(kind);
    if (kind)
      chamber.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const editSource = useCallback((id: string, patch: Partial<WorldSource>) => {
    setSources((prev) =>
      prev.map((source) =>
        source.id === id
          ? { ...source, ...patch, id: source.id, kind: source.kind }
          : source,
      ),
    );
  }, []);
  const placeSource = useCallback(
    (kind: SourceKind, x: number, z: number) => {
      const id = crypto.randomUUID();
      setSources((prev) => [
        ...prev,
        {
          id,
          kind,
          x,
          z,
          strength: 0.85,
          visible: kind === "target" || kind === "loom",
          enabled: true,
          pulseAt: -1,
        },
      ]);
      selectSource(id);
    },
    [selectSource],
  );
  const moveSource = useCallback(
    (id: string, x: number, z: number) => editSource(id, { x, z }),
    [editSource],
  );
  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((source) => source.id !== id));
    world.current.selectedId = null;
    setSelectedId(null);
  }, []);
  const onSceneError = useCallback(
    (message: string) => setSceneError(message),
    [],
  );
  const toggleRun = useCallback(() => {
    if (phase === "loading" || phase === "error") return;
    if (phase === "idle") {
      wantRunning.current = true;
      setPhase("loading");
      worker.current?.postMessage({
        type: "load",
        base: new URL(
          `${import.meta.env.BASE_URL}connectome/`,
          window.location.href,
        ).href,
      });
      void audio
        .start()
        .then(() => setSound(true))
        .catch(() =>
          setNotice("Audio could not start. Use Enable sound to retry."),
        );
    } else {
      const value = !world.current.running;
      wantRunning.current = value;
      world.current.running = value;
      setRunning(value);
      worker.current?.postMessage({ type: "running", value });
    }
  }, [phase, audio]);
  const pulse = useCallback(() => {
    const id = world.current.selectedId;
    if (id) editSource(id, { pulseAt: world.current.simTime });
  }, [editSource]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,button,a,select,textarea") ||
        dialog
      ) {
        if (e.key === "Escape") setDialog(false);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggleRun();
      }
      if (e.key === "Escape") chooseSource(null);
      if (e.key.toLowerCase() === "t") chooseSource("target");
      if (e.key.toLowerCase() === "l") chooseSource("loom");
      if (e.key.toLowerCase() === "w") chooseSource("wind");
      const selected = world.current.sources.find(
        (s) => s.id === world.current.selectedId,
      );
      if (e.key === "Enter" && selected?.kind === "loom") pulse();
      if (e.key === "Delete" && selected) removeSource(selected.id);
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-0.3, 0],
        ArrowRight: [0.3, 0],
        ArrowUp: [0, -0.3],
        ArrowDown: [0, 0.3],
      };
      if (arrows[e.key] && selected) {
        e.preventDefault();
        const [x, z] = arrows[e.key];
        const nx = selected.x + x,
          nz = selected.z + z;
        if (Math.hypot(nx, nz) < 4.8) moveSource(selected.id, nx, nz);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleRun, chooseSource, moveSource, removeSource, pulse, dialog]);
  const toggleSound = async () => {
    if (!sound) {
      try {
        await audio.start();
        setSound(true);
      } catch {
        setNotice("Audio could not start in this browser.");
      }
    } else setSound(false);
  };
  const reset = () => {
    world.current.reset++;
    Object.assign(world.current, INITIAL_POSE);
    world.current.simTime = 0;
    setSources((prev) => prev.map((s) => ({ ...s, pulseAt: -1 })));
    setActualSpeed(0);
    neural.current = { ...EMPTY_NEURAL };
    setN({ ...EMPTY_NEURAL });
    setHistory([[], [], []]);
    samples.current = [];
    worker.current?.postMessage({ type: "reset" });
    setNotice("Brain state and chamber reset to seed 64.");
  };
  const record = async () => {
    if (recording) {
      audio.stopRecording();
      setRecording(false);
      return;
    }
    if (!running) {
      setNotice("Start the simulation before recording.");
      return;
    }
    try {
      await audio.start();
      setSound(true);
      audio.record((blob, extension) => {
        download(blob, `fly-brain-performance-${Date.now()}.${extension}`);
        setNotice("Your audio recording has been downloaded.");
      });
      setRecordTime(0);
      setRecording(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  };
  const exportSession = () => {
    if (!samples.current.length) {
      setNotice("Run the simulation to collect activity first.");
      return;
    }
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "fly-brain-simulator/session-v1",
              upstream: "59ff122b39e0f0b51bea9131324f4350c9a57318",
              model: "MaleCNS v1.0 · simplified LIF",
              seed: 64,
              settings: { sources, speed, noise, isolated, volume, mix },
              samples: samples.current,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `fly-brain-session-${Date.now()}.json`,
    );
    setNotice("Neural activity and current settings exported as JSON.");
  };
  const fullScreen = () => {
    if (!document.fullscreenElement)
      void chamber.current
        ?.requestFullscreen()
        .catch(() => setNotice("Fullscreen is unavailable in this browser."));
    else void document.exitFullscreen();
  };

  const status =
    phase === "loading"
      ? "Loading brain"
      : phase === "error"
        ? "Simulation error"
        : running
          ? "Simulation live"
          : phase === "ready"
            ? "Paused"
            : "Ready to initialize";
  return (
    <>
      <header className="topbar">
        <a className="brand" href="./" aria-label="Fly Brain Simulator home">
          <span className="brand-icon">
            <FlyMark />
          </span>
          <span>
            fly brain<span className="brand-light"> / simulator</span>
          </span>
          <span className="version">LAB 01</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={!dialog ? "nav-active" : ""}
            onClick={() => setDialog(false)}
          >
            Instrument
          </button>
          <button onClick={() => setDialog(true)}>
            How it works <ArrowUpRight size={12} />
          </button>
        </nav>
        <a
          className="source-link"
          href="https://github.com/alextitonis/fly.ai"
          target="_blank"
          rel="noreferrer"
        >
          Built on fly.ai <ArrowUpRight size={13} />
        </a>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="little-cross">✳</span> AN EXPERIMENT IN NEURAL
              SOUND
            </div>
            <h1>
              The fly is the instrument<span>.</span>
            </h1>
            <p>A mapped nervous system. A small world. An unexpected sound.</p>
          </div>
          <div className="intro-note">
            <Headphones size={19} />
            <div>
              Best explored with headphones
              <span>Sound is generated on your device.</span>
            </div>
          </div>
        </section>
        <div className="workspace">
          <section
            className="chamber-panel"
            ref={chamber}
            aria-label="Interactive 3D chamber"
          >
            <div className="panel-top">
              <span className="panel-label">
                <span className={`status-dot ${running ? "live" : ""}`} />{" "}
                SPECIMEN 001 <span className="dim">/ D. melanogaster</span>
              </span>
              <div className="viewport-tools">
                <button
                  title="Toggle floor grid"
                  aria-label="Toggle floor grid"
                  aria-pressed={grid}
                  onClick={() => {
                    setGrid(!grid);
                    world.current.grid = !grid;
                  }}
                  className={grid ? "selected" : ""}
                >
                  <Grid2X2 size={15} />
                </button>
                <button
                  title="Toggle overhead view"
                  aria-label="Toggle overhead view"
                  aria-pressed={overhead}
                  className={overhead ? "selected" : ""}
                  onClick={() => {
                    setOverhead(!overhead);
                    world.current.overhead = !overhead;
                  }}
                >
                  <Orbit size={16} />
                </button>
                <button
                  title="Fullscreen chamber"
                  aria-label="Fullscreen chamber"
                  onClick={fullScreen}
                >
                  <Expand size={15} />
                </button>
              </div>
            </div>
            <div
              className="scene-area"
              tabIndex={0}
              aria-label="Chamber controls: click to place a source, drag sources to move, arrow keys move selected source, space pauses"
            >
              <Suspense
                fallback={
                  <div className="scene-loading">Preparing chamber…</div>
                }
              >
                <Chamber
                  world={world}
                  neural={neural}
                  onPlace={placeSource}
                  onSelect={selectSource}
                  onMove={moveSource}
                  onError={onSceneError}
                />
              </Suspense>
              <div className="scene-coordinate coord-tl">
                Y +<span>Z / X</span>
              </div>
              <div className="scene-coordinate coord-br">
                5.4 <span>WORLD UNITS</span>
              </div>
              <div className="specimen-tag">
                <span className="tag-line" />
                <span>
                  CONNECTOME 001<span>166,700 neurons</span>
                </span>
              </div>
              <div className="stimulus-tag" role="status">
                <span className="amber-dot" />{" "}
                {placing
                  ? `CLICK TO PLACE ${SOURCE_INFO[placing].label.toUpperCase()}`
                  : `${sources.length} SENSORY SOURCE${sources.length === 1 ? "" : "S"}`}
              </div>
              {phase === "idle" && (
                <div className="init-card">
                  <div className="init-icon">
                    <Activity size={18} />
                  </div>
                  <div>
                    <strong>A little wiring. A lot of possibility.</strong>
                    <p>Initialize the 58 MB connectome to begin.</p>
                  </div>
                  <button
                    onClick={toggleRun}
                    aria-label="Initialize connectome"
                  >
                    <ArrowUpRight size={20} />
                  </button>
                </div>
              )}
              {phase === "loading" && (
                <div className="init-card loading-card">
                  <span className="spinner" />
                  <div>
                    <strong>Connecting 166,700 neurons</strong>
                    <p aria-live="polite">{progress}</p>
                  </div>
                </div>
              )}
              {phase === "error" && (
                <div className="init-card error-card" role="alert">
                  <div>
                    <strong>Couldn’t initialize the brain</strong>
                    <p>{error}</p>
                  </div>
                  <button onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </div>
              )}
              {sceneError && (
                <div className="init-card error-card" role="alert">
                  <p>{sceneError}</p>
                </div>
              )}
            </div>
            <div className="scene-bottom">
              <span>
                <MousePointer2 size={13} /> Pick a source · click to place ·
                drag to move <span className="shortcut">↑ ↓ ← →</span>
              </span>
              <button
                className={trails ? "trail-on" : ""}
                aria-pressed={trails}
                onClick={() => {
                  setTrails(!trails);
                  world.current.trails = !trails;
                }}
              >
                <MoveUpRight size={14} /> Movement trail{" "}
                <span className="toggle-mini" />
              </button>
            </div>
            <div className="transport">
              <div className="play-group">
                <button
                  className="play-button"
                  onClick={toggleRun}
                  disabled={phase === "loading" || phase === "error"}
                >
                  {running ? (
                    <Pause size={15} fill="currentColor" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {phase === "loading"
                    ? "Initializing…"
                    : running
                      ? "Pause session"
                      : phase === "idle"
                        ? "Start instrument"
                        : "Resume session"}
                </button>
                <button
                  className="icon-button"
                  title="Reset brain and chamber"
                  aria-label="Reset brain and chamber"
                  disabled={phase !== "ready"}
                  onClick={reset}
                >
                  <RotateCcw size={16} />
                </button>
                <span className="transport-time">
                  {seconds(n.simTime)} <span>SIM TIME</span>
                </span>
              </div>
              <div className="transport-right">
                <div
                  className="speed-control"
                  role="group"
                  aria-label="Simulation speed"
                >
                  {[0.5, 1, 2, 5].map((value) => (
                    <button
                      key={value}
                      aria-label={`Simulation speed ${value}x`}
                      aria-pressed={speed === value}
                      className={speed === value ? "active" : ""}
                      onClick={() => setSpeed(value)}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
                <span className="transport-status">
                  <span className={`status-dot ${running ? "live" : ""}`} />
                  {status}
                </span>
                <button
                  className={`sound-button ${sound ? "sound-active" : ""}`}
                  onClick={toggleSound}
                  aria-pressed={sound}
                >
                  {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span>{sound ? "Sound on" : "Enable sound"}</span>
                </button>
              </div>
            </div>
          </section>
          <aside className="sidebar">
            <SourcePanel
              sources={sources}
              selectedId={selectedId}
              placing={placing}
              neural={n}
              onChoose={chooseSource}
              onSelect={selectSource}
              onEdit={editSource}
              onRemove={removeSource}
              onPulse={pulse}
            />
            <section className="activity-panel">
              <div className="section-heading">
                <h2>
                  <Activity size={14} /> Neural activity
                </h2>
                <span className={running ? "live-label" : ""}>
                  {running ? "LIVE" : "IDLE"}
                </span>
              </div>
              <div className="brain-visual">
                <BrainMap n={n} />
                <div className="brain-count">
                  <strong>{n.fired.toLocaleString()}</strong>
                  <span>spikes / step</span>
                  <small>Population schematic</small>
                </div>
              </div>
              <div className="rate-list">
                {[
                  {
                    label: "Steering",
                    cell: "DNa02 + 2",
                    value: (n.left + n.right) / 2,
                    color: palette[0],
                  },
                  {
                    label: "Wing motor",
                    cell: "WING MNs",
                    value: n.wing,
                    color: palette[1],
                  },
                  {
                    label: "Escape",
                    cell: "DNp01",
                    value: n.escape,
                    color: palette[2],
                  },
                ].map((row) => (
                  <div className="rate-row" key={row.label}>
                    <span
                      className="channel-dot"
                      style={{ background: row.color }}
                    />
                    <span>
                      {row.label}
                      <small>{row.cell}</small>
                    </span>
                    <div className="rate-meter">
                      <i
                        style={{
                          width: `${Math.min(100, (row.value / 30) * 100)}%`,
                          background: row.color,
                        }}
                      />
                    </div>
                    <span className="rate-value">
                      {row.value.toFixed(1)}
                      <small>Hz</small>
                    </span>
                  </div>
                ))}
              </div>
              <button
                className={`isolation-button ${isolated ? "isolated" : ""}`}
                onClick={() => {
                  setIsolated(!isolated);
                  world.current.isolated = !isolated;
                }}
                aria-pressed={isolated}
              >
                <Eye size={13} />
                {isolated
                  ? "Sensory input disconnected"
                  : "Sensory input connected"}
                <span className="toggle-mini" />
              </button>
            </section>
          </aside>
        </div>
        <section className="sound-rack" aria-label="Neural sound controls">
          <div className="rack-heading">
            <div>
              <span className="eyebrow">NEURONS → SOUND</span>
              <h2>Listen to the wiring.</h2>
            </div>
            <button
              className={`record-button ${recording ? "recording" : ""}`}
              onClick={record}
              disabled={phase !== "ready"}
            >
              {recording ? (
                <CircleStop size={13} />
              ) : (
                <span className="record-dot" />
              )}
              {recording ? `Stop · ${seconds(recordTime)}` : "Record audio"}
            </button>
          </div>
          <div className="rack-grid">
            {[
              { name: "Steering", desc: "Stereo · harmonic tone", icon: Orbit },
              {
                name: "Wing motor",
                desc: "Amplitude · shifting texture",
                icon: Waves,
              },
              { name: "Escape", desc: "Trigger · low percussion", icon: Zap },
            ].map(({ name, desc, icon: Icon }, i) => (
              <div className="sound-channel" key={name}>
                <div className="channel-title">
                  <span style={{ color: palette[i] }}>
                    <Icon size={16} />
                    {name}
                  </span>
                  <span className="channel-index">0{i + 1}</span>
                </div>
                <Trace values={history[i]} color={palette[i]} />
                <div className="channel-caption">{desc}</div>
                <label className="sr-only" htmlFor={`mix-${i}`}>
                  {name} sound level
                </label>
                <input
                  id={`mix-${i}`}
                  aria-label={`${name} sound level`}
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={mix[i]}
                  style={{ accentColor: palette[i] }}
                  onChange={(e) =>
                    setMix((prev) =>
                      prev.map((v, j) => (i === j ? +e.target.value : v)),
                    )
                  }
                />
              </div>
            ))}
            <div className="master-channel">
              <div className="channel-title">
                <span>
                  <AudioLines size={16} /> Master output
                </span>
                <Volume2 size={13} />
              </div>
              <Scope audio={audio} running={running} />
              <label className="slider-label" htmlFor="master-volume">
                Volume<span>{Math.round(volume * 100)}%</span>
              </label>
              <input
                id="master-volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => setVolume(+e.target.value)}
              />
            </div>
          </div>
        </section>
        <section className="under-rack">
          <div className="honesty-note">
            <Leaf size={16} />
            <p>
              <strong>Biological wiring. Designed interpretation.</strong> A
              simplified neural simulation drives the signals. We choose how
              those signals become movement and sound.
            </p>
            <button
              onClick={() => setDialog(true)}
              aria-label="Read model explanation"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="noise-control">
            <label htmlFor="noise">
              Background noise <span>{noise.toFixed(1)}×</span>
            </label>
            <input
              id="noise"
              type="range"
              min="0"
              max="2"
              step=".1"
              value={noise}
              onChange={(e) => {
                const v = +e.target.value;
                setNoise(v);
                worker.current?.postMessage({ type: "noise", value: v });
              }}
            />
          </div>
        </section>
        <footer>
          <span>
            <span className="status-dot" /> MaleCNS v1.0{" "}
            <span className="footer-sep">/</span> 166,700 neurons{" "}
            <span className="footer-sep">/</span> 25.1M connections
          </span>
          <div>
            <span
              className={
                running && actualSpeed < speed * 0.8 ? "performance-slow" : ""
              }
            >
              {phase === "ready"
                ? `${(running ? actualSpeed : 0).toFixed(1)}× actual / ${speed}× requested · ${n.stepMs.toFixed(1)} ms / step`
                : "20 ms simulation step"}
            </span>
            <button onClick={exportSession}>
              <ArrowDownToLine size={12} /> Export activity
            </button>
            <button
              onClick={() => setDialog(true)}
              aria-label="About this simulation"
            >
              <CircleHelp size={14} />
            </button>
          </div>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {dialog && <ModelDialog close={() => setDialog(false)} />}
    </>
  );
}

function ModelDialog({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="model-dialog"
    >
      <div className="dialog-content">
        <button
          className="dialog-close icon-button"
          aria-label="Close model explanation"
          onClick={close}
        >
          <X size={20} />
        </button>
        <div className="eyebrow">
          <Sparkles size={13} /> INSIDE THE INSTRUMENT
        </div>
        <h2>Follow the signal.</h2>
        <p className="dialog-intro">
          The wiring comes from a fly. The world and the music are our
          interpretation.
        </p>
        <div className="signal-path">
          <span>
            <MousePointer2 size={19} /> Your gesture
          </span>
          <ChevronRight size={14} />
          <span>
            <Activity size={19} /> Fly network
          </span>
          <ChevronRight size={14} />
          <span>
            <Headphones size={19} /> Sound
          </span>
        </div>
        <h3>01 / The input is measured, not seen</h3>
        <p>
          Placed sources stimulate visual, hearing, smell, wind, touch and taste
          neurons. Direction, distance and contact determine input strength.
          Visibility can be combined with another sense on the same object. No
          image recognition runs here; the inputs are numerical sensory
          features.
        </p>
        <h3>02 / The connectome supplies the connections</h3>
        <p>
          All 166,700 neurons and 25,088,107 connections in the upstream browser
          export are simulated with simplified leaky integrate-and-fire
          dynamics. The exported weights are quantized. Connections remain
          fixed; there is no training or learning in this instrument.
        </p>
        <h3>03 / We read activity and design the response</h3>
        <p>
          Steering populations control turning and stereo position. Wing-motor
          activity controls a sustained tone. Rising escape activity triggers
          low percussion and a visual climb. Pitch, timbre, constant forward
          cruise, wall handling and the visual wing animation are designed
          mappings, not a reconstruction of fly muscles or song.
        </p>
        <h3>A useful experiment, with clear limits</h3>
        <p>
          This is not a complete working animal or a claim of consciousness.
          Neuron dynamics and input strengths are simplified. Disconnect sensory
          input to hear background activity, or set background noise to zero to
          explore the difference.
        </p>
        <a
          className="dialog-source"
          href="https://github.com/alextitonis/fly.ai/tree/59ff122b39e0f0b51bea9131324f4350c9a57318"
          target="_blank"
          rel="noreferrer"
        >
          Upstream source · MIT license <ArrowUpRight size={14} />
        </a>
        <button className="play-button dialog-done" onClick={close}>
          Back to the instrument <MoveUpRight size={15} />
        </button>
      </div>
    </dialog>
  );
}
