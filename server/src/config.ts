// Import first in every entry point. chewy runs on UTC; the lifting happens in Pacific time,
// and Strong exports local wall-clock times, so dates are parsed and bucketed in Pacific.
process.env.TZ ||= 'America/Los_Angeles';

export const PORT = Number(process.env.PORT ?? 8095);
export const HOST = process.env.HOST ?? '127.0.0.1';
/** Bodyweight for e1RM on pull-ups/dips (load = BW ± added). Matches the 2026 analysis. */
export const BODYWEIGHT = Number(process.env.LIFTER_BW ?? 165);
/** Historical sources. Personal data, kept out of the repo. */
export const HISTORY_DIR = process.env.LIFTER_HISTORY ?? `${process.env.HOME}/srv/lifter-analytics/history`;
