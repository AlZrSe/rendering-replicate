import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { ChartContainer, ChartStyle, ChartConfig } from "./chart";
import * as RechartsPrimitive from "recharts";

// Mock Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: () => <svg data-testid="line-chart" />,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("ChartStyle", () => {
  // Suppress console.warn for cleaner test output
  const originalWarn = console.warn;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("valid configurations", () => {
    it("renders CSS custom properties for valid color config", () => {
      const config = {
        series1: { color: "red" },
        series2: { color: "#ff0000" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-series1: red;");
      expect(html).toContain("--color-series2: #ff0000;");
    });

    it("renders CSS for both light and dark themes", () => {
      const config = {
        series1: { theme: { light: "red", dark: "blue" } },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("[data-chart=");
      expect(html).toContain(".dark [data-chart=");
      expect(html).toContain("--color-series1: red;");
      expect(html).toContain("--color-series1: blue;");
    });

    it("renders with hex colors", () => {
      const config = {
        series1: { color: "#ff0000" },
        series2: { color: "#f00" },
        series3: { color: "#ff0000ff" },
        series4: { color: "#f00f" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-series1: #ff0000;");
      expect(html).toContain("--color-series2: #f00;");
      expect(html).toContain("--color-series3: #ff0000ff;");
      expect(html).toContain("--color-series4: #f00f;");
    });

    it("renders with rgb/rgba colors", () => {
      const config = {
        series1: { color: "rgb(255, 0, 0)" },
        series2: { color: "rgba(255, 0, 0, 0.5)" },
        series3: { color: "rgb(100%, 0%, 0%)" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-series1: rgb(255, 0, 0);");
      expect(html).toContain("--color-series2: rgba(255, 0, 0, 0.5);");
      expect(html).toContain("--color-series3: rgb(100%, 0%, 0%);");
    });

    it("renders with hsl/hsla colors", () => {
      const config = {
        series1: { color: "hsl(0, 100%, 50%)" },
        series2: { color: "hsla(0, 100%, 50%, 0.5)" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-series1: hsl(0, 100%, 50%);");
      expect(html).toContain("--color-series2: hsla(0, 100%, 50%, 0.5);");
    });

    it("renders with CSS color keywords", () => {
      const config = {
        series1: { color: "currentcolor" },
        series2: { color: "transparent" },
        series3: { color: "inherit" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-series1: currentcolor;");
      expect(html).toContain("--color-series2: transparent;");
      expect(html).toContain("--color-series3: inherit;");
    });
  });

  describe("invalid color handling", () => {
    it("omits invalid color values and logs warning", () => {
      const config = {
        valid: { color: "red" },
        invalid: { color: "not-a-color" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-valid: red;");
      expect(html).not.toContain("--color-invalid:");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Chart] Invalid color value for key "invalid"'),
      );
    });

    it("rejects semicolon injection attempts", () => {
      const config = {
        malicious: { color: "red; color: blue;" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects brace injection attempts", () => {
      const config = {
        malicious: { color: "red} * { color: blue" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects url() injection attempts", () => {
      const config = {
        malicious: { color: "url(http://evil.com)" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects expression() injection attempts", () => {
      const config = {
        malicious: { color: "expression(alert(1))" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects injection in rgb function", () => {
      const config = {
        malicious: { color: "rgb(255, 0, 0); background: red" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("key sanitization", () => {
    it("sanitizes keys with special characters", () => {
      const config = {
        "foo.bar": { color: "red" },
        "foo;bar": { color: "blue" },
        "foo:bar": { color: "green" },
        "foo bar": { color: "yellow" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-foo_bar: red;");
      expect(html).toContain("--color-foo_bar: blue;");
      expect(html).toContain("--color-foo_bar: green;");
      expect(html).toContain("--color-foo_bar: yellow;");
    });

    it("sanitizes keys with braces and brackets", () => {
      const config = {
        "foo{bar}": { color: "red" },
        "foo[bar]": { color: "blue" },
        "foo(bar)": { color: "green" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-foo_bar_: red;");
      expect(html).toContain("--color-foo_bar_: blue;");
      expect(html).toContain("--color-foo_bar_: green;");
    });

    it("sanitizes double hyphen prefix", () => {
      const config = {
        "--foo": { color: "red" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-__foo: red;");
    });

    it("truncates long keys", () => {
      const longKey = "a".repeat(150);
      const config = {
        [longKey]: { color: "red" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      // Should contain truncated key (100 chars)
      expect(html).toMatch(/--color-a{100}:/);
    });

    it("is deterministic - same input produces same output", () => {
      const config1 = { "foo.bar": { color: "red" } } as ChartConfig;
      const config2 = { "foo.bar": { color: "red" } } as ChartConfig;

      const html1 = renderToString(
        <ChartContainer config={config1}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      const html2 = renderToString(
        <ChartContainer config={config2}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html1).toBe(html2);
    });
  });

  describe("ID escaping", () => {
    it("escapes brackets in ID", () => {
      const config = { series1: { color: "red" } } as ChartConfig;

      const html = renderToString(
        <ChartContainer id="test[1]" config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("[data-chart=chart-test\\[1\\]]");
    });

    it("escapes quotes in ID", () => {
      const config = { series1: { color: "red" } } as ChartConfig;

      const html = renderToString(
        <ChartContainer id='test"quote' config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain('[data-chart=chart-test\\"quote]');
    });

    it("escapes backslash in ID", () => {
      const config = { series1: { color: "red" } } as ChartConfig;

      const html = renderToString(
        <ChartContainer id="test\\path" config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      // Backslash is escaped as double backslash in CSS attribute selector
      expect(html).toContain("[data-chart=chart-test\\\\\\\\path]");
    });

    it("escapes non-ASCII in ID", () => {
      const config = { series1: { color: "red" } } as ChartConfig;

      const html = renderToString(
        <ChartContainer id="café" config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("[data-chart=chart-caf\\E9 ]");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty config", () => {
      const html = renderToString(
        <ChartContainer config={{} as ChartConfig}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("<style");
    });

    it("returns null for config without color or theme", () => {
      const config = {
        series1: { label: "Series 1" },
        series2: { label: "Series 2" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).not.toContain("<style");
    });

    it("does not use dangerouslySetInnerHTML", () => {
      const config = { series1: { color: "red" } } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      // The style element should have content as children, not dangerouslySetInnerHTML
      expect(html).not.toContain("dangerouslySetInnerHTML");
      expect(html).toContain("<style>");
      expect(html).toContain("--color-series1: red;");
    });

    it("handles mixed valid and invalid colors", () => {
      const config = {
        valid1: { color: "red" },
        invalid: { color: "not-a-color" },
        valid2: { color: "blue" },
      } as ChartConfig;

      const html = renderToString(
        <ChartContainer config={config}>
          <RechartsPrimitive.LineChart />
        </ChartContainer>,
      );

      expect(html).toContain("--color-valid1: red;");
      expect(html).toContain("--color-valid2: blue;");
      expect(html).not.toContain("--color-invalid:");
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
