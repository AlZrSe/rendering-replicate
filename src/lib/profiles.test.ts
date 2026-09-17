import { beforeEach, describe, expect, it } from "vitest";
import {
  blankProfile,
  builtinProfiles,
  deleteProfile,
  getProfile,
  listProfiles,
  resetProfile,
  restoreBuiltins,
  saveProfile,
  slugify,
  type SoftwareProfile,
} from "./profiles";

const custom = (): SoftwareProfile => ({ ...blankProfile(), id: "my-code", name: "My code" });

beforeEach(() => {
  window.localStorage.clear();
  restoreBuiltins();
  listProfiles()
    .filter((p) => !p.builtin)
    .forEach((p) => deleteProfile(p.id));
});

describe("listProfiles", () => {
  it("starts with the built-in profiles", () => {
    expect(listProfiles().map((p) => p.id)).toEqual(builtinProfiles.map((p) => p.id));
  });

  it("includes well-known scientific codes", () => {
    const software = new Set(listProfiles().map((p) => p.software));
    expect(software).toContain("VASP");
    expect(software).toContain("LAMMPS");
    expect(software).toContain("RMCProfile");
  });
});

describe("saveProfile", () => {
  it("adds a custom profile", () => {
    saveProfile(custom());
    expect(getProfile("my-code")?.name).toBe("My code");
  });

  it("updates an existing custom profile instead of duplicating it", () => {
    saveProfile(custom());
    saveProfile({ ...custom(), name: "Renamed" });
    expect(listProfiles().filter((p) => p.id === "my-code")).toHaveLength(1);
    expect(getProfile("my-code")?.name).toBe("Renamed");
  });

  it("overrides a built-in without losing its builtin flag", () => {
    saveProfile({ ...builtinProfiles[0]!, cpus: 99 });
    const saved = getProfile(builtinProfiles[0]!.id)!;
    expect(saved.cpus).toBe(99);
    expect(saved.builtin).toBe(true);
  });
});

describe("deleteProfile", () => {
  it("removes a custom profile", () => {
    saveProfile(custom());
    deleteProfile("my-code");
    expect(getProfile("my-code")).toBeUndefined();
  });

  it("hides a built-in profile, and resetProfile brings it back", () => {
    const id = builtinProfiles[0]!.id;
    deleteProfile(id);
    expect(getProfile(id)).toBeUndefined();
    resetProfile(id);
    expect(getProfile(id)?.cpus).toBe(builtinProfiles[0]!.cpus);
  });
});

describe("restoreBuiltins", () => {
  it("drops overrides and unhides built-ins but keeps custom profiles", () => {
    const id = builtinProfiles[0]!.id;
    saveProfile({ ...builtinProfiles[0]!, cpus: 1 });
    deleteProfile(builtinProfiles[1]!.id);
    saveProfile(custom());
    restoreBuiltins();
    expect(getProfile(id)?.cpus).toBe(builtinProfiles[0]!.cpus);
    expect(getProfile(builtinProfiles[1]!.id)).toBeDefined();
    expect(getProfile("my-code")).toBeDefined();
  });
});

describe("slugify", () => {
  it("builds a url-safe id with a random suffix", () => {
    expect(slugify("VASP  Relax! 2")).toMatch(/^vasp-relax-2-[a-z0-9]{4}$/);
  });

  it("falls back for names without usable characters", () => {
    expect(slugify("!!!")).toMatch(/^profile-[a-z0-9]{4}$/);
  });
});

describe("blankProfile", () => {
  it("provides sane resource defaults including VRAM", () => {
    const p = blankProfile();
    expect(p).toMatchObject({ gpus: 0, cpus: 4, memory_gb: 16, vram_gb: 0, env: [] });
  });
});
