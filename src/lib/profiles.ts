import { useCallback, useEffect, useState } from "react";

export interface SoftwareProfile {
  id: string;
  name: string;
  software: string;
  description: string;
  command: string;
  working_dir: string;
  gpus: number;
  cpus: number;
  memory_gb: number;
  input: string;
  output: string;
  max_retries: number;
  retry_delay_seconds: number;
  env: Array<{ key: string; value: string }>;
  builtin?: boolean;
}

const KEY = "shc.profiles";

/** Curated starting points for common scientific codes. */
export const builtinProfiles: SoftwareProfile[] = [
  {
    id: "vasp-std",
    name: "VASP — standard relaxation",
    software: "VASP",
    description:
      "Plane-wave DFT with vasp_std. Expects INCAR, POSCAR, KPOINTS and POTCAR in the input folder.",
    command: "mpirun -np 16 vasp_std",
    working_dir: "/sync/projects/vasp-run",
    gpus: 0,
    cpus: 16,
    memory_gb: 64,
    input: "data/vasp/in",
    output: "data/vasp/out",
    max_retries: 2,
    retry_delay_seconds: 120,
    env: [
      { key: "OMP_NUM_THREADS", value: "1" },
      { key: "VASP_PP_PATH", value: "/opt/vasp/potpaw_PBE" },
    ],
    builtin: true,
  },
  {
    id: "vasp-gpu",
    name: "VASP — GPU (OpenACC)",
    software: "VASP",
    description: "vasp_std built with the NVIDIA HPC SDK; one MPI rank per GPU.",
    command: "mpirun -np 2 vasp_std",
    working_dir: "/sync/projects/vasp-gpu",
    gpus: 2,
    cpus: 8,
    memory_gb: 48,
    input: "data/vasp/in",
    output: "data/vasp/out",
    max_retries: 2,
    retry_delay_seconds: 120,
    env: [
      { key: "OMP_NUM_THREADS", value: "4" },
      { key: "CUDA_VISIBLE_DEVICES", value: "0,1" },
    ],
    builtin: true,
  },
  {
    id: "lammps-gpu",
    name: "LAMMPS — molecular dynamics (GPU)",
    software: "LAMMPS",
    description: "Classical MD via lmp with the KOKKOS/GPU package and an in.* input script.",
    command: "mpirun -np 8 lmp -k on g 1 -sf kk -in in.melt",
    working_dir: "/sync/projects/lammps-run",
    gpus: 1,
    cpus: 8,
    memory_gb: 32,
    input: "data/lammps/in",
    output: "data/lammps/out",
    max_retries: 3,
    retry_delay_seconds: 60,
    env: [{ key: "OMP_NUM_THREADS", value: "1" }],
    builtin: true,
  },
  {
    id: "rmc-profile",
    name: "RMCProfile — reverse Monte Carlo",
    software: "RMCProfile",
    description: "Total-scattering RMC refinement driven by a .dat control file.",
    command: "rmcprofile refine.dat",
    working_dir: "/sync/projects/rmc-run",
    gpus: 0,
    cpus: 4,
    memory_gb: 16,
    input: "data/rmc/in",
    output: "data/rmc/out",
    max_retries: 1,
    retry_delay_seconds: 90,
    env: [{ key: "RMCPROFILE_HOME", value: "/opt/rmcprofile" }],
    builtin: true,
  },
  {
    id: "gromacs-mdrun",
    name: "GROMACS — mdrun",
    software: "GROMACS",
    description: "Biomolecular MD; runs gmx mdrun on a prepared .tpr file.",
    command: "gmx mdrun -deffnm run -nb gpu -ntomp 8",
    working_dir: "/sync/projects/gromacs-run",
    gpus: 1,
    cpus: 8,
    memory_gb: 24,
    input: "data/gmx/in",
    output: "data/gmx/out",
    max_retries: 2,
    retry_delay_seconds: 60,
    env: [{ key: "GMX_MAXBACKUP", value: "-1" }],
    builtin: true,
  },
  {
    id: "qe-pwscf",
    name: "Quantum ESPRESSO — pw.x",
    software: "Quantum ESPRESSO",
    description: "SCF / relaxation with pw.x reading scf.in.",
    command: "mpirun -np 12 pw.x -in scf.in",
    working_dir: "/sync/projects/qe-run",
    gpus: 0,
    cpus: 12,
    memory_gb: 48,
    input: "data/qe/in",
    output: "data/qe/out",
    max_retries: 2,
    retry_delay_seconds: 120,
    env: [
      { key: "OMP_NUM_THREADS", value: "1" },
      { key: "ESPRESSO_PSEUDO", value: "/opt/qe/pseudo" },
    ],
    builtin: true,
  },
  {
    id: "cp2k-md",
    name: "CP2K — ab initio MD",
    software: "CP2K",
    description: "Mixed Gaussian/plane-wave MD with cp2k.psmp.",
    command: "mpirun -np 16 cp2k.psmp -i md.inp",
    working_dir: "/sync/projects/cp2k-run",
    gpus: 0,
    cpus: 16,
    memory_gb: 64,
    input: "data/cp2k/in",
    output: "data/cp2k/out",
    max_retries: 2,
    retry_delay_seconds: 120,
    env: [{ key: "OMP_NUM_THREADS", value: "2" }],
    builtin: true,
  },
  {
    id: "pytorch-train",
    name: "PyTorch — training run",
    software: "PyTorch",
    description: "Single-node multi-GPU training with torchrun.",
    command: "torchrun --nproc_per_node=2 train.py --config configs/default.yaml",
    working_dir: "/sync/projects/ml-run",
    gpus: 2,
    cpus: 12,
    memory_gb: 64,
    input: "data/in",
    output: "data/out",
    max_retries: 3,
    retry_delay_seconds: 60,
    env: [{ key: "PYTHONUNBUFFERED", value: "1" }],
    builtin: true,
  },
];

