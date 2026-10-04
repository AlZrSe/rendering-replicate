/**
 * View decisions for the jobs dashboard — route `/` (issue #42).
 *
 * Every function here is a plain function of its arguments: no React, no hooks, no
 * query client, no module state. That is the whole point of the module.
 *
 * Route `/` used to decide what to draw inline, in JSX:
 *
 *     {jobsQuery.isPending ? … : (jobsQuery.data?.items.length ?? 0) === 0 ? … : …}
 *
 * and `?? 0` erased the difference between "the backend said zero" and "the backend
 * did not answer". A failed query has `data === undefined`, so `(undefined ?? 0) === 0`
 * is true, so a dashboard that had never reached the cluster rendered the empty
 * state's copy, four zeroed stat cards, a `0/0` node card and a `0–0 of 0` footer —
 * a confidently-wiped cluster (US-5 failing by a second route).
 *
 * Extracting the decisions is what makes the fix checkable. This repository has no
 * component-test renderer installed and no intent to add one (see the recorded team
 * decision on issue #42: no `@testing-library/react`, no new dependency), and
 * `renderToString` cannot reach `isPending → isError` because it is a single
 * synchronous pass. So a decision that lives only inside JSX is a decision nothing
 * can assert on. These functions are the decision; `src/routes/index.tsx` is the
 * wiring; `src/lib/jobs-dashboard.test.ts` is the regression net.
 *
 * Naming is deliberately list-shaped rather than jobs-shaped (`listPanelState`, not
 * `jobsPanelState`) because the same disease exists on `nodes.$nodeId.tsx`'s
 * `metricsQuery`, which is filed separately — the next fix should be able to reuse
 * this rather than copy it.
 */
import { ServiceError } from "@/services/types";
import { getUserFriendlyError } from "@/lib/error-messages";
import type { JobState, JobStatus, NodeSpec } from "@/lib/types";

/** Which of the four mutually exclusive states a list panel should render. */
export type ListPanelState = "pending" | "error" | "empty" | "list";

/**
 * The slice of a React Query result these decisions read. Declared structurally so a
 * `useQuery` result can be passed straight in, and so a test can pass a literal.
 */
export interface ListQueryView {
  isPending: boolean;
  isError: boolean;
  /**
   * The query's data, or `undefined` when there is none.
   *
   * `undefined` is deliberately one value standing for two situations that must
   * stay distinct: "no answer yet" and "the request failed". Every bug on this route
   * came from letting them collapse into `0`.
   */
  data: { readonly items: readonly unknown[] } | undefined;
}

/**
 * Decide what the list panel renders.
 *
 * **The order of the branches is the fix.** `error` must be decided before the zero
 * test, because a failed query is exactly the case where `data` is `undefined` and
 * the zero test is therefore *true*. Reordered, this returns `"empty"` for a
 * `listJobs` rejection and the page states as fact that a cluster it never reached
 * has no jobs.
 */
export function listPanelState(query: ListQueryView): ListPanelState {
  if (query.isPending) return "pending";
  if (query.isError) return "error";
  return (query.data?.items.length ?? 0) === 0 ? "empty" : "list";
}

/**
 * What a metric card shows when its number is not known.
 *
 * `—` rather than `?`: it keeps the card grid the same size and in the same place
 * whether the query succeeded or failed, so the layout does not reflow exactly when
 * the page is least trustworthy. `0` is the one value that cannot be used — it is
 * indistinguishable from a real measurement, and asserting it is the harm.
 */
export const SUPPRESSED = "—";

/** A counter is a measured number or {@link SUPPRESSED}. Never a fabricated `0`. */
export type CounterValue = number | typeof SUPPRESSED;

/** The query slice the counters read. `isPending` is deliberately not consulted. */
export interface CountQueryView<V> {
  isError: boolean;
  data: readonly V[] | undefined;
}

/** The five numbers behind route `/`'s four stat cards (`nodes` is folded into one). */
export interface DashboardCounters {
  running: CounterValue;
  pending: CounterValue;
  failed: CounterValue;
  online: CounterValue;
  nodes: CounterValue;
}

// Annotated rather than left to inference: an unannotated object literal widens
// `"—"` to `string`, which is not a `CounterValue` and fails to type-check at the
// spread below. The annotation is the reason this compiles without a cast.
const SUPPRESSED_JOB_COUNTS: Pick<DashboardCounters, "running" | "pending" | "failed"> = {
  running: SUPPRESSED,
  pending: SUPPRESSED,
  failed: SUPPRESSED,
};
const SUPPRESSED_NODE_COUNTS: Pick<DashboardCounters, "online" | "nodes"> = {
  online: SUPPRESSED,
  nodes: SUPPRESSED,
};

