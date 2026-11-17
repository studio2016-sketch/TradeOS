"use client";

import { useState } from "react";
import {
  addSessionDraft, calculateManualPlan, createSessionDraft,
  EMPTY_MANUAL_PLAN, MAX_SESSION_DRAFTS,
  type ManualPlanField, type ManualPlanInputs, type SessionDraft,
} from "../../lib/paper/manualPlan";

const fields: { key: ManualPlanField; label: string; help: string }[] = [
  { key: "equity", label: "Hypothetical equity (USD)", help: "Imaginary available cash, not a connected account. Up to 2 decimal places." },
  { key: "riskPercent", label: "Planned risk (% of equity)", help: "A percentage you choose, not a suggested risk level. Up to 4 decimal places." },
  { key: "entry", label: "Planned entry (USD/share)", help: "Your assumed buy price. No market quote is fetched." },
  { key: "stop", label: "Planned stop (USD/share)", help: "Below entry. A stop is not a guaranteed exit price." },
  { key: "target", label: "Planned target (USD/share)", help: "Above entry. A hypothetical outcome, not a forecast." },
];

export default function PaperWorkspace() {
  const [inputs, setInputs] = useState<ManualPlanInputs>({ ...EMPTY_MANUAL_PLAN });
  const [touched, setTouched] = useState<Partial<Record<ManualPlanField, boolean>>>({});
  const [drafts, setDrafts] = useState<SessionDraft[]>([]);
  const result = calculateManualPlan(inputs);
  const plan = result.plan;
  const draft = createSessionDraft(inputs);
  const duplicate = draft !== null && drafts.some(item => item.key === draft.key);
  const full = drafts.length >= MAX_SESSION_DRAFTS;

  function resetInputs() {
    setInputs({ ...EMPTY_MANUAL_PLAN });
    setTouched({});
  }

  return <>
    <aside className="paperCaution">
      <strong>Use hypothetical numbers only.</strong> No provider or broker requests are made by this planner. It does not check market evidence, portfolio holdings, daily loss limits or execution readiness. Existing TradeOS research and trading restrictions still apply.
    </aside>
    <div className="paperColumns">
      <section className="paperCard" aria-labelledby="paper-input-title">
        <h2 id="paper-input-title">Your assumptions</h2>
        <p>All fields start blank. Prices accept up to 4 decimals; use a dot without commas.</p>
        <div className="paperFields">
          {fields.map(({ key, label, help }) => {
            const error = result.errors[key];
            const showError = Boolean(error && touched[key]);
            return <div className="paperField" key={key}>
              <label htmlFor={`paper-${key}`}>{label}</label>
              <input id={`paper-${key}`} type="text" inputMode="decimal" maxLength={24}
                autoComplete="off" spellCheck={false} value={inputs[key]}
                aria-invalid={showError} aria-describedby={`paper-${key}-help${showError ? ` paper-${key}-error` : ""}`}
                onBlur={() => setTouched(current => ({ ...current, [key]: true }))}
                onChange={event => {
                  const value = event.target.value;
                  setInputs(current => ({ ...current, [key]: value }));
                  setTouched(current => ({ ...current, [key]: true }));
                }} />
              <small id={`paper-${key}-help`}>{help}</small>
              {showError && <span className="paperError" id={`paper-${key}-error`}>{error}</span>}
            </div>;
          })}
        </div>
        <button className="paperSecondary" type="button" onClick={resetInputs}>Reset inputs</button>
      </section>
      <section className="paperCard" aria-labelledby="paper-result-title">
        <h2 id="paper-result-title">Hypothetical size</h2>
        <div role="status" aria-live="polite" aria-atomic="true">
          {!plan ? <p>{result.status === "invalid" ? "Correct the highlighted inputs. No size is calculated." : "Enter all five assumptions to calculate a size."}</p> : <>
            <p className="paperShares"><strong>{plan.shares.toLocaleString("en-US")}</strong> whole shares</p>
            {result.status === "zero_shares" && <p className="paperError">No whole share fits the chosen budget and equity. No draft can be saved.</p>}
            <dl className="paperMetrics">
              <div><dt>Risk budget (rounded down to cents)</dt><dd>${plan.riskBudget}</dd></div>
              <div><dt>Entry minus stop, per share</dt><dd>${plan.riskPerShare}</dd></div>
              <div><dt>Hypothetical entry cost</dt><dd>${plan.notional}</dd></div>
              <div><dt>Planned loss at the exact stop</dt><dd>${plan.plannedStopLoss}</dd></div>
              <div><dt>Hypothetical gain at the exact target</dt><dd>${plan.targetGain}</dd></div>
              <div><dt>Remaining hypothetical cash</dt><dd>${plan.remainingEquity}</dd></div>
              <div><dt>Approximate reward/risk per share</dt><dd>{plan.rewardToRisk} : 1</dd></div>
            </dl>
            <p><strong>Size limited by:</strong> {plan.limitingFactors.join("; ")}.</p>
          </>}
        </div>
        <p className="paperCaution"><strong>Planned stop loss is not a maximum loss.</strong> Gaps, slippage, fees and failed exits can make losses larger. No fills or protective orders exist here.</p>
        <button type="button" disabled={!draft || duplicate || full}
          onClick={() => setDrafts(current => addSessionDraft(current, inputs))}>
          {duplicate ? "Draft already saved on this page" : full ? "Session journal full" : "Save arithmetic draft on this page"}
        </button>
        <p className="paperSmall">Saving creates a local comparison snapshot only. It never creates a paper order or a performance record.</p>
      </section>
    </div>
    <section className="paperCard" aria-labelledby="paper-assumptions-title">
      <h2 id="paper-assumptions-title">What the calculation assumes</h2>
      <ul>
        <li>One hypothetical long position in USD. All entered equity is available cash. No borrowing, other holdings or fractional shares.</li>
        <li>Risk budget = equity × risk percentage ÷ 100, rounded down to cents.</li>
        <li>Shares = the smallest of risk budget ÷ (entry − stop), equity ÷ entry, and 100,000, rounded down to a whole share.</li>
        <li>Entry, stop and target are exactly the values you enter. Fees, spread, slippage, liquidity, taxes, probability and execution are not modeled.</li>
        <li>Calculator bounds: equity up to $1 billion, each price up to $1 million, risk greater than 0% and no more than 100%. These are input bounds, not recommendations.</li>
        <li>No market validation, scientific certification, historical performance or trading authorization is established by these numbers.</li>
      </ul>
    </section>
    <section className="paperCard" aria-labelledby="paper-journal-title">
      <h2 id="paper-journal-title">Session draft journal ({drafts.length}/{MAX_SESSION_DRAFTS})</h2>
      <p>Held only in this page&apos;s memory. Not uploaded or written to browser storage. Reloading or leaving this page can lose every draft. Each draft is independent; sizes are not added into a portfolio.</p>
      <div role="status" aria-live="polite">{drafts.length === 0 ? "No arithmetic drafts saved." : `${drafts.length} arithmetic draft${drafts.length === 1 ? "" : "s"} saved on this page.`}</div>
      <ol className="paperDrafts">
        {drafts.map((item, index) => <li key={item.key}>
          <h3>Draft {index + 1}: {item.plan.shares.toLocaleString("en-US")} whole shares</h3>
          <p>Equity ${item.inputs.equity} · Risk {item.inputs.riskPercent}% · Entry ${item.inputs.entry} · Stop ${item.inputs.stop} · Target ${item.inputs.target}</p>
          <p>Entry cost ${item.plan.notional} · Planned loss at stop ${item.plan.plannedStopLoss} · Hypothetical target gain ${item.plan.targetGain}</p>
          <button className="paperSecondary" type="button" onClick={() => {
            setInputs({ ...item.inputs });
            setTouched({});
          }} aria-label={`Load draft ${index + 1} into inputs`}>Load inputs</button>
          <button className="paperSecondary" type="button"
            onClick={() => setDrafts(current => current.filter(saved => saved.key !== item.key))}
            aria-label={`Remove draft ${index + 1}`}>Remove draft</button>
        </li>)}
      </ol>
      <button className="paperSecondary" type="button" disabled={!drafts.length} onClick={() => setDrafts([])}>Clear session journal</button>
    </section>
  </>;
}
