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

## Later (needs the real backend)
- Replace mock functions in src/lib/api.ts with fetch + real WebSocket log stream
- Date-range filter on the jobs list
