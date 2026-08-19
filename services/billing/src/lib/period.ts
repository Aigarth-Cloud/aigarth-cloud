/**
 * Billing period helpers.
 *
 * Periods are calendar-aligned months by default, but we use rolling
 * 30-day periods so the E2E test is predictable. Periods are anchored
 * to the user's subscription start date.
 */

import { loadConfig } from "../config/index.js";

export interface BillingPeriod {
  start: Date;
  end: Date; // exclusive
  index: number; // 0 = first period
}

export function currentPeriodFor(start: Date, at: Date = new Date()): BillingPeriod {
  const cfg = loadConfig();
  const days = cfg.BILLING_PERIOD_DAYS;
  const elapsedMs = at.getTime() - start.getTime();
  const periodMs = days * 24 * 60 * 60 * 1000;
  const index = Math.max(0, Math.floor(elapsedMs / periodMs));
  const periodStart = new Date(start.getTime() + index * periodMs);
  const periodEnd = new Date(periodStart.getTime() + periodMs);
  return { start: periodStart, end: periodEnd, index };
}

export function nextPeriodFor(start: Date, at: Date = new Date()): BillingPeriod {
  const current = currentPeriodFor(start, at);
  const cfg = loadConfig();
  const periodMs = cfg.BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return {
    start: current.end,
    end: new Date(current.end.getTime() + periodMs),
    index: current.index + 1,
  };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
