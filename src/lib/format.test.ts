import { describe, expect, it } from "vitest";
import { fmtDate, fmtDuration, fmtGb, toYaml } from "./format";

describe("fmtDate", () => {
  it("formats an ISO timestamp", () => {
    expect(fmtDate("2026-01-02T03:04:05Z")).toMatch(/Jan 2/);
  });

  it("falls back to a dash when missing", () => {
    expect(fmtDate(undefined)).toBe("—");
  });
});

describe("fmtDuration", () => {
  it("returns seconds for short runs", () => {
    expect(fmtDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:42Z")).toBe("42s");
  });

  it("returns minutes and seconds", () => {
    expect(fmtDuration("2026-01-01T00:00:00Z", "2026-01-01T00:03:20Z")).toBe("3m 20s");
  });

  it("returns hours and minutes for long runs", () => {
    expect(fmtDuration("2026-01-01T00:00:00Z", "2026-01-01T05:30:00Z")).toBe("5h 30m");
  });

  it("returns a dash without a start time", () => {
    expect(fmtDuration(undefined)).toBe("—");
  });
});

describe("fmtGb", () => {
  it("converts megabytes to gigabytes", () => {
    expect(fmtGb(2048)).toBe("2.0 GB");
  });
});

describe("toYaml", () => {
  it("renders nested objects with indentation", () => {
    const yaml = toYaml({ name: "run", resources: { gpus: 2, vram_gb: 24 } });
    expect(yaml).toBe(["name: run", "resources:", "  gpus: 2", "  vram_gb: 24"].join("\n"));
  });

  it("renders lists as dash items", () => {
    expect(toYaml({ args: ["-n", "4"] })).toBe("args:\n  - -n\n  - 4");
  });

  it("quotes values that would break YAML", () => {
    expect(toYaml({ cmd: "a: b" })).toBe('cmd: "a: b"');
  });

  it("drops empty values", () => {
    expect(toYaml({ a: 1, b: "", env: {} })).toBe("a: 1");
  });
});