function countByStatus(items: readonly JobState[]) {
  const count = (status: JobStatus) => items.filter((job) => job.status === status).length;
  return { running: count("RUNNING"), pending: count("PENDING"), failed: count("FAILED") };
}

function countNodes(items: readonly NodeSpec[]) {
  return { online: items.filter((node) => node.status === "ONLINE").length, nodes: items.length };
}

/**
 * The four stat cards' values.
 *
 * Suppression is **per counter group, not per page**. The jobs list and the node
 * list are independent requests, and a reachable cluster whose jobs endpoint is
 * broken is a genuinely different situation from an unreachable cluster. Collapsing
 * the two — as `allJobs.data?.items ?? []` did — destroys a number that is still
 * true.
 *
 * `isPending` is not consulted: a first-load skeleton is already on screen, and
 * showing `0` there is a pre-existing, brief transient rather than the persistent
 * false claim this issue is about. Widening it is a separate call.
 */
export function dashboardCounters(
  jobs: CountQueryView<JobState>,
  nodes: CountQueryView<NodeSpec>,
): DashboardCounters {
  const jobCounts = jobs.isError ? SUPPRESSED_JOB_COUNTS : countByStatus(jobs.data ?? []);
  const nodeCounts = nodes.isError ? SUPPRESSED_NODE_COUNTS : countNodes(nodes.data ?? []);
  return { ...jobCounts, ...nodeCounts };
}

/**
 * The "Nodes online" card's value.
 *
 * Both halves are suppressed together, so a failed node query reads `—` rather than
 * `—/0` or `0/0`. `0/0` is the literal "this cluster has no nodes" that route `/`
 * used to assert with the backend down.
 */
export function nodesOnlineValue(online: CounterValue, total: CounterValue): string {
  return online === SUPPRESSED || total === SUPPRESSED ? SUPPRESSED : `${online}/${total}`;
}

/**
 * The pagination footer.
 *
 * On a failed jobs query it says the count is unknown. It must not print `0–0 of 0`:
 * that string is a claim about the cluster, and it was reached by `total ?? 0` from a
 * request that produced no total at all.
 *
 * On success the output is byte-identical to the inline expression this replaced,
 * including the `0–0 of 0` an honest empty result still gets.
 */
export function paginationLabel({
  page,
  pageSize,
  total,
  failed,
}: {
  page: number;
  pageSize: number;
  total: number;
  failed: boolean;
}): string {
  if (failed) return "Job count unavailable";
  const first = total === 0 ? "0" : String(page * pageSize + 1);
  return `${first}–${Math.min(total, (page + 1) * pageSize)} of ${total}`;
}

/** One entry in the node filter dropdown. */
export interface NodeFilterOption {
  value: string;
  label: string;
  disabled: boolean;
}

/**
 * Sentinel value for the disabled "nodes unavailable" entry. Not a node id, and the
 * entry is disabled, so it can never become the filter's selection.
 */
export const NODES_UNAVAILABLE_VALUE = "__nodes_unavailable__";

/**
 * The node filter's entries, excluding the "All nodes" item the component always
 * renders first.
 *
 * A failed node query contributes one **disabled** "Nodes unavailable" row rather
 * than nothing. Returning nothing would leave a dropdown whose only option is "All
 * nodes" — indistinguishable from a cluster that has no nodes, which is the second
 * false signal on this page. Returning `[]` is still the honest answer when the
 * query *succeeded* and the cluster genuinely has zero nodes.
 */
export function nodeFilterOptions(nodes: CountQueryView<NodeSpec>): NodeFilterOption[] {
  if (nodes.isError) {
    return [{ value: NODES_UNAVAILABLE_VALUE, label: "Nodes unavailable", disabled: true }];
  }
  return (nodes.data ?? []).map((node) => ({
    value: node.node_id,
    label: node.node_id,
    disabled: false,
  }));
}

/** The heading and body of the panel's error branch. */
export interface JobsErrorCopy {
  title: string;
  description: string;
}

/**
 * Copy for the panel's error branch.
 *
 * It must never be the empty state's copy. "No jobs match these filters" is a
 * statement about the cluster; on a failed request the cluster was never asked. A
 * `ServiceError` carrying a mapped `error_code` gets that mapping, so an unreachable
 * backend says "Cannot reach the cluster backend" rather than the generic fallback.
 */
export function jobsErrorCopy(error: unknown): JobsErrorCopy {
  if (error instanceof ServiceError) {
    const friendly = getUserFriendlyError(error);
    return {
      title: friendly.message,
      description: friendly.suggestion ?? "The request did not complete. Please try again.",
    };
  }
  return {
    title: "Jobs could not be loaded",
    description: "The cluster backend did not answer. Check that it is running, then retry.",
  };
}
