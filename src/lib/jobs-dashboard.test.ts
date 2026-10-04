/**
 * Regression net for the pure view decisions behind route `/` (issue #42).
 *
 * These are the automated half of the fix; the other half is that
 * `src/routes/index.tsx` *calls* these functions rather than re-deciding inline,
 * which is the part a reviewer has to read. A green run here does not mean the
 * component is covered — there is no component-test renderer in this repository, by
 * recorded decision.
 *
 * The scenario tags (TS-1…TS-8) are the grooming spec's, so a failure points at the
 * criterion it violates rather than at a line number.
 */
import { describe, expect, it } from "vitest";
import { ServiceError, type BackendErrorResponse } from "@/services/types";
import type { JobState, JobStatus, NodeSpec } from "@/lib/types";
import {
  NODES_UNAVAILABLE_VALUE,
  SUPPRESSED,
  dashboardCounters,
  jobsErrorCopy,
  listPanelState,
  nodeFilterOptions,
  nodesOnlineValue,
  paginationLabel,
} from "./jobs-dashboard";

const EMPTY_STATE_TITLE = "No jobs match these filters";

function job(status: JobStatus): JobState {
  return {
    job_id: `job-${status.toLowerCase()}`,
    spec: {
      name: "run",
      command: "true",
      resources: { gpus: 1, cpus: 2, memory_gb: 8 },
      paths: {},
    },
    status,
    created_at: "2026-01-01T00:00:00Z",
    retry_count: 0,
  };
}

function node(status: NodeSpec["status"]): NodeSpec {
  return {
    node_id: `${status.toLowerCase()}-node`,
    hostname: `${status.toLowerCase()}.local`,
    gpus: [],
    cpus: 8,
    memory_gb: 32,
    os: "linux",
    status,
    last_heartbeat: "2026-01-01T00:00:00Z",
  };
}

/** The shape of a query that answered: some jobs, matching `total`. */
function answered(items: JobState[]) {
  return { isPending: false, isError: false, data: { items, total: items.length } };
}

/** The shape of a query that never answered. This is the case the issue is about. */
function rejected() {
  return { isPending: false, isError: true, data: undefined };
}

function unreachable() {
  const body: BackendErrorResponse = {
    status: 0,
    title: "Backend unreachable",
    detail: "Failed to fetch",
    instance: "/jobs",
    error_code: "BACKEND_UNREACHABLE",
  };
  return new ServiceError(0, "GET /jobs failed: backend unreachable", body);
}

describe("listPanelState", () => {
  it("TS-4: a pending query is the loading state, never the error state", () => {
    expect(listPanelState({ isPending: true, isError: false, data: undefined })).toBe("pending");
  });

  it("TS-4: pending wins even if isError is somehow also set", () => {
    expect(listPanelState({ isPending: true, isError: true, data: undefined })).toBe("pending");
  });

  // This is the regression test for issue #42. A rejected query has `data === undefined`,
  // so the old inline `(data?.items.length ?? 0) === 0` test was TRUE for it, and the
  // page fell through to the empty state. If the branch order in `listPanelState` is
  // ever changed so that the zero test runs first, this fails.
  it("TS-1: a rejected query is the error state, never the empty state", () => {
    const state = listPanelState(rejected());
    expect(state).toBe("error");
    expect(state).not.toBe("empty");
  });

  it("TS-1: a rejected query that kept stale data is still the error state", () => {
    // React Query retains the previous page's data when a background refetch fails, so
    // `data` being present does not make the answer "list" either.
    const state = listPanelState({
      isPending: false,
      isError: true,
      data: { items: [job("RUNNING")] },
    });
    expect(state).toBe("error");
    expect(state).not.toBe("list");
  });

  it("TS-2: a successful query with zero jobs is the empty state", () => {
    // The honest zero must keep saying "no jobs" — this is what stops the fix from
    // over-reaching into treating every zero as a failure.
    expect(listPanelState(answered([]))).toBe("empty");
  });

  it("TS-3: a successful query with jobs is the list state", () => {
    expect(listPanelState(answered([job("RUNNING")]))).toBe("list");
  });

  it("treats an impossible neither-pending-nor-answered state as empty", () => {
    // Defensive, and pinned so the fall-through is documented rather than accidental:
    // a brand new empty cluster must never render the error panel.
    expect(listPanelState({ isPending: false, isError: false, data: undefined })).toBe("empty");
  });
});

