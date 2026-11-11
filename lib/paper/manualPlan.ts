/** Manual, long-only, USD arithmetic. No quotes, broker, storage or execution. */
export type ManualPlanInputs = {
  equity: string;
  riskPercent: string;
  entry: string;
  stop: string;
  target: string;
};
export type ManualPlanField = keyof ManualPlanInputs;
export const EMPTY_MANUAL_PLAN: ManualPlanInputs = {
  equity: "", riskPercent: "", entry: "", stop: "", target: "",
};
export const MAX_MANUAL_SHARES = 100_000;
export const MAX_SESSION_DRAFTS = 20;
const ZERO = BigInt(0), HUNDRED = BigInt(100), SCALE = BigInt(10_000);
const FIELD_RULES: Record<ManualPlanField, { label: string; places: number; max: number }> = {
  equity: { label: "Hypothetical equity", places: 2, max: 1_000_000_000 },
  riskPercent: { label: "Risk percentage", places: 4, max: 100 },
  entry: { label: "Entry", places: 4, max: 1_000_000 },
  stop: { label: "Stop", places: 4, max: 1_000_000 },
  target: { label: "Target", places: 4, max: 1_000_000 },
};
export const MANUAL_PLAN_FIELDS = Object.keys(FIELD_RULES) as ManualPlanField[];
const SCOPE = {
  source: "manual_hypothetical" as const,
  paperOnly: true as const,
  liveAuthorized: false as const,
  fillSimulated: false as const,
  certified: false as const,
};
type Scope = typeof SCOPE;
export type ManualPlanNumbers = {
  shares: number;
  riskBudget: string;
  riskPerShare: string;
  notional: string;
  plannedStopLoss: string;
  targetGain: string;
  remainingEquity: string;
  rewardToRisk: string;
  limitingFactors: string[];
};
export type ManualPlanResult = Scope & (
  | { status: "incomplete" | "invalid"; errors: Partial<Record<ManualPlanField, string>>; plan: null }
  | { status: "sized" | "zero_shares"; errors: Partial<Record<ManualPlanField, string>>; plan: ManualPlanNumbers }
);

/** Decimal parsing deliberately rejects exponents, separators and coercible objects. */
function parseUnits(value: string, places: number): bigint | null {
  const text = value.trim();
  if (text.length > 24 || !new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));
}

/** Retain sub-cent amounts; never label a small nonzero planned loss as $0.00. */
function dollars(units: bigint): string {
  const whole = units / SCALE;
  const fraction = (units % SCALE).toString().padStart(4, "0");
  return `${whole}.${fraction.slice(0, 2)}${fraction.slice(2).replace(/0+$/, "")}`;
}

export function calculateManualPlan(input: unknown): ManualPlanResult {
  const errors: Partial<Record<ManualPlanField, string>> = {};
  const values = {} as Record<ManualPlanField, bigint>;
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  let missing = false, invalid = false;
  for (const field of MANUAL_PLAN_FIELDS) {
    const rule = FIELD_RULES[field], raw = record[field];
    if (typeof raw !== "string") {
      errors[field] = `${rule.label} must be entered as a decimal number.`;
      invalid = true;
      continue;
    }
    if (!raw.trim()) {
      errors[field] = `Enter ${rule.label.toLowerCase()}.`;
      missing = true;
      continue;
    }
    const units = parseUnits(raw, rule.places);
    if (units === null || units <= ZERO || units > BigInt(rule.max) * SCALE) {
      errors[field] = `${rule.label} must be greater than 0, no more than ${rule.max}, with at most ${rule.places} decimal places. Use a dot, without commas or exponents.`;
      invalid = true;
      continue;
    }
    values[field] = units;
  }
  if (invalid || missing) return { ...SCOPE, status: invalid ? "invalid" : "incomplete", errors, plan: null };
  if (values.stop >= values.entry) errors.stop = "For this long-only plan, stop must be below entry.";
  if (values.target <= values.entry) errors.target = "For this long-only plan, target must be above entry.";
  if (Object.keys(errors).length) return { ...SCOPE, status: "invalid", errors, plan: null };

  // Equity is in ten-thousandths of a dollar, riskPercent in ten-thousandths
  // of one percent. Floor the budget to whole cents before sizing.
  const riskBudget = (values.equity * values.riskPercent / (HUNDRED * SCALE * HUNDRED)) * HUNDRED;
  const riskPerShare = values.entry - values.stop;
  const riskShares = riskBudget / riskPerShare;
  const cashShares = values.equity / values.entry;
  const cap = BigInt(MAX_MANUAL_SHARES);
  const shares = [riskShares, cashShares, cap].reduce((a, b) => a < b ? a : b);
  const limitingFactors: string[] = [];
  if (shares === riskShares) limitingFactors.push("Chosen risk budget");
  if (shares === cashShares) limitingFactors.push("Hypothetical equity (no borrowing)");
  if (shares === cap) limitingFactors.push("100,000-share calculator limit");
  return {
    ...SCOPE,
    status: shares > ZERO ? "sized" : "zero_shares",
    errors: {},
    plan: {
      shares: Number(shares),
      riskBudget: dollars(riskBudget),
      riskPerShare: dollars(riskPerShare),
      notional: dollars(shares * values.entry),
      plannedStopLoss: dollars(shares * riskPerShare),
      targetGain: dollars(shares * (values.target - values.entry)),
      remainingEquity: dollars(values.equity - shares * values.entry),
      rewardToRisk: String(Number((Number(values.target - values.entry) / Number(riskPerShare)).toPrecision(6))),
      limitingFactors,
    },
  };
}

export type SessionDraft = {
  key: string;
  inputs: ManualPlanInputs;
  plan: ManualPlanNumbers;
};
/** A copied arithmetic snapshot, not a trade, execution or performance record. */
export function createSessionDraft(inputs: ManualPlanInputs): SessionDraft | null {
  const result = calculateManualPlan(inputs);
  if (result.status !== "sized" || !result.plan) return null;
  const normalized = Object.fromEntries(MANUAL_PLAN_FIELDS.map(field => [
    field, dollars(parseUnits(inputs[field], FIELD_RULES[field].places)!),
  ])) as ManualPlanInputs;
  return {
    key: MANUAL_PLAN_FIELDS.map(field => normalized[field]).join("|"),
    inputs: normalized,
    plan: { ...result.plan, limitingFactors: [...result.plan.limitingFactors] },
  };
}

export function addSessionDraft(drafts: SessionDraft[], inputs: ManualPlanInputs): SessionDraft[] {
  const draft = createSessionDraft(inputs);
  if (!draft || drafts.length >= MAX_SESSION_DRAFTS || drafts.some(item => item.key === draft.key)) return drafts;
  return [...drafts, draft];
}
