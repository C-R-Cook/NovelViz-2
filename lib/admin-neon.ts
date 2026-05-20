import { buildDailySeries, formatDayKeyUtc, formatUsd, utcStartOfCalendarDay } from "@/lib/costs";

const NEON_API = "https://console.neon.tech/api/v2";

const METRICS = [
  "compute_unit_seconds",
  "root_branch_bytes_month",
  "child_branch_bytes_month",
  "instant_restore_bytes_month",
  "snapshot_storage_bytes_month",
  "public_network_transfer_bytes",
  "private_network_transfer_bytes",
  "extra_branches_month",
] as const;

/** Launch plan list rates — estimate only; see neon.com/docs/introduction/plans */
const LAUNCH_RATES = {
  computePerCuHr: 0.106,
  storagePerGbMo: 0.35,
  instantRestorePerGbMo: 0.2,
  snapshotPerGbMo: 0.09,
  publicTransferPerGb: 0.1,
  publicTransferAllowanceGb: 100,
  privateTransferPerGb: 0.01,
};

const BYTES_PER_GB = 1_000_000_000;
const HOURS_PER_BILLING_MONTH = 744;

export type NeonStorageBreakdownGbMonths = {
  root: number;
  child: number;
  instantRestore: number;
  snapshot: number;
};

export type NeonDailyUsagePoint = {
  date: string;
  computeHours: number;
  /** Total storage (all branch types), daily average GB. */
  storageGbAvg: number;
  rootStorageGbAvg: number;
  childStorageGbAvg: number;
  instantRestoreGbAvg: number;
  snapshotStorageGbAvg: number;
  publicTransferGb: number;
  privateTransferGb: number;
  /** Branch-hours in this daily bucket (extra branches beyond plan allowance). */
  extraBranchHours: number;
};

export type NeonVendorSnapshot = {
  projectId: string;
  projectName: string | null;
  /** Days requested in the admin stats window (may exceed Neon daily API cap). */
  windowDays: number;
  /** Days actually returned from the consumption API (daily granularity max 60). */
  apiDays: number;
  computeHours: number;
  /** Root branch storage (daily avg GB) on the last day in the chart window. */
  databaseSizeGb: number;
  /** UTC date key (`YYYY-MM-DD`) for `databaseSizeGb`. */
  databaseSizeAsOf: string | null;
  storageGbMonths: number;
  /** Period average total storage (all branch types), daily avg GB. */
  storageGbAvg: number;
  storageBreakdownGbMonths: NeonStorageBreakdownGbMonths;
  publicTransferGb: number;
  privateTransferGb: number;
  extraBranchMonths: number;
  estimatedCostUsd: number;
  estimatedCostFormatted: string;
  daily: NeonDailyUsagePoint[];
};

type NeonProject = {
  id: string;
  org_id: string;
  name: string;
};

type NeonConsumptionMetric = {
  metric_name: string;
  value: number;
};

type NeonConsumptionBucket = {
  timeframe_start: string;
  metrics?: NeonConsumptionMetric[];
};

type NeonConsumptionResponse = {
  projects?: Array<{
    project_id: string;
    periods?: Array<{
      consumption?: NeonConsumptionBucket[];
    }>;
  }>;
};

function neonApiKey(): string | null {
  return process.env.NEON_API_KEY?.trim() || null;
}