describe("dashboardCounters", () => {
  const noNodes: { isError: boolean; data: NodeSpec[] } = { isError: false, data: [] };

  it("reports real numbers for a healthy cluster", () => {
    const counters = dashboardCounters(
      {
        isError: false,
        data: [job("RUNNING"), job("RUNNING"), job("PENDING"), job("FAILED")],
      },
      { isError: false, data: [node("ONLINE"), node("OFFLINE")] },
    );
    expect(counters).toEqual({ running: 2, pending: 1, failed: 1, online: 1, nodes: 2 });
  });

  it("TS-5: a failed jobs query suppresses all three job counters", () => {
    const counters = dashboardCounters({ isError: true, data: undefined }, noNodes);
    expect(counters.running).toBe(SUPPRESSED);
    expect(counters.pending).toBe(SUPPRESSED);
    expect(counters.failed).toBe(SUPPRESSED);
    // The fabricated zero is the specific thing AC-2 forbids.
    expect(counters.running).not.toBe(0);
    expect(counters.pending).not.toBe(0);
    expect(counters.failed).not.toBe(0);
  });

  it("TS-6: a failed nodes query suppresses the nodes counters", () => {
    const counters = dashboardCounters(
      { isError: false, data: [] },
      { isError: true, data: undefined },
    );
    expect(counters.online).toBe(SUPPRESSED);
    expect(counters.nodes).toBe(SUPPRESSED);
  });

  it("suppresses per group, not per page: a failed jobs query keeps real node counts", () => {
    // Q2 on the grooming spec, recorded as per-counter. A cluster whose node list is
    // reachable and whose jobs endpoint is broken is a different situation from an
    // unreachable cluster, and 1/2 is still true.
    const counters = dashboardCounters(
      { isError: true, data: undefined },
      { isError: false, data: [node("ONLINE"), node("OFFLINE")] },
    );
    expect(counters.running).toBe(SUPPRESSED);
    expect(counters.online).toBe(1);
    expect(counters.nodes).toBe(2);
  });

  it("suppresses per group, not per page: a failed nodes query keeps real job counts", () => {
    const counters = dashboardCounters(
      { isError: false, data: [job("RUNNING")] },
      { isError: true, data: undefined },
    );
    expect(counters.running).toBe(1);
    expect(counters.online).toBe(SUPPRESSED);
  });

  it("still reports zeros for a healthy cluster that genuinely has nothing", () => {
    expect(dashboardCounters({ isError: false, data: [] }, noNodes)).toEqual({
      running: 0,
      pending: 0,
      failed: 0,
      online: 0,
      nodes: 0,
    });
  });
});

describe("nodesOnlineValue", () => {
  it("renders the online/total pair", () => {
    expect(nodesOnlineValue(2, 3)).toBe("2/3");
  });

  it("keeps 0/0 for a healthy cluster with no nodes", () => {
    expect(nodesOnlineValue(0, 0)).toBe("0/0");
  });

  it("TS-6: suppresses the whole card rather than printing 0/0", () => {
    expect(nodesOnlineValue(SUPPRESSED, SUPPRESSED)).toBe(SUPPRESSED);
    expect(nodesOnlineValue(SUPPRESSED, SUPPRESSED)).not.toBe("0/0");
  });

  it("suppresses if either half is unknown", () => {
    expect(nodesOnlineValue(SUPPRESSED, 3)).toBe(SUPPRESSED);
    expect(nodesOnlineValue(1, SUPPRESSED)).toBe(SUPPRESSED);
  });
});

