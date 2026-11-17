"use client";

import type { VariableState } from "../../lib/alignment/engine";

type Gear = { state: VariableState };
type Alignment = {
  symbol?: string;
  buyScore?: number | null;
  buyState?: string;
  readings?: Gear[];
  adaptive?: { gears?: Array<Gear & { id: string; label: string }> };
  criticalPassed?: number;
  criticalTotal?: number;
  canonical?: { all120Aligned?: boolean };
  decisionCouncil?: { vetoes?: string[] };
  decisionInsights?: {
    blockers?: Array<{ label: string; critical: boolean; reason: string }>;
    unmetGates?: string[];
  };
};

const marketCount = 108;
const adaptiveCount = 12;
const gearStates: Record<VariableState, string> = {
  aligned: "Aligned",
  mixed: "Mixed",
  misaligned: "Misaligned",
  unavailable: "Unavailable",
};

function gearSlots(size: number, readings?: Gear[]) {
  return Array.from({ length: size }, (_, index) => {
    const state = readings?.[index]?.state;
    return state && Object.hasOwn(gearStates, state) ? state : "unavailable";
  });
}

function GearRing({ states, radius }: { states: VariableState[]; radius: number }) {
  return states.map((state, index) => (
    <line
      key={index}
      className={`av-mark av-mark-${state}`}
      x1="100"
      x2="100"
      y1={100 - radius}
      y2={106 - radius}
      transform={`rotate(${index * 360 / states.length} 100 100)`}
    />
  ));
}

export default function AlignmentVault({
  symbol,
  data,
  onExpand,
}: {
  symbol: string;
  data: Alignment | null;
  onExpand?: () => void;
}) {
  const assessment = data?.symbol === symbol ? data : null;
  const market = gearSlots(marketCount, assessment?.readings);
  const adaptive = gearSlots(adaptiveCount, assessment?.adaptive?.gears);
  const gears = [...market, ...adaptive];
  const totals = { aligned: 0, mixed: 0, misaligned: 0, unavailable: 0 };
  for (const state of gears) totals[state]++;

  const rawScore = assessment?.buyScore;
  const score = typeof rawScore === "number" && Number.isFinite(rawScore) && totals.unavailable < gears.length
    ? Math.round(Math.min(100, Math.max(0, rawScore)))
    : null;
  const vetoes = assessment?.decisionCouncil?.vetoes;
  const unmetGates = assessment?.decisionInsights?.unmetGates;
  const blockers = assessment?.decisionInsights?.blockers ?? [];
  const adaptiveBlockers = assessment?.adaptive?.gears?.filter(gear => gear.state !== "aligned").slice(0, 2) ?? [];
  const fullyAligned = assessment?.canonical?.all120Aligned === true
    && assessment.buyState === "MUST BUY"
    && totals.aligned === gears.length
    && vetoes?.length === 0
    && unmetGates?.length === 0;
  const status = fullyAligned ? "Alignment complete" : "Vault locked";

  return (
    <section className="av-shell" aria-label="Trade alignment vault">
      <header className="av-heading">
        <div>
          <p className="av-eyebrow">TRADEOS · PAPER TRADE RESEARCH</p>
          <h2>Trade alignment vault</h2>
          <p>108 market and decision factors on the outer ring. 12 model checks on the inner ring.</p>
        </div>
        <span className="av-count">120<span>GEARS</span></span>
      </header>
      <div className="av-layout">
        <figure className="av-figure">
          <div className="av-mechanism" data-aligned={fullyAligned} aria-hidden="true">
            <svg className="av-rings" viewBox="0 0 200 200" focusable="false">
              <circle className="av-ring-track" cx="100" cy="100" r="94" strokeWidth="8" />
              <circle className="av-ring-track" cx="100" cy="100" r="72" strokeWidth="8" />
              <GearRing states={market} radius={97} />
              <GearRing states={adaptive} radius={75} />
            </svg>
            <div className="av-deadbolt">
              <span className="av-deadbolt-pin" />
              <span>{fullyAligned ? "ALIGNED" : "LOCKED"}</span>
            </div>
          </div>
          <figcaption className="av-legend">
            {(Object.keys(gearStates) as VariableState[]).map(state => (
              <span key={state}>
                <i className={`av-swatch av-mark-${state}`} aria-hidden="true" />
                {gearStates[state]} <b>{totals[state]}</b>
              </span>
            ))}
          </figcaption>
        </figure>
        <aside className="av-panel">
          <p className="av-eyebrow">RESEARCH DECISION</p>
          <h3>{symbol}</h3>
          <div className="av-state" data-aligned={fullyAligned}>{status}</div>
          <p className="av-explanation">
            {fullyAligned
              ? "All 120 factors align and the research gates have cleared. Paper orders require separate authorization."
              : vetoes?.length
                ? "The Decision Council is holding this setup."
                : score === null
                  ? "Awaiting scored evidence for this symbol."
                  : "Full factor alignment and cleared research gates are required."}
          </p>
          <dl className="av-statgrid">
            <div><dt>Alignment score</dt><dd>{score === null ? "Unavailable" : `${score}/100`}</dd></div>
            <div><dt>Factors observed</dt><dd>{gears.length - totals.unavailable}/120</dd></div>
            <div><dt>Critical checks passed</dt><dd>{assessment?.criticalTotal ? `${assessment.criticalPassed ?? 0}/${assessment.criticalTotal}` : "Unavailable"}</dd></div>
          </dl>
          {(Boolean(vetoes?.length) || Boolean(unmetGates?.length) || blockers.length > 0 || adaptiveBlockers.length > 0) && (
            <div className="av-insights">
              <h4>What’s holding the vault</h4>
              <ul>
                {vetoes?.slice(0, 3).map(veto => <li key={veto}>{veto}</li>)}
                {blockers.slice(0, 3).map(blocker => (
                  <li key={blocker.label}><strong>{blocker.critical ? "Critical · " : ""}{blocker.label}</strong> — {blocker.reason}</li>
                ))}
                {adaptiveBlockers.map(gear => (
                  <li key={gear.id}><strong>{gear.label}</strong> — {gearStates[gear.state]}</li>
                ))}
              </ul>
              {Boolean(unmetGates?.length) && <p>Outstanding gates · {unmetGates?.map(gate => gate.replaceAll("_", " ")).join(", ")}</p>}
            </div>
          )}
          {onExpand && <button className="av-action" type="button" onClick={onExpand}>Inspect all 120 gears →</button>}
        </aside>
      </div>
    </section>
  );
}
