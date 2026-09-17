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

## Later (needs the real backend)
- Switch VITE_CLUSTER_BACKEND=http and verify src/services/http.ts against the FastAPI routes
- Date-range filter on the jobs list
