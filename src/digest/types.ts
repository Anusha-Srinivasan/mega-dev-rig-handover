// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of runs/<night>.jsonl, after parsing. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. Times keep the log's offset (never converted to UTC). */
export type DigestRow = {
  job: string;
  /** null when the log says null; views render it as `—`. */
  owner: string | null;
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** Error of the last line that had one, or null. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse; counted, never thrown. */
  badLines: number;
};

/**
 * Reads runs/<night>.jsonl. Returns null when the night has no file (routes answer 404).
 * An empty file returns `{ rows: [], badLines: 0 }`.
 */
// Implemented in src/digest/read.ts as `export const readNight: ReadNight`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
