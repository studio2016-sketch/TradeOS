/** Standalone mathematical reference, not independent certification. */
export interface ReferenceClose { t: string; c: number }
export interface ReferenceRiskStatistics {
  beta: number | null;
  correlation: number | null;
  sampleCount: number;
  observedAt: string;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`Nonfinite ${label}`);
  return value;
}

/** Accept ISO calendar dates or ISO timestamps with an explicit UTC offset. */
function timestamp(value: string): { milliseconds: number; day: string } {
  if (typeof value !== 'string') throw new Error('Invalid timestamp');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) throw new Error('Invalid ISO timestamp');
  const [, y, m, d, h, minute, second, , zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || (h !== undefined && (Number(h) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59))
    || (zone && zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) {
    throw new Error('Invalid timestamp calendar or clock');
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('Invalid timestamp');
  return { milliseconds, day: new Date(milliseconds).toISOString().slice(0, 10) };
}

/** Online Welford co-moments over paired simple returns. Inputs are never mutated. */
export function calculateReferenceRiskStatistics(
  own: readonly ReferenceClose[], benchmark: readonly ReferenceClose[], sessions: 20 | 60,
): ReferenceRiskStatistics {
  if (sessions !== 20 && sessions !== 60) throw new Error('Sessions must be 20 or 60');
  if (!Array.isArray(own) || !Array.isArray(benchmark)
    || own.length !== sessions + 1 || benchmark.length !== sessions + 1) {
    throw new Error('Require exactly sessions + 1 paired closes');
  }
  let previousDay = '';
  let observedAtMilliseconds = -Infinity;
  for (let i = 0; i <= sessions; i++) {
    const a = own[i], b = benchmark[i];
    if (!a || !b || !Number.isFinite(a.c) || !Number.isFinite(b.c) || a.c <= 0 || b.c <= 0) {
      throw new Error('Closes must be finite and positive');
    }
    const at = timestamp(a.t), bt = timestamp(b.t);
    if (at.day !== bt.day) throw new Error('Unpaired UTC dates');
    if (at.day <= previousDay) throw new Error('Dates must be strictly increasing with no duplicates');
    previousDay = at.day;
    if (i === sessions) observedAtMilliseconds = Math.max(at.milliseconds, bt.milliseconds);
  }
  let meanOwn = 0, meanBenchmark = 0, m2Own = 0, m2Benchmark = 0, coMoment = 0;
  for (let i = 1; i <= sessions; i++) {
    const x = finite(own[i].c / own[i - 1].c - 1, 'own return');
    const y = finite(benchmark[i].c / benchmark[i - 1].c - 1, 'benchmark return');
    const dx = finite(x - meanOwn, 'own delta');
    const dy = finite(y - meanBenchmark, 'benchmark delta');
    meanOwn = finite(meanOwn + dx / i, 'own mean');
    meanBenchmark = finite(meanBenchmark + dy / i, 'benchmark mean');
    m2Own = finite(m2Own + dx * (x - meanOwn), 'own co-moment');
    m2Benchmark = finite(m2Benchmark + dy * (y - meanBenchmark), 'benchmark co-moment');
    coMoment = finite(coMoment + dx * (y - meanBenchmark), 'cross co-moment');
  }
  if (m2Own < 0 || m2Benchmark < 0) throw new Error('Invalid negative second moment');
  const covariance = finite(coMoment / (sessions - 1), 'sample covariance');
  const ownVariance = finite(m2Own / (sessions - 1), 'own sample variance');
  const benchmarkVariance = finite(m2Benchmark / (sessions - 1), 'benchmark sample variance');
  const beta = benchmarkVariance === 0 ? null : finite(covariance / benchmarkVariance, 'beta');
  // Divide by each SD separately to avoid overflowing a product of variances.
  const correlation = ownVariance === 0 || benchmarkVariance === 0 ? null
    : finite(covariance / Math.sqrt(ownVariance) / Math.sqrt(benchmarkVariance), 'correlation');
  if (correlation !== null && Math.abs(correlation) > 1 + 1e-12) throw new Error('Invalid correlation');
  return {
    beta, correlation: correlation === null ? null : Math.max(-1, Math.min(1, correlation)),
    sampleCount: sessions, observedAt: new Date(observedAtMilliseconds).toISOString(),
  };
}
