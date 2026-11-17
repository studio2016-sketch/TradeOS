"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createResearchPanelLoader, hasCurrentResearchResponse, initialResearchPanels,
  researchPanelStatus, type ResearchPanelState,
} from "../../lib/research/research-panel-loader";

function PanelStatus({ panel, label }: { panel: ResearchPanelState; label: string }) {
  return (
    <div aria-label={`${label} load status`} aria-live="polite" style={{ fontSize: 14, color: "#cfdae0" }}>
      <p>{researchPanelStatus(panel)}</p>
      {panel.error ? <p role="alert" style={{ color: "#ffc9a0" }}>{label}: {panel.error}</p> : null}
      <p>Last successful load: {panel.lastSuccessAt === null ? "Never" : (
        <time dateTime={new Date(panel.lastSuccessAt).toISOString()}>{new Date(panel.lastSuccessAt).toLocaleString()}</time>
      )}. Load time does not establish source freshness or scientific certification.</p>
    </div>
  );
}

export default function ResearchLab() {
  const [panels, setPanels] = useState(initialResearchPanels);
  const loader = useRef<ReturnType<typeof createResearchPanelLoader> | null>(null);
  const refresh = useCallback(() => {
    void loader.current?.refresh();
  }, []);
  useEffect(() => {
    const current = createResearchPanelLoader(setPanels);
    loader.current = current;
    void current.refresh();
    return () => {
      current.cancel();
      if (loader.current === current) loader.current = null;
    };
  }, []);
  const { models: modelPanel, factors: factorPanel, ledger: ledgerPanel, certification: certificationPanel } = panels;
  const models = modelPanel.data, factors = factorPanel.data, ledger = ledgerPanel.data;
  const certification = certificationPanel.data;
  const certificationCurrent = hasCurrentResearchResponse(certificationPanel);
  const busy = Object.values(panels).some(panel => panel.loading);
  const pct = (n: any) =>
    typeof n === "number" && Number.isFinite(n)
      ? (n * 100).toFixed(1) + "%"
      : "Unavailable";
  const numeric = (n: any, digits = 3) =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toFixed(digits)
      : "Unavailable";
  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: "32px",
        background: "#081a27",
        color: "#e9f5f1",
        minHeight: "100vh",
        maxWidth: 1160,
        margin: "auto",
      }}
    >
      <a href="/" style={{ color: "#98e3d4" }}>
        ← TradeOS Home
      </a>
      <h1>Factor Intelligence Laboratory</h1>
      <p>
        Measure the quality of actual forecasts and recorded factors before
        adjusting model weights. These are research observations—not independent
        proof of profitable trading.
      </p>
      <button
        disabled={busy}
        onClick={refresh}
        style={{
          padding: "12px 18px",
          background: "#19685f",
          color: "white",
          border: 0,
          borderRadius: 8,
        }}
      >
        {busy ? "Evaluating…" : "Recheck recorded evidence"}
      </button>
      <p>Each dataset loads independently. A failed recheck keeps its previous response visibly marked as stale.</p>
      <section
        style={{
          background: "#102f39",
          padding: 22,
          border: "1px solid #4b887b",
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <h2>Prediction–Outcome Scientific Ledger</h2>
        <PanelStatus panel={ledgerPanel} label="Scientific ledger" />
        <p>
          Objective market outcomes grade predictions under the frozen <b>{ledger?.rule?.version ?? "checking"}</b> protocol.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <div><small>UNIQUE TESTS</small><h3>{ledger?.summary?.uniqueMarketTests ?? "—"}</h3></div>
          <div><small>PASS</small><h3>{ledger?.summary?.passes ?? "—"}</h3></div>
          <div><small>FAIL</small><h3>{ledger?.summary?.failures ?? "—"}</h3></div>
          <div><small>VOID</small><h3>{ledger?.summary?.voids ?? "—"}</h3></div>
          <div><small>UNRESOLVED</small><h3>{ledger?.summary?.unresolved ?? "—"}</h3></div>
          <div><small>PROSPECTIVE SCIENTIFIC</small><h3>{ledger?.summary?.prospectiveScientificRecords ?? "—"}</h3></div>
        </div>
        <p>
          Historical reconstructed pass rate: <strong>{pct(ledger?.summary?.passRate)}</strong> · Prospective PASS/FAIL: <strong>{ledger?.summary?.prospectiveScientificPasses ?? "—"}/{ledger?.summary?.prospectiveScientificFailures ?? "—"}</strong> · Prospective sessions: <strong>{ledger?.summary?.sessions ?? "—"}</strong>
        </p>
        <p>
          Protocol fingerprint: <code>{ledger?.rule?.fingerprint ? `${ledger.rule.fingerprint.slice(0, 16)}…` : "checking"}</code> · Fingerprint-bound records: <strong>{ledger?.summary?.fingerprintedScientificRecords ?? "—"}</strong>
        </p>
        <h3>Certification authority</h3>
        <PanelStatus panel={certificationPanel} label="Certification authority" />
        <p>
          Certification authority: <strong>{certification?.status ?? "UNAVAILABLE"}</strong> · Model promotion: <strong>{!certificationCurrent ? "UNAVAILABLE" : certification?.modelPromotionAllowed === true ? "ALLOWED" : "BLOCKED"}</strong> · Live execution: <strong>{!certificationCurrent ? "UNAVAILABLE" : certification?.liveExecutionAllowed === true ? "ALLOWED" : "BLOCKED"}</strong>
        </p>
        {(certification?.checks ?? []).filter((x: any) => !x.pass).map((x: any) => (
          <p key={x.id} style={{color:"#ffc9a0",margin:"6px 0"}}>Blocked — {x.id.replaceAll("_", " ")}: {x.detail}</p>
        ))}
        <small>{ledger?.scientificPolicy}</small>
        <h3>Latest frozen outcomes</h3>
        {(ledger?.recent ?? []).slice(0, 12).map((x: any) => (
          <p key={x.id} style={{borderTop:"1px solid #4e6877",paddingTop:8}}>
            <strong>{x.verdict}</strong> · {x.symbol} · {x.horizon} · {new Date(x.forecastAt).toLocaleString()} · net {pct(x.netReturn)} · {x.scientificallyEligible ? "SCIENTIFIC COHORT" : x.evidenceClass.replaceAll("_", " ")}
          </p>
        ))}
        <h3>Prospective factor-to-PASS hypotheses</h3>
        {(ledger?.prospectiveFactorAssociations?.findings ?? []).slice(0, 10).map((x: any) => (
          <p key={x.label} style={{borderTop:"1px solid #4e6877",paddingTop:8}}>
            <strong>{x.label.replaceAll("_", " ")}</strong> · {x.observations} outcomes / {x.sessions} sessions · high-minus-low PASS rate {pct(x.medianSplitReturnSpread)} · {x.status.replaceAll("_", " ")}
          </p>
        ))}
        {ledger && !ledger.prospectiveFactorAssociations?.findings?.length ? <p>No factor hypothesis can be formed until fingerprint-bound prospective outcomes mature.</p> : null}
      </section>
      <section
        style={{
          background: "#142d3b",
          padding: 22,
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <h2>Chronological forecast validation</h2>
        <PanelStatus panel={modelPanel} label="Chronological forecast validation" />
        <p>
          Research status:{" "}
          <strong>{models?.certification ?? "NOT VERIFIED"}</strong>
        </p>
        <p>
          The score compares holdout forecasting error against an unconditional
          forecast based only on the earlier training period. Positive
          improvement has not been assumed.
        </p>
        {models?.validations?.map((v: any) => (
          <article
            key={v.modelAndHorizon}
            style={{ borderTop: "1px solid #4e6877", padding: "14px 0" }}
          >
            <h3>{v.modelAndHorizon}</h3>
            <p>
              Recorded: {v.sampleCount} · Training: {v.trainCount} · Holdout:{" "}
              {v.holdoutCount}
            </p>
            <p>
              Model Brier: {numeric(v.modelBrier, 4)} · Frozen baseline Brier:{" "}
              {numeric(v.baselineBrier, 4)}
            </p>
            <p>
              <strong>
                Skill versus earlier base rate:{" "}
                {pct(v.skillVsFrozenTrainBaseline)}
              </strong>
            </p>
            <p>
              Holdout evidence supports improvement:{" "}
              <strong>
                {v.evidenceOfImprovement === true
                  ? "RESEARCH POSITIVE · NOT PROMOTED"
                  : "NO"}
              </strong>
            </p>
            <p style={{ fontSize: 13, color: "#cfdae0" }}>{v.warnings?.[0]}</p>
          </article>
        ))}
        {models && !models.validations?.length ? (
          <p>No independently evaluable models returned.</p>
        ) : null}
      </section>
      <section
        style={{
          background: "#142d3b",
          padding: 22,
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <h2>Factor evidence</h2>
        <PanelStatus panel={factorPanel} label="Factor evidence" />
        <p>
          <a href="/knowledge-graph" style={{ color: "#85e0cf" }}>
            Explore factor relationships and source lineage →
          </a>
        </p>
        <p>
          Registered analytical gears:{" "}
          <b>{factors?.registryCount ?? "Unavailable"}</b> · De-duplicated
          forecasts:{" "}
          <b>{factors?.pointInTimeEvidence?.forecasts ?? "Unavailable"}</b> ·
          Point-in-time factor rows:{" "}
          <b>{factors?.pointInTimeEvidence?.rows ?? "Unavailable"}</b> ·
          Research status: <b>{factors?.status ?? "UNAVAILABLE"}</b>
        </p>
        <h3>Historical association discovery</h3>
        <p>
          Tested family:{" "}
          <b>
            {factors?.historicalDiscovery?.testedFamilySize ?? "Unavailable"}
          </b>{" "}
          factors · Correction:{" "}
          <b>
            {factors?.historicalDiscovery?.multiplicityMethod ?? "Unavailable"}
          </b>
          . Direction-adjusted returns reverse bearish forecasts before
          comparison.
        </p>
        {(factors?.historicalDiscovery?.findings ?? [])
          .slice(0, 15)
          .map((x: any) => (
            <article
              key={x.label}
              style={{ borderTop: "1px solid #4e6877", padding: "12px 0" }}
            >
              <h3>{x.label.replaceAll("_", " ")}</h3>
              <p>
                {x.observations} observations · {x.sessions} sessions ·{" "}
                {x.symbols} symbols · Rank correlation{" "}
                {numeric(x.rankCorrelation, 3)}
              </p>
              <p>
                High-minus-low direction-adjusted return:{" "}
                <strong>{pct(x.medianSplitReturnSpread)}</strong> ·
                Chronological holdout:{" "}
                <strong>{pct(x.chronologicalHoldoutSpread)}</strong>
              </p>
              <p>
                Holm-adjusted p-value: {numeric(x.adjustedPValue, 4)} ·{" "}
                <strong>{x.status.replaceAll("_", " ")}</strong>
              </p>
              <small>
                {x.direction}. Research hypothesis only; model promotion remains
                blocked.
              </small>
            </article>
          ))}
        <h3>Outcome-frequency cross-check</h3>
        {factors?.associations?.slice(0, 15).map((x: any) => (
          <article
            key={x.label}
            style={{ borderTop: "1px solid #4e6877", padding: "12px 0" }}
          >
            <h3>{x.label}</h3>
            <p>
              Recorded: {x.recorded} · Holdout: {x.holdout} · High-value
              observations: {x.highCount} · Low-value observations: {x.lowCount}
            </p>
            <p>
              Observed high-minus-low outcome frequency:{" "}
              <strong>{pct(x.observedDifference)}</strong>
            </p>
            <p style={{ color: "#ffc9a0" }}>
              Independently validated: NO · Model promotion: BLOCKED
            </p>
          </article>
        ))}
        <h3>Factor overlap diagnostics</h3>
        <p>
          Strong correlations may indicate redundant research inputs. These
          estimates are descriptive, not independent predictive validation.
        </p>
        {(factors?.factorDependence?.pairs ?? []).slice(0, 15).map((p: any) => (
          <p key={p.first + "-" + p.second}>
            {p.first} / {p.second}: correlation {p.pearsonR} · {p.paired}{" "}
            matched forecasts · {p.status}
          </p>
        ))}
        {factors && !factors.associations?.length ? (
          <p>
            Factor outcomes unavailable. The platform must not infer importance
            from factor names or score levels alone.
          </p>
        ) : null}
      </section>
      <p style={{ color: "#a5becd", fontSize: 14 }}>
        Limits: The current forecast sample is not an independent
        instrument-level walk-forward study, may include overlapping market
        events, has unverified model freezes, and excludes transaction-cost
        profitability. Missing historical evidence cannot be manufactured.
      </p>
    </main>
  );
}