describe("paginationLabel", () => {
  it("renders the first page", () => {
    expect(paginationLabel({ page: 0, pageSize: 6, total: 12, failed: false })).toBe("1–6 of 12");
  });

  it("renders a later page", () => {
    expect(paginationLabel({ page: 1, pageSize: 6, total: 12, failed: false })).toBe("7–12 of 12");
  });

  it("renders a partial final page", () => {
    expect(paginationLabel({ page: 1, pageSize: 6, total: 8, failed: false })).toBe("7–8 of 8");
  });

  it("still renders 0–0 of 0 for a successful empty result", () => {
    expect(paginationLabel({ page: 0, pageSize: 6, total: 0, failed: false })).toBe("0–0 of 0");
  });

  it("TS-7: a failed query does not print 0–0 of 0", () => {
    const label = paginationLabel({ page: 0, pageSize: 6, total: 0, failed: true });
    expect(label).not.toContain("0–0 of 0");
    expect(label).toBe("Job count unavailable");
  });
});

describe("nodeFilterOptions", () => {
  it("lists the nodes the backend reported", () => {
    expect(nodeFilterOptions({ isError: false, data: [node("ONLINE"), node("OFFLINE")] })).toEqual([
      { value: "online-node", label: "online-node", disabled: false },
      { value: "offline-node", label: "offline-node", disabled: false },
    ]);
  });

  it("is empty when a healthy cluster genuinely has no nodes", () => {
    // The counterpart to TS-2: an honest empty stays empty rather than becoming an error.
    expect(nodeFilterOptions({ isError: false, data: [] })).toEqual([]);
  });

  it("TS-8: a failed nodes query is not presented as the cluster's node list", () => {
    const options = nodeFilterOptions({ isError: true, data: undefined });
    // Not `[]`: that would leave the dropdown holding nothing but its always-present
    // "All nodes" item, which is the shape of "this cluster has no nodes".
    expect(options).toHaveLength(1);
    expect(options[0]?.value).toBe(NODES_UNAVAILABLE_VALUE);
    expect(options[0]?.label).toBe("Nodes unavailable");
    // Disabled, so it can never become the filter's selection.
    expect(options.every((option) => option.disabled)).toBe(true);
  });
});

describe("jobsErrorCopy", () => {
  it("names the unreachable backend for a connectivity failure", () => {
    const copy = jobsErrorCopy(unreachable());
    expect(copy.title).toBe("Cannot reach the cluster backend");
    expect(copy.description).not.toBe("");
  });

  it("never reuses the empty state's copy", () => {
    // The copy that makes the two states indistinguishable is the bug, so pin it.
    for (const error of [unreachable(), new Error("boom"), undefined, null]) {
      expect(jobsErrorCopy(error).title).not.toBe(EMPTY_STATE_TITLE);
    }
  });

  it("falls back to a plain failure message for a non-ServiceError", () => {
    expect(jobsErrorCopy(new Error("boom"))).toEqual({
      title: "Jobs could not be loaded",
      description: "The cluster backend did not answer. Check that it is running, then retry.",
    });
  });

  it("has a description even with no error at all", () => {
    const copy = jobsErrorCopy(undefined);
    expect(copy.title).not.toBe("");
    expect(copy.description).not.toBe("");
  });

  it("uses the backend's own detail for a ServiceError with no mapped code", () => {
    const copy = jobsErrorCopy(
      new ServiceError(418, "teapot", {
        status: 418,
        title: "I'm a teapot",
        detail: "The jobs endpoint is a teapot.",
        instance: "/jobs",
        error_code: "NOT_A_MAPPED_CODE",
      }),
    );
    expect(copy.title).toBe("The jobs endpoint is a teapot.");
    expect(copy.description).not.toBe("");
  });
});
