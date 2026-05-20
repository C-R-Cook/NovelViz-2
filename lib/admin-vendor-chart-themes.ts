/**
 * Per-vendor chart palettes for admin stats — intentionally separate from site `--accent`.
 * Add new providers here and pair with a `.vendor-charts--*` class in admin-vendor-charts.css.
 */

export type VendorChartTheme = {
  id: string;
  cssClass: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
    grid: string;
    axis: string;
    tooltipBg: string;
    tooltipBorder: string;
    tooltipText: string;
    tooltipMuted: string;
  };
  series: {
    compute: string;
    storageTotal: string;
    storageRoot: string;
    storageChild: string;
    storagePitr: string;
    storageSnapshot: string;
    transferPublic: string;
    transferPrivate: string;
    extraBranches: string;
  };
};

/** Neon console–inspired green + blue on dark panels. */
export const NEON_CHART_THEME: VendorChartTheme = {
  id: "neon",
  cssClass: "vendor-charts--neon",
  colors: {
    primary: "#3DFF8A",
    secondary: "#5B9FFF",
    tertiary: "#22D3EE",
    quaternary: "#818CF8",
    grid: "rgba(91, 159, 255, 0.18)",
    axis: "#8BA3C7",
    tooltipBg: "#0f1520",
    tooltipBorder: "rgba(61, 255, 138, 0.35)",
    tooltipText: "#E8F4FF",
    tooltipMuted: "#8BA3C7",
  },
  series: {
    compute: "#3DFF8A",
    storageTotal: "#5B9FFF",
    storageRoot: "#3DFF8A",
    storageChild: "#5B9FFF",
    storagePitr: "#22D3EE",
    storageSnapshot: "#818CF8",
    transferPublic: "#3DFF8A",
    transferPrivate: "#5B9FFF",
    extraBranches: "#22D3EE",
  },
};

export function vendorChartTooltipProps(theme: VendorChartTheme) {
  return {
    contentStyle: {
      backgroundColor: theme.colors.tooltipBg,
      border: `1px solid ${theme.colors.tooltipBorder}`,
      borderRadius: 8,
      fontSize: 12,
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
    },
    labelStyle: { color: theme.colors.tooltipMuted },
    itemStyle: { color: theme.colors.tooltipText },
  };
}

export function vendorChartAxisTick(theme: VendorChartTheme) {
  return { fill: theme.colors.axis, fontSize: 11 };
}

export function vendorChartGridProps(theme: VendorChartTheme) {
  return {
    stroke: theme.colors.grid,
    strokeDasharray: "3 3" as const,
  };
}

export function vendorChartLegendStyle(theme: VendorChartTheme) {
  return { fontSize: 11, color: theme.colors.axis };
}
