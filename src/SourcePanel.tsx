import type { CSSProperties } from "react";
import { Eye, Plus, SlidersHorizontal, Trash2, X, Zap } from "lucide-react";
import { SOURCE_INFO } from "./environment";
import type { NeuralState, SourceKind, WorldSource } from "./types";
interface Props {
  sources: WorldSource[];
  selectedId: string | null;
  placing: SourceKind | null;
  neural: NeuralState;
  onChoose: (kind: SourceKind | null) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string, patch: Partial<WorldSource>) => void;
  onRemove: (id: string) => void;
  onPulse: () => void;
}
export default function SourcePanel({
  sources,
  selectedId,
  placing,
  neural,
  onChoose,
  onSelect,
  onEdit,
  onRemove,
  onPulse,
}: Props) {
  const selected = sources.find((s) => s.id === selectedId);
  return (
    <section className="stimulus-panel sources-panel">
      <div className="section-heading">
        <h2>
          <SlidersHorizontal size={14} /> World sources
        </h2>
        <span>{sources.length} PLACED</span>
      </div>
      <p className="source-intro">
        Pick a source, then click inside the world to place it.
      </p>
      <div
        className="source-palette"
        role="group"
        aria-label="Add a sensory source"
      >
        {(Object.keys(SOURCE_INFO) as SourceKind[]).map((kind) => {
          const info = SOURCE_INFO[kind];
          return (
            <button
              key={kind}
              aria-label={`Place ${info.label.toLowerCase()}`}
              aria-pressed={placing === kind}
              className={placing === kind ? "armed" : ""}
              onClick={() => onChoose(placing === kind ? null : kind)}
              style={{ "--source-color": info.color } as CSSProperties}
            >
              <span aria-hidden="true">{info.glyph}</span>
              {info.label}
              <Plus size={12} />
            </button>
          );
        })}
      </div>
      {placing && (
        <div className="placement-hint" role="status">
          Click the world to place {SOURCE_INFO[placing].label.toLowerCase()}.
          <button onClick={() => onChoose(null)} aria-label="Cancel placement">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="placed-sources" role="group" aria-label="Placed sources">
        {sources.map((s, i) => (
          <button
            key={s.id}
            className={s.id === selectedId ? "selected-source" : ""}
            onClick={() => onSelect(s.id)}
            aria-pressed={s.id === selectedId}
          >
            <span
              style={{ color: SOURCE_INFO[s.kind].color }}
              aria-hidden="true"
            >
              {SOURCE_INFO[s.kind].glyph}
            </span>
            <span>
              {SOURCE_INFO[s.kind].label} <small>{i + 1}</small>
            </span>
            <span
              className={`source-enabled-dot ${s.enabled ? "on" : ""}`}
              title={s.enabled ? "Source on" : "Source off"}
            />
          </button>
        ))}
        {!sources.length && (
          <p className="source-intro">
            Your world is empty. Add a source above.
          </p>
        )}
      </div>
      {selected && (
        <div className="source-inspector">
          <div className="source-inspector-heading">
            <strong>{SOURCE_INFO[selected.kind].label}</strong>
            <button
              onClick={() => onRemove(selected.id)}
              aria-label="Remove selected source"
              title="Remove selected source"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <p>{SOURCE_INFO[selected.kind].description}</p>
          <label className="slider-label" htmlFor="source-strength">
            Source strength <span>{Math.round(selected.strength * 100)}%</span>
          </label>
          <input
            id="source-strength"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={selected.strength}
            onChange={(e) => onEdit(selected.id, { strength: +e.target.value })}
          />
          <div className="source-toggles">
            <label>
              <input
                type="checkbox"
                checked={selected.enabled}
                onChange={(e) =>
                  onEdit(selected.id, { enabled: e.target.checked })
                }
              />{" "}
              Source on
            </label>
            <label>
              <input
                type="checkbox"
                checked={selected.visible}
                onChange={(e) =>
                  onEdit(selected.id, { visible: e.target.checked })
                }
              />
              <Eye size={12} /> Visible to fly
            </label>
          </div>
          {selected.kind === "loom" && (
            <button className="pulse-button" onClick={onPulse}>
              <Zap size={14} /> Send looming pulse <kbd>↵</kbd>
            </button>
          )}
          <div className="source-position">
            POSITION{" "}
            <span>
              X {selected.x.toFixed(1)} / Z {selected.z.toFixed(1)}
            </span>
          </div>
          <p className="source-footnote">
            All markers are visible to you. “Visible to fly” also adds visual
            stimulation.
          </p>
        </div>
      )}
      <div
        className="sense-readouts"
        aria-label="Additional sensory neuron activity"
      >
        <span>
          Hearing <b>{neural.hearing.toFixed(1)} Hz</b>
        </span>
        <span>
          Smell <b>{neural.smell.toFixed(1)} Hz</b>
        </span>
        <span>
          Contact <b>{neural.contact.toFixed(1)} Hz</b>
        </span>
      </div>
    </section>
  );
}
