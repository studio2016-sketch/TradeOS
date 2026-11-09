export const RESEARCH_PANELS = {
  models: { label: "Chronological forecast validation", url: "/api/model-validation" },
  factors: { label: "Factor evidence", url: "/api/factor-lab" },
  ledger: { label: "Prediction–Outcome Scientific Ledger", url: "/api/prediction-outcome-ledger" },
  certification: { label: "Certification authority", url: "/api/research-certification" },
} as const;

export type ResearchPanelKey = keyof typeof RESEARCH_PANELS;
export type ResearchPanelState = {
  // Payloads retain the existing API contract. Load metadata is client-only.
  data: Record<string, any> | null;
  loading: boolean;
  error: string | null;
  lastSuccessAt: number | null;
};
export type ResearchPanels = Record<ResearchPanelKey, ResearchPanelState>;

const keys = Object.keys(RESEARCH_PANELS) as ResearchPanelKey[];

type Check = (value: unknown) => boolean;
const text: Check = value => typeof value === "string";
const boolean: Check = value => typeof value === "boolean";
const scalar: Check = value => value == null || ["string", "number", "boolean"].includes(typeof value);
const optional = (check: Check): Check => value => value == null || check(value);
const count: Check = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const measurement: Check = value => typeof value === "number" && Number.isFinite(value);
const list = (check: Check): Check => value => Array.isArray(value) && value.every(check);
const object = (shape: Record<string, Check>): Check => value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  return Object.entries(shape).every(([key, check]) => check(fields[key]));
};

// This only checks the response contract; it cannot certify evidence or authorize trading.
const certificationResponse: Check = value => {
  if (!object({
    status: text, modelPromotionAllowed: boolean, liveExecutionAllowed: boolean,
    checks: list(object({ id: text, pass: boolean, detail: scalar })),
  })(value)) return false;
  const result = value as Record<string, any>;
  if (!["BLOCKED", "RESEARCH_ONLY", "INDEPENDENTLY_VALIDATED"].includes(result.status)
    || result.liveExecutionAllowed !== false) return false;
  if (result.modelPromotionAllowed) {
    return result.status === "INDEPENDENTLY_VALIDATED" && result.certified === true
      && result.checks.length > 0 && result.checks.every((check: any) => check.pass === true);
  }
  return result.status !== "INDEPENDENTLY_VALIDATED" && result.certified !== true;
};

// Validate the containers and fields rendered by the page, not scientific validity.
// A malformed successful HTTP response must stay local to its dataset, too.
const datasetChecks: Record<ResearchPanelKey, Check> = {
  models: object({
    certification: scalar,
    validations: list(object({
      modelAndHorizon: text, sampleCount: optional(count), trainCount: optional(count), holdoutCount: optional(count),
      warnings: optional(list(text)),
    })),
  }),
  factors: object({
    status: scalar, registryCount: optional(count),
    pointInTimeEvidence: optional(object({ forecasts: optional(count), rows: optional(count) })),
    associations: list(object({
      label: text, recorded: optional(count), holdout: optional(count), highCount: optional(count), lowCount: optional(count),
    })),
    historicalDiscovery: optional(object({
      testedFamilySize: optional(count), multiplicityMethod: scalar,
      findings: optional(list(object({
        label: text, status: text, direction: scalar,
        observations: optional(count), sessions: optional(count), symbols: optional(count),
      }))),
    })),
    factorDependence: optional(object({
      pairs: optional(list(object({
        first: text, second: text, pearsonR: optional(measurement), paired: optional(count), status: scalar,
      }))),
    })),
  }),
  ledger: object({
    rule: object({ version: scalar, fingerprint: optional(text) }),
    summary: object(Object.fromEntries([
      "uniqueMarketTests", "passes", "failures", "voids", "unresolved", "prospectiveScientificRecords",
      "prospectiveScientificPasses", "prospectiveScientificFailures", "sessions", "fingerprintedScientificRecords",
    ].map(key => [key, optional(count)]))),
    scientificPolicy: scalar,
    recent: list(object({
      id: scalar, verdict: text, symbol: text, horizon: text, forecastAt: text, evidenceClass: text,
      scientificallyEligible: boolean,
    })),
    prospectiveFactorAssociations: optional(object({
      findings: optional(list(object({ label: text, observations: optional(count), sessions: optional(count), status: text }))),
    })),
  }),
  certification: certificationResponse,
};

export function initialResearchPanels(): ResearchPanels {
  return Object.fromEntries(keys.map(key => [key, {
    data: null, loading: false, error: null, lastSuccessAt: null,
  }])) as ResearchPanels;
}

export function researchPanelStatus(panel: ResearchPanelState): string {
  if (panel.loading) return panel.data
    ? "Rechecking. Showing the last successful response until this check finishes."
    : "Loading. No successful response yet.";
  if (panel.error) return panel.data
    ? "STALE: recheck failed. Showing the last successful response."
    : "UNAVAILABLE: no successful response yet.";
  return panel.data ? "Latest request succeeded." : "Not loaded yet.";
}

/** A loaded payload is not permission to promote a model or execute a trade. */
export function hasCurrentResearchResponse(panel: ResearchPanelState): boolean {
  return panel.data !== null && !panel.loading && panel.error === null;
}

/** Isolates reads only. It does not change any backend evidence or certification gate. */
export function createResearchPanelLoader(
  onChange: (panels: ResearchPanels) => void,
  options: { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 30_000;
  let panels = initialResearchPanels();
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  const controllers = new Set<AbortController>();

  function update(key: ResearchPanelKey, changes: Partial<ResearchPanelState>) {
    panels = { ...panels, [key]: { ...panels[key], ...changes } };
    onChange(panels);
  }

  async function loadPanel(key: ResearchPanelKey, requestGeneration: number) {
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    let rejectAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error(timedOut
        ? "Request timed out. Recheck to retry."
        : "Request cancelled."));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
    });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const data = await Promise.race([
        (async () => {
          const response = await fetcher(RESEARCH_PANELS[key].url, {
            cache: "no-store", signal: controller.signal,
          });
          if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}). Recheck to retry.`);
          const value = await response.json();
          if (!value || typeof value !== "object" || Array.isArray(value)
            || value.status === "UNAVAILABLE" || "error" in value || !datasetChecks[key](value)) {
            throw new Error("The endpoint did not return a research dataset. Recheck to retry.");
          }
          return value as Record<string, any>;
        })(),
        aborted,
      ]);
      if (requestGeneration === generation) {
        update(key, { data, loading: false, error: null, lastSuccessAt: now() });
      }
    } catch (error) {
      if (requestGeneration === generation) {
        update(key, {
          loading: false,
          error: error instanceof Error ? error.message : "Request failed. Recheck to retry.",
        });
      }
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", rejectAbort);
      controllers.delete(controller);
    }
  }

  function refresh(): Promise<void> {
    // The synchronous guard also catches clicks before React disables the button.
    if (inFlight) return inFlight;
    const requestGeneration = ++generation;
    panels = Object.fromEntries(keys.map(key => [key, {
      ...panels[key], loading: true, error: null,
    }])) as ResearchPanels;
    const work = Promise.all(keys.map(key => loadPanel(key, requestGeneration))).then(() => {});
    const active = work.finally(() => {
      if (inFlight === active) inFlight = null;
    });
    inFlight = active;
    onChange(panels);
    return active;
  }

  function cancel() {
    // Invalidate first: even a fetcher that ignores abort cannot update a new view.
    generation++;
    inFlight = null;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  return { refresh, cancel };
}

