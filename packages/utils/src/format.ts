/**
 * Number, currency, and percent formatters.
 * All use en-US locale by default; pass overrides for internationalization.
 */

const defaultLocale = "en-US";

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
  locale?: string;
}

export function formatNumber(value: number, options?: FormatNumberOptions): string {
  const { locale, ...rest } = options ?? {};
  return new Intl.NumberFormat(locale ?? defaultLocale, rest).format(value);
}

export function formatCurrency(
  value: number,
  currency = "USD",
  options?: FormatNumberOptions,
): string {
  const { locale, ...rest } = options ?? {};
  return new Intl.NumberFormat(locale ?? defaultLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...rest,
  }).format(value);
}

export function formatCompact(value: number, options?: FormatNumberOptions): string {
  const { locale, ...rest } = options ?? {};
  return new Intl.NumberFormat(locale ?? defaultLocale, {
    notation: "compact",
    maximumFractionDigits: 1,
    ...rest,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat(defaultLocale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatBytes(
  bytes: number,
  options: { binary?: boolean; precision?: number } = {},
): string {
  const { binary = false, precision = 1 } = options;
  const base = binary ? 1024 : 1000;
  const units = binary
    ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]
    : ["B", "KB", "MB", "GB", "TB", "PB"];

  if (bytes < base) return `${bytes} ${units[0]}`;
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1,
  );
  const value = bytes / Math.pow(base, exp);
  return `${value.toFixed(precision)} ${units[exp]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  if (ms < 86_400_000)
    return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.floor(ms / 86_400_000)}d ${Math.floor((ms % 86_400_000) / 3_600_000)}h`;
}

export function formatRelativeTime(date: Date | string | number, now: Date = new Date()): string {
  const target = typeof date === "object" ? date : new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(defaultLocale, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(diffSec / 86_400), "day");
  if (abs < 31_536_000) return rtf.format(Math.round(diffSec / 2_592_000), "month");
  return rtf.format(Math.round(diffSec / 31_536_000), "year");
}
