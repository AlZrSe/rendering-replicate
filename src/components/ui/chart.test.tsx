import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { ChartContainer, ChartStyle } from "./chart";
import * as RechartsPrimitive from "recharts";

// Mock Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-series1: red;");
      expect(html).toContain("--color-series2: #ff0000;");
    });

    it("renders CSS for both light and dark themes", () => {
      const config = {
        series1: { theme: { light: "red", dark: "blue" } },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-series1: rgb(255, 0, 0);");
      expect(html).toContain("--color-series2: rgba(255, 0, 0, 0.5);");
      expect(html).toContain("--color-series3: rgb(100%, 0%, 0%);");
    });

    it("renders with hsl/hsla colors", () => {
      const config = {
        series1: { color: "hsl(0, 100%, 50%)" },
        series2: { color: "hsla(0, 100%, 50%, 0.5)" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-series1: hsl(0, 100%, 50%);");
      expect(html).toContain("--color-series2: hsla(0, 100%, 50%, 0.5);");
    });

    it("renders with CSS color keywords", () => {
      const config = {
        series1: { color: "currentcolor" },
        series2: { color: "transparent" },
        series3: { color: "inherit" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-valid: red;");
      expect(html).not.toContain("--color-invalid:");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Chart] Invalid color value for key \"invalid\"")
      );
    });

    it("rejects semicolon injection attempts", () => {
      const config = {
        malicious: { color: "red; color: blue;" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects brace injection attempts", () => {
      const config = {
        malicious: { color: "red} * { color: blue" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects url() injection attempts", () => {
      const config = {
        malicious: { color: "url(http://evil.com)" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects expression() injection attempts", () => {
      const config = {
        malicious: { color: "expression(alert(1))" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("--color-malicious:");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects injection in rgb function", () => {
      const config = {
        malicious: { color: "rgb(255, 0, 0); background: red" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-foo_bar_: red;");
      expect(html).toContain("--color-foo_bar_: blue;");
      expect(html).toContain("--color-foo_bar_: green;");
    });

    it("sanitizes double hyphen prefix", () => {
      const config = {
        "--foo": { color: "red" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-__foo: red;");
    });

    it("truncates long keys", () => {
      const longKey = "a".repeat(150);
      const config = {
        [longKey]: { color: "red" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      // Should contain truncated key (100 chars)
      expect(html).toMatch(/--color-a{100}:/);
    });

    it("is deterministic - same input produces same output", () => {
      const config1 = { "foo.bar": { color: "red" } };
      const config2 = { "foo.bar": { color: "red" } };

      const html1 = renderToString(
        React.createElement(ChartContainer, { config: config1 }, React.createElement(RechartsPrimitive.LineChart))
      );

      const html2 = renderToString(
        React.createElement(ChartContainer, { config: config2 }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html1).toBe(html2);
    });
  });

  describe("ID escaping", () => {
    it("escapes brackets in ID", () => {
      const config = { series1: { color: "red" } };

      const html = renderToString(
        React.createElement(ChartContainer, { id: "chart[1]", config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("[data-chart=chart\\[1\\]]");
    });

    it("escapes quotes in ID", () => {
      const config = { series1: { color: "red" } };

      const html = renderToString(
        React.createElement(ChartContainer, { id: 'chart"quote', config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain('[data-chart=chart\\"quote]');
    });

    it("escapes backslash in ID", () => {
      const config = { series1: { color: "red" } };

      const html = renderToString(
        React.createElement(ChartContainer, { id: "chart\\path", config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("[data-chart=chart\\\\path]");
    });

    it("escapes non-ASCII in ID", () => {
      const config = { series1: { color: "red" } };

      const html = renderToString(
        React.createElement(ChartContainer, { id: "café", config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("[data-chart=caf\\E9 ]");
    });
  });

  describe("edge cases", () => {
    it("returns null for empty config", () => {
      const html = renderToString(
        React.createElement(ChartContainer, { config: {} }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("<style");
    });

    it("returns null for config without color or theme", () => {
      const config = {
        series1: { label: "Series 1" },
        series2: { label: "Series 2" },
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).not.toContain("<style");
    });

    it("does not use dangerouslySetInnerHTML", () => {
      const config = { series1: { color: "red" } };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
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
      };

      const html = renderToString(
        React.createElement(ChartContainer, { config }, React.createElement(RechartsPrimitive.LineChart))
      );

      expect(html).toContain("--color-valid1: red;");
      expect(html).toContain("--color-valid2: blue;");
      expect(html).not.toContain("--color-invalid:");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});