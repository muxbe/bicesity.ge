export type ReportDateRangeInput = {
  startDate: string;
  endDate: string;
};

export type AppliedReportDateRange = ReportDateRangeInput & {
  startIso: string;
  endIsoExclusive: string;
  dayCount: number;
  label: string;
};

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid report date.");
  }
  return parsed;
}

function addDays(date: Date, days: number) {
  const next = cloneDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function buildDefaultReportDateRange(now = new Date()): ReportDateRangeInput {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const start = addDays(today, -29);
  return {
    startDate: dateInputValue(start),
    endDate: dateInputValue(today),
  };
}

export function buildPreviousReportDateRange(
  currentRange: AppliedReportDateRange,
  now = new Date()
): AppliedReportDateRange {
  const currentStart = parseDateInput(currentRange.startDate);
  const previousStart = addDays(currentStart, -currentRange.dayCount);
  const previousEnd = addDays(currentStart, -1);

  return resolveReportDateRange(
    {
      startDate: dateInputValue(previousStart),
      endDate: dateInputValue(previousEnd),
    },
    now
  );
}

export function resolveReportDateRange(
  input: Partial<ReportDateRangeInput> | undefined,
  now = new Date()
): AppliedReportDateRange {
  const fallback = buildDefaultReportDateRange(now);
  const startDate = input?.startDate?.trim() || fallback.startDate;
  const endDate = input?.endDate?.trim() || fallback.endDate;
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);

  if (end < start) {
    throw new Error("End date must be on or after start date.");
  }

  const endExclusive = addDays(end, 1);
  const dayCount = Math.max(
    1,
    Math.round((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    startDate,
    endDate,
    startIso: start.toISOString(),
    endIsoExclusive: endExclusive.toISOString(),
    dayCount,
    label:
      startDate === endDate
        ? formatDisplayDate(startDate)
        : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`,
  };
}
