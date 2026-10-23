/**
 * A ranking lists at most this many options, so "top N" stops there (ADR-018). A leaf module with no
 * imports, so the condition schema and the operators can both read it without an import cycle.
 */
export const RANKING_OPTIONS_MAX = 20;