function neonHostProjectRef(databaseUrl: string | undefined): string | null {
  if (!databaseUrl?.trim()) return null;
  try {
    const normalized = databaseUrl.replace(/^postgres:\/\//, "postgresql://");
    const host = new URL(normalized).hostname;
    const m = host.match(/^ep-([^.]+)\./);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function neonFetch(path: string, searchParams?: URLSearchParams): Promise<Response> {
  const key = neonApiKey();
  if (!key) throw new Error("NEON_API_KEY is not set");
  const url = new URL(`${NEON_API}${path}`);
  if (searchParams) {
    searchParams.forEach((value, name) => url.searchParams.set(name, value));
  }
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
}

async function getNeonProject(projectId: string): Promise<NeonProject | null> {
  const res = await neonFetch(`/projects/${encodeURIComponent(projectId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Neon project ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { project?: NeonProject };
  return body.project ?? null;
}

async function listNeonOrganizations(): Promise<Array<{ id: string; name: string }>> {
  const res = await neonFetch("/users/me/organizations");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Neon organizations ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    organizations?: Array<{ id: string; name: string }>;
  };
  return body.organizations ?? [];
}

async function listNeonProjects(orgId: string): Promise<NeonProject[]> {
  const all: NeonProject[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "100", org_id: orgId });
    if (cursor) params.set("cursor", cursor);
    const res = await neonFetch("/projects", params);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Neon projects ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      projects?: NeonProject[];
      pagination?: { cursor?: string };
    };
    const batch = body.projects ?? [];
    all.push(...batch);
    cursor = body.pagination?.cursor;
    if (!cursor || batch.length === 0) break;
  }
  return all;
}

function matchProjectByHostRef(projects: NeonProject[], hostRef: string): NeonProject | undefined {
  return projects.find(
    (p) =>
      p.id === hostRef ||
      p.id.startsWith(`${hostRef}-`) ||
      hostRef.startsWith(p.id) ||
      p.name.toLowerCase().replace(/\s+/g, "-") === hostRef,
  );
}

async function resolveNeonOrgIds(): Promise<{ orgIds: string[]; error?: string }> {
  const explicitOrg = process.env.NEON_ORG_ID?.trim();
  if (explicitOrg) return { orgIds: [explicitOrg] };

  const orgs = await listNeonOrganizations();
  if (orgs.length === 0) {
    return {
      orgIds: [],
      error: "No Neon organizations found. Set NEON_ORG_ID in .env.local (Console → Organization settings).",
    };
  }
  if (orgs.length === 1) return { orgIds: [orgs[0]!.id] };
  return {
    orgIds: orgs.map((o) => o.id),
  };
}

async function resolveNeonProject(): Promise<
  { project: NeonProject } | { error: string }
> {
  const explicitId = process.env.NEON_PROJECT_ID?.trim();
  const explicitOrg = process.env.NEON_ORG_ID?.trim();
  const hostRef = neonHostProjectRef(process.env.DATABASE_URL);

  if (explicitId) {
    const project = await getNeonProject(explicitId);
    if (!project) {
      return { error: `NEON_PROJECT_ID "${explicitId}" was not found for this API key.` };
    }
    if (explicitOrg && project.org_id !== explicitOrg) {
      return {
        error: `NEON_ORG_ID does not match project org (${project.org_id}).`,
      };
    }
    return { project };
  }

  if (hostRef) {
    const project = await getNeonProject(hostRef);
    if (project) return { project };
  }

  const { orgIds, error: orgError } = await resolveNeonOrgIds();
  if (orgIds.length === 0) {
    return { error: orgError ?? "Could not resolve Neon organization." };
  }

  const allProjects: NeonProject[] = [];
  for (const orgId of orgIds) {
    allProjects.push(...(await listNeonProjects(orgId)));
  }

  if (allProjects.length === 0) {
    return { error: "No Neon projects found for this API key." };
  }

  if (hostRef) {
    const match = matchProjectByHostRef(allProjects, hostRef);
    if (match) return { project: match };
  }

  if (allProjects.length === 1) {
    return { project: allProjects[0]! };
  }

  if (orgIds.length > 1 && !explicitOrg) {
    return {
      error:
        "Multiple Neon organizations found. Set NEON_ORG_ID and NEON_PROJECT_ID in .env.local.",
    };
  }

  return {
    error:
      "Could not match DATABASE_URL to a Neon project. Set NEON_PROJECT_ID in .env.local (Console → Project Settings).",
  };
}

function metricValue(metrics: NeonConsumptionMetric[] | undefined, name: string): number {
  const row = metrics?.find((m) => m.metric_name === name);
  return typeof row?.value === "number" && Number.isFinite(row.value) ? row.value : 0;
}

function storageByteHours(metrics: NeonConsumptionMetric[] | undefined): number {
  return (
    metricValue(metrics, "root_branch_bytes_month") +
    metricValue(metrics, "child_branch_bytes_month") +
    metricValue(metrics, "instant_restore_bytes_month") +
    metricValue(metrics, "snapshot_storage_bytes_month")
  );
}

function byteHoursToDailyGbAvg(byteHours: number): number {
  return byteHours / 24 / BYTES_PER_GB;
}

function byteHoursToGbMonths(byteHours: number): number {
  return byteHours / HOURS_PER_BILLING_MONTH / BYTES_PER_GB;
}

function addToDayMap(map: Map<string, number>, dayKey: string, delta: number): void {
  map.set(dayKey, (map.get(dayKey) ?? 0) + delta);
}

function estimateLaunchCostUsd(totals: {
  computeUnitSeconds: number;
  rootByteHours: number;
  childByteHours: number;
  instantRestoreByteHours: number;
  snapshotByteHours: number;
  publicTransferBytes: number;
  privateTransferBytes: number;
}): number {
  const computeUsd = (totals.computeUnitSeconds / 3600) * LAUNCH_RATES.computePerCuHr;
  const storageUsd =
    (totals.rootByteHours / HOURS_PER_BILLING_MONTH / BYTES_PER_GB) * LAUNCH_RATES.storagePerGbMo +
    (totals.childByteHours / HOURS_PER_BILLING_MONTH / BYTES_PER_GB) * LAUNCH_RATES.storagePerGbMo +
    (totals.instantRestoreByteHours / HOURS_PER_BILLING_MONTH / BYTES_PER_GB) *
      LAUNCH_RATES.instantRestorePerGbMo +
    (totals.snapshotByteHours / HOURS_PER_BILLING_MONTH / BYTES_PER_GB) * LAUNCH_RATES.snapshotPerGbMo;
  const publicGb = totals.publicTransferBytes / BYTES_PER_GB;
  const publicUsd =
    Math.max(0, publicGb - LAUNCH_RATES.publicTransferAllowanceGb) * LAUNCH_RATES.publicTransferPerGb;
  const privateUsd = (totals.privateTransferBytes / BYTES_PER_GB) * LAUNCH_RATES.privateTransferPerGb;
  return computeUsd + storageUsd + publicUsd + privateUsd;
}

export async function fetchNeonVendorSnapshot(
  rangeStartInclusiveUtc: Date,
  rangeEndInclusiveUtc: Date,
  windowDays: number,
): Promise<{ snapshot: NeonVendorSnapshot | null; errorMessage: string | null }> {
  if (!neonApiKey()) {
    return {
      snapshot: null,
      errorMessage: "Add NEON_API_KEY to .env.local and restart the dev server.",
    };
  }

  try {
    const resolved = await resolveNeonProject();
    if ("error" in resolved) {
      return { snapshot: null, errorMessage: resolved.error };
    }
    const { project } = resolved;

    const apiDays = Math.min(windowDays, 60);
    const chartEnd = utcStartOfCalendarDay(rangeEndInclusiveUtc);
    let chartStart = utcStartOfCalendarDay(rangeStartInclusiveUtc);
    if (windowDays > 60) {
      chartStart = new Date(chartEnd.getTime());
      chartStart.setUTCDate(chartStart.getUTCDate() - (apiDays - 1));
    }
    const from = chartStart.toISOString();
    const to = new Date(chartEnd.getTime() + 86_400_000).toISOString();

    const params = new URLSearchParams({
      org_id: project.org_id,
      from,
      to,
      granularity: "daily",
      limit: "10",
      project_ids: project.id,
      metrics: METRICS.join(","),
    });

    const res = await neonFetch("/consumption_history/v2/projects", params);
    if (res.status === 403) {
      return {
        snapshot: null,
        errorMessage:
          "Neon consumption API requires a Launch (or higher) plan. Free plan projects cannot use this endpoint.",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Neon consumption ${res.status}: ${text.slice(0, 300)}`);
    }

    const body = (await res.json()) as NeonConsumptionResponse;
    const projectRow = body.projects?.find((p) => p.project_id === project.id) ?? body.projects?.[0];
    const buckets =
      projectRow?.periods?.flatMap((period) => period.consumption ?? []) ?? [];

    const computeByDay = new Map<string, number>();
    const storageAvgByDay = new Map<string, number>();
    const rootAvgByDay = new Map<string, number>();
    const childAvgByDay = new Map<string, number>();
    const pitrAvgByDay = new Map<string, number>();
    const snapshotAvgByDay = new Map<string, number>();
    const publicByDay = new Map<string, number>();
    const privateByDay = new Map<string, number>();
    const extraBranchByDay = new Map<string, number>();

    let computeUnitSeconds = 0;
    let rootByteHours = 0;
    let childByteHours = 0;
    let instantRestoreByteHours = 0;
    let snapshotByteHours = 0;
    let publicTransferBytes = 0;
    let privateTransferBytes = 0;
    let extraBranchHours = 0;
    let storageByteHoursSum = 0;

    for (const bucket of buckets) {
      const dayKey = formatDayKeyUtc(new Date(bucket.timeframe_start));
      const metrics = bucket.metrics ?? [];
      const cuSec = metricValue(metrics, "compute_unit_seconds");
      const rootBh = metricValue(metrics, "root_branch_bytes_month");
      const childBh = metricValue(metrics, "child_branch_bytes_month");
      const pitrBh = metricValue(metrics, "instant_restore_bytes_month");
      const snapshotBh = metricValue(metrics, "snapshot_storage_bytes_month");
      const storageBh = rootBh + childBh + pitrBh + snapshotBh;
      const pub = metricValue(metrics, "public_network_transfer_bytes");
      const priv = metricValue(metrics, "private_network_transfer_bytes");
      const extraBh = metricValue(metrics, "extra_branches_month");

      computeUnitSeconds += cuSec;
      rootByteHours += rootBh;
      childByteHours += childBh;
      instantRestoreByteHours += pitrBh;
      snapshotByteHours += snapshotBh;
      publicTransferBytes += pub;
      privateTransferBytes += priv;
      extraBranchHours += extraBh;
      storageByteHoursSum += storageBh;

      addToDayMap(computeByDay, dayKey, cuSec / 3600);
      addToDayMap(storageAvgByDay, dayKey, byteHoursToDailyGbAvg(storageBh));
      addToDayMap(rootAvgByDay, dayKey, byteHoursToDailyGbAvg(rootBh));
      addToDayMap(childAvgByDay, dayKey, byteHoursToDailyGbAvg(childBh));
      addToDayMap(pitrAvgByDay, dayKey, byteHoursToDailyGbAvg(pitrBh));
      addToDayMap(snapshotAvgByDay, dayKey, byteHoursToDailyGbAvg(snapshotBh));
      addToDayMap(publicByDay, dayKey, pub / BYTES_PER_GB);
      addToDayMap(privateByDay, dayKey, priv / BYTES_PER_GB);
      addToDayMap(extraBranchByDay, dayKey, extraBh);
    }

    const dailyCompute = buildDailySeries(chartStart, chartEnd, computeByDay);
    const daily: NeonDailyUsagePoint[] = dailyCompute.map((row) => ({
      date: row.date,
      computeHours: row.count,
      storageGbAvg: storageAvgByDay.get(row.date) ?? 0,
      rootStorageGbAvg: rootAvgByDay.get(row.date) ?? 0,
      childStorageGbAvg: childAvgByDay.get(row.date) ?? 0,
      instantRestoreGbAvg: pitrAvgByDay.get(row.date) ?? 0,
      snapshotStorageGbAvg: snapshotAvgByDay.get(row.date) ?? 0,
      publicTransferGb: publicByDay.get(row.date) ?? 0,
      privateTransferGb: privateByDay.get(row.date) ?? 0,
      extraBranchHours: extraBranchByDay.get(row.date) ?? 0,
    }));

    const dayCount = Math.max(1, buckets.length);
    const storageGbMonths = storageByteHoursSum / HOURS_PER_BILLING_MONTH / BYTES_PER_GB;
    const storageGbAvg = storageByteHoursSum / dayCount / 24 / BYTES_PER_GB;
    const latestDay = daily.length > 0 ? daily[daily.length - 1]! : null;
    const databaseSizeGb = latestDay?.rootStorageGbAvg ?? 0;
    const databaseSizeAsOf = latestDay?.date ?? null;
    const estimatedCostUsd = estimateLaunchCostUsd({
      computeUnitSeconds,
      rootByteHours,
      childByteHours,
      instantRestoreByteHours,
      snapshotByteHours,
      publicTransferBytes,
      privateTransferBytes,
    });

    return {
      snapshot: {
        projectId: project.id,
        projectName: project.name,
        windowDays,
        apiDays,
        computeHours: computeUnitSeconds / 3600,
        databaseSizeGb,
        databaseSizeAsOf,
        storageGbMonths,
        storageGbAvg,
        storageBreakdownGbMonths: {
          root: byteHoursToGbMonths(rootByteHours),
          child: byteHoursToGbMonths(childByteHours),
          instantRestore: byteHoursToGbMonths(instantRestoreByteHours),
          snapshot: byteHoursToGbMonths(snapshotByteHours),
        },
        publicTransferGb: publicTransferBytes / BYTES_PER_GB,
        privateTransferGb: privateTransferBytes / BYTES_PER_GB,
        extraBranchMonths: extraBranchHours / HOURS_PER_BILLING_MONTH,
        estimatedCostUsd,
        estimatedCostFormatted: formatUsd(estimatedCostUsd),
        daily,
      },
      errorMessage: null,
    };
  } catch (e) {
    console.warn("[admin-neon] snapshot:", e);
    const msg = e instanceof Error ? e.message : "Neon API request failed";
    if (msg.includes(" 429")) {
      return {
        snapshot: null,
        errorMessage: "Neon API rate limit exceeded. Wait a few minutes and refresh.",
      };
    }
    if (msg.includes(" 406")) {
      return {
        snapshot: null,
        errorMessage: "Date range is outside Neon daily API limits (max 60 days). Try a shorter period.",
      };
    }
    return {
      snapshot: null,
      errorMessage: msg.length > 200 ? `${msg.slice(0, 200)}…` : msg,
    };
  }
}
