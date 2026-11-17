"use client";
import StudyPath from "./StudyPath";
import {
  ArrowUpRight,
  ShieldCheck,
  ArrowRight,
  Layers3,
  Clock3,
  Database,
  CircleDot,
} from "lucide-react";

type Props = {
  symbol: string;
  alignment: any;
  health: any;
  market: any;
  intelligence: any;
  refreshing: boolean;
  lastRefresh: string | null;
  onNavigate: (section: string) => void;
  onSelect: (symbol: string) => void;
};
export function count(value: unknown) {
  const parsed =
    typeof value === "string" && /^(0|[1-9]\d{0,15})$/.test(value)
      ? Number(value)
      : value;
  return typeof parsed === "number" &&
    Number.isSafeInteger(parsed) &&
    parsed >= 0
    ? parsed.toLocaleString("en-US")
    : "—";
}
export function observationLabel(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "Observation time unavailable";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
export default function DecisionOverview({
  symbol,
  alignment,
  health,
  market,
  intelligence,
  refreshing,
  lastRefresh,
  onNavigate,
  onSelect,
}: Props) {
  const readings = Array.isArray(alignment?.readings) ? alignment.readings : [];
  const blockers = readings
    .filter((r: any) => r.state !== "aligned")
    .slice(0, 4);
  const sources = Array.isArray(health?.reliability?.rows)
    ? health.reliability.rows
    : [];
  const events = Array.isArray(alignment?.macro?.events)
    ? alignment.macro.events.slice(0, 3)
    : [];
  const snapshots = Array.isArray(market?.snapshots) ? market.snapshots : [];
  const observed = alignment?.canonical?.observedTotal;
  return (
    <div className="decisionOverview">
      <div className="overviewHeading">
        <div>
          <span className="eyebrow">YOUR PRIVATE RESEARCH DESK</span>
          <h2>Clarity before conviction.</h2>
          <p>Observe the market. Inspect the evidence. Define the risk.</p>
        </div>
        <span className="workspaceBadge">
          <ShieldCheck size={14} /> Research only
        </span>
      </div>
      <section className="overviewHero" aria-labelledby="decision-title">
        <div className="decisionThesis">
          <span className="eyebrow">01 / DECISION BRIEF · {symbol}</span>
          <h3 id="decision-title">
            Evidence first.
            <br />
            Execution stays locked.
          </h3>
          <p>
            Scores describe research conditions, not permission to trade. Review
            missing inputs and opposing evidence before building a hypothetical
            plan.
          </p>
          <button
            className="primaryAction"
            onClick={() => onNavigate("Alignment")}
          >
            Inspect {symbol} evidence <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="decisionReadiness">
          <div className="readinessHeading">
            <Layers3 size={18} />
            <span>Evidence coverage</span>
            <strong>
              {count(observed)}
              <small> / 120</small>
            </strong>
          </div>
          <div className="coverageTrack" aria-hidden="true">
            <i
              style={{
                width:
                  typeof observed === "number" && Number.isFinite(observed)
                    ? `${Math.min(100, Math.max(0, (observed / 120) * 100))}%`
                    : "0%",
              }}
            />
          </div>
          <p>Observed factors are not independently verified factors.</p>
          <dl className="readinessFacts">
            <div>
              <dt>Research state</dt>
              <dd>{alignment?.buyState || "Awaiting assessment"}</dd>
            </div>
            <div>
              <dt>Critical checks passed</dt>
              <dd>
                {count(alignment?.criticalPassed)} /{" "}
                {count(alignment?.criticalTotal)}
              </dd>
            </div>
            <div>
              <dt>Full-market real-time coverage</dt>
              <dd>
                {health?.reliability?.consolidatedRealtimeEquities === true
                  ? "Reported available"
                  : "Not established"}
              </dd>
            </div>
            <div>
              <dt>Live execution</dt>
              <dd className="lockedStatus">Locked</dd>
            </div>
          </dl>
        </div>
      </section>
      <StudyPath onExplore={() => onNavigate("Learn")} />
      <section
        className="overviewMetrics"
        aria-label="Recorded research, not performance"
      >
        <div>
          <span>
            <Database size={15} /> Observations recorded
          </span>
          <strong>{count(health?.metrics?.observations)}</strong>
          <small>Stored evidence, not verified accuracy</small>
        </div>
        <div>
          <span>
            <CircleDot size={15} /> Forecasts recorded
          </span>
          <strong>{count(health?.metrics?.forecasts)}</strong>
          <small>Research activity, not proven results</small>
        </div>
        <div>
          <span>
            <Layers3 size={15} /> Outcomes resolved
          </span>
          <strong>{count(intelligence?.core?.resolved)}</strong>
          <small>Not a certified success rate</small>
        </div>
        <div>
          <span>
            <Clock3 size={15} /> Dashboard refresh
          </span>
          <strong className="refreshValue">
            {refreshing
              ? "Checking…"
              : lastRefresh
                ? new Date(lastRefresh).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Not checked"}
          </strong>
          <small>Refresh time is not source freshness</small>
        </div>
      </section>
      <div className="overviewColumns">
        <section className="deskPanel">
          <div className="panelHeading">
            <div>
              <span className="eyebrow">02 / MARKET OBSERVATIONS</span>
              <h3>Focus list</h3>
            </div>
            <a href="/live-board">
              Open live board <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="focusList">
            {[...new Set([symbol, "NVDA", "AMD", "PLTR"])].map((ticker) => {
              const quote = snapshots.find((s: any) => s.symbol === ticker);
              return (
                <button
                  key={ticker}
                  className="focusRow"
                  onClick={() => onSelect(ticker)}
                  aria-label={`Analyze ${ticker}`}
                >
                  <span className="tickerMark">{ticker.slice(0, 1)}</span>
                  <span className="tickerInfo">
                    <b>{ticker}</b>
                    <small>{quote?.source || "Source unavailable"}</small>
                  </span>
                  <span className="quoteValue">
                    <b>
                      {typeof quote?.price === "number" &&
                      Number.isFinite(quote.price) &&
                      quote.price > 0
                        ? quote.price.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })
                        : "Unavailable"}
                    </b>
                    <small>{observationLabel(quote?.timestamp)}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
          </div>
          <p className="panelFootnote">
            Last reported prices may be delayed or stale. No price-change or
            return is inferred.
          </p>
        </section>
        <section className="deskPanel">
          <div className="panelHeading">
            <div>
              <span className="eyebrow">03 / EVIDENCE REVIEW</span>
              <h3>What needs attention</h3>
            </div>
            <span className="neutralTag">{symbol}</span>
          </div>
          {blockers.length ? (
            <ul className="attentionList">
              {blockers.map((r: any, index: number) => (
                <li key={r.id || index}>
                  <span className="attentionDot" />
                  <div>
                    <b>{r.label || "Unnamed factor"}</b>
                    <small>
                      {r.note ||
                        r.source ||
                        "Inspect the underlying evidence before relying on this factor."}
                    </small>
                  </div>
                  <span className="neutralTag">{r.state || "Unknown"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="quietState">
              <ShieldCheck size={24} />
              <h4>
                {alignment
                  ? "Open the full assessment"
                  : "Assessment not available yet"}
              </h4>
              <p>
                {alignment
                  ? "No unresolved factors are listed here. This does not establish certification or trading readiness."
                  : "An absent response is not a passing check. Use the evidence workspace to inspect source availability."}
              </p>
            </div>
          )}
          <button
            className="textAction"
            onClick={() => onNavigate("Alignment")}
          >
            View all factors and safeguards <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <section className="workflowStrip" aria-label="Decision workflow">
        {[
          {
            n: "01",
            label: "Observe",
            text: "Sources & market context",
            href: "/live-board",
          },
          {
            n: "02",
            label: "Verify",
            text: "Evidence & limitations",
            href: "/research-lab",
          },
          {
            n: "03",
            label: "Plan",
            text: "Hypothetical risk only",
            section: "Trade",
          },
          {
            n: "04",
            label: "Review",
            text: "Recorded research",
            section: "Journal",
          },
        ].map((step) => {
          const content = (
            <>
              <span>{step.n}</span>
              <div>
                <b>{step.label}</b>
                <small>{step.text}</small>
              </div>
              <ArrowUpRight size={17} />
            </>
          );
          return step.href ? (
            <a key={step.n} href={step.href}>
              {content}
            </a>
          ) : (
            <button key={step.n} onClick={() => onNavigate(step.section!)}>
              {content}
            </button>
          );
        })}
      </section>
      <div className="overviewColumns">
        <section className="deskPanel">
          <div className="panelHeading">
            <div>
              <span className="eyebrow">SOURCE INTEGRITY</span>
              <h3>Know what you’re reading</h3>
            </div>
            <a href="/operations">
              Operations <ArrowUpRight size={15} />
            </a>
          </div>
          {sources.length ? (
            <div className="sourceOverview">
              {sources.map((source: any) => (
                <div key={source.id}>
                  <b>{source.label || source.id}</b>
                  <span>{source.freshness || "Unknown freshness"}</span>
                  <span className="neutralTag">
                    {source.decisionGrade === true
                      ? "Provider check passed"
                      : "Limited / unverified"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="quietState">
              <Database size={24} />
              <h4>Source report unavailable</h4>
              <p>
                No connection, freshness or completeness claim can be made until
                the report arrives.
              </p>
            </div>
          )}
          <p className="panelFootnote">
            Provider checks do not establish independent scientific validation.{" "}
            <a href="/knowledge-graph">Inspect source lineage</a>.
          </p>
        </section>
        <section className="deskPanel">
          <div className="panelHeading">
            <div>
              <span className="eyebrow">RESEARCH CONTEXT</span>
              <h3>On the calendar</h3>
            </div>
          </div>
          {events.length ? (
            <ul className="eventOverview">
              {events.map((event: any, index: number) => (
                <li key={event.uid || index}>
                  <span>
                    {event.date || "Date pending"}
                    <small>{event.time || "Time pending"}</small>
                  </span>
                  <b>{event.summary}</b>
                </li>
              ))}
            </ul>
          ) : (
            <div className="quietState">
              <Clock3 size={24} />
              <h4>No calendar response</h4>
              <p>
                This does not mean there are no upcoming events. Check the
                underlying calendar before making assumptions.
              </p>
            </div>
          )}
          <a className="textAction" href="/week-one">
            Build your research routine <ArrowRight size={16} />
          </a>
        </section>
      </div>
    </div>
  );
}
