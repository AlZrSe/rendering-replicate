# Roadmap — Scientific Home Cluster Web UI

- [x] Design system (indigo/slate, dark + light)
- [x] Typed mock backend + API layer (jobs, nodes, metrics, log stream)
- [x] Login page with bearer token (non-local hosts only)
- [x] Jobs list: filters, search, pagination, polling
- [x] Job submission form + YAML preview
- [x] Job detail: overview / logs / metrics / actions
- [x] Nodes list + node detail
- [x] Settings page
- [x] Skip authorisation entirely when running on localhost
- [x] README with setup instructions
- [x] Software profiles (VASP, LAMMPS, RMCProfile, GROMACS, QE, CP2K, PyTorch) with create/edit page and job-form prefill

- [x] Single services layer (src/services) with mock + HTTP implementations of one ClusterService contract
- [x] Explicit `VITE_CLUSTER_BACKEND=mock` opt-in, no reachability probe, no implicit mock fallback

## Later (needs the real backend)
- Verify src/services/http.ts against the FastAPI routes end-to-end in CI (the Playwright suite is the contract check)
- Date-range filter on the jobs list
