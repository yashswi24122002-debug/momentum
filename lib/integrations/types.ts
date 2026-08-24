/**
 * Common return shape for every external data-source wrapper under
 * lib/integrations/ — Master PRD §6: a failed source must never crash the
 * whole request, so wrappers report their own failure instead of throwing.
 */
export type SignalResult = {
  source: string;
  signals: string[];
  error?: string;
};