interface Stored {
  custom: SoftwareProfile[];
  /** Edited copies of built-ins, keyed by id. */
  overrides: Record<string, SoftwareProfile>;
  hidden: string[];
}

const empty: Stored = { custom: [], overrides: {}, hidden: [] };
let cache: Stored | null = null;
const listeners = new Set<() => void>();

function read(): Stored {
  if (cache) return cache;
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...empty, ...(JSON.parse(raw) as Partial<Stored>) } : empty;
  } catch {
    cache = empty;
  }
  return cache;
}

function write(next: Stored) {
  cache = next;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function listProfiles(): SoftwareProfile[] {
  const s = read();
  const base = builtinProfiles
    .filter((p) => !s.hidden.includes(p.id))
    .map((p) => s.overrides[p.id] ?? p);
  return [...base, ...s.custom];
}

export function getProfile(id: string): SoftwareProfile | undefined {
  return listProfiles().find((p) => p.id === id);
}

export function saveProfile(profile: SoftwareProfile) {
  const s = read();
  const isBuiltin = builtinProfiles.some((p) => p.id === profile.id);
  if (isBuiltin) {
    write({ ...s, overrides: { ...s.overrides, [profile.id]: { ...profile, builtin: true } } });
    return profile;
  }
  const exists = s.custom.some((p) => p.id === profile.id);
  write({
    ...s,
    custom: exists
      ? s.custom.map((p) => (p.id === profile.id ? profile : p))
      : [...s.custom, profile],
  });
  return profile;
}

export function deleteProfile(id: string) {
  const s = read();
  if (builtinProfiles.some((p) => p.id === id)) {
    write({ ...s, hidden: [...s.hidden, id], overrides: omit(s.overrides, id) });
    return;
  }
  write({ ...s, custom: s.custom.filter((p) => p.id !== id) });
}

export function resetProfile(id: string) {
  const s = read();
  write({
    ...s,
    hidden: s.hidden.filter((h) => h !== id),
    overrides: omit(s.overrides, id),
  });
}

export function restoreBuiltins() {
  const s = read();
  write({ ...s, hidden: [], overrides: {} });
}

function omit(map: Record<string, SoftwareProfile>, id: string) {
  const next = { ...map };
  delete next[id];
  return next;
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "profile"}-${Math.random().toString(36).slice(2, 6)}`;
}

export const blankProfile = (): SoftwareProfile => ({
  id: "",
  name: "",
  software: "",
  description: "",
  command: "",
  working_dir: "/sync/projects/new-run",
  gpus: 0,
  cpus: 4,
  memory_gb: 16,
  input: "data/in",
  output: "data/out",
  max_retries: 2,
  retry_delay_seconds: 60,
  env: [],
});

/** Profiles hook — returns [] during SSR, then hydrates from localStorage. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<SoftwareProfile[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setProfiles(listProfiles());
    sync();
    setReady(true);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const refresh = useCallback(() => setProfiles(listProfiles()), []);
  return { profiles, ready, refresh };
}
