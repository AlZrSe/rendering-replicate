import { describe, expect, it } from "vitest";
import {
  isValidCSSColor,
  sanitizeCSSCustomPropertyKey,
  escapeCSSSelectorValue,
} from "./chart-validation";

describe("isValidCSSColor", () => {
  describe("named colors", () => {
    it("accepts basic named colors", () => {
      expect(isValidCSSColor("red")).toBe(true);
      expect(isValidCSSColor("blue")).toBe(true);
      expect(isValidCSSColor("green")).toBe(true);
    });

    it("accepts extended named colors", () => {
      expect(isValidCSSColor("rebeccapurple")).toBe(true);
      expect(isValidCSSColor("aliceblue")).toBe(true);
      expect(isValidCSSColor("darkslategray")).toBe(true);
    });

    it("accepts CSS color keywords", () => {
      expect(isValidCSSColor("currentcolor")).toBe(true);
      expect(isValidCSSColor("transparent")).toBe(true);
      expect(isValidCSSColor("inherit")).toBe(true);
      expect(isValidCSSColor("initial")).toBe(true);
      expect(isValidCSSColor("unset")).toBe(true);
      expect(isValidCSSColor("revert")).toBe(true);
      expect(isValidCSSColor("revert-layer")).toBe(true);
    });

    it("is case insensitive", () => {
      expect(isValidCSSColor("RED")).toBe(true);
      expect(isValidCSSColor("Red")).toBe(true);
      expect(isValidCSSColor("ReD")).toBe(true);
    });
  });

  describe("hex colors", () => {
    it("accepts 3-digit hex", () => {
      expect(isValidCSSColor("#f00")).toBe(true);
      expect(isValidCSSColor("#0f0")).toBe(true);
      expect(isValidCSSColor("#00f")).toBe(true);
    });

    it("accepts 4-digit hex (with alpha)", () => {
      expect(isValidCSSColor("#f00f")).toBe(true);
      expect(isValidCSSColor("#0f08")).toBe(true);
    });

    it("accepts 6-digit hex", () => {
      expect(isValidCSSColor("#ff0000")).toBe(true);
      expect(isValidCSSColor("#00ff00")).toBe(true);
      expect(isValidCSSColor("#0000ff")).toBe(true);
      expect(isValidCSSColor("#abcdef")).toBe(true);
    });

    it("accepts 8-digit hex (with alpha)", () => {
      expect(isValidCSSColor("#ff0000ff")).toBe(true);
      expect(isValidCSSColor("#00ff0080")).toBe(true);
    });

    it("rejects invalid hex lengths", () => {
      expect(isValidCSSColor("#ff")).toBe(false);
      expect(isValidCSSColor("#ffff")).toBe(false);
      expect(isValidCSSColor("#fffff")).toBe(false);
      expect(isValidCSSColor("#fffffff")).toBe(false);
      expect(isValidCSSColor("#fffffffff")).toBe(false);
    });

    it("rejects invalid hex characters", () => {
      expect(isValidCSSColor("#ggg")).toBe(false);
      expect(isValidCSSColor("#zzzzzz")).toBe(false);
    });
  });

  describe("rgb/rgba", () => {
    it("accepts rgb() with numbers", () => {
      expect(isValidCSSColor("rgb(255, 0, 0)")).toBe(true);
      expect(isValidCSSColor("rgb(0, 255, 0)")).toBe(true);
      expect(isValidCSSColor("rgb(0, 0, 255)")).toBe(true);
      expect(isValidCSSColor("rgb(128, 128, 128)")).toBe(true);
    });

    it("accepts rgb() with percentages", () => {
      expect(isValidCSSColor("rgb(100%, 0%, 0%)")).toBe(true);
      expect(isValidCSSColor("rgb(50%, 50%, 50%)")).toBe(true);
    });

    it("accepts rgba() with numbers", () => {
      expect(isValidCSSColor("rgba(255, 0, 0, 0.5)")).toBe(true);
      expect(isValidCSSColor("rgba(0, 255, 0, 1)")).toBe(true);
    });

    it("accepts rgba() with percentages", () => {
      expect(isValidCSSColor("rgba(100%, 0%, 0%, 0.5)")).toBe(true);
    });

    it("rejects out of range values", () => {
      expect(isValidCSSColor("rgb(256, 0, 0)")).toBe(false);
      expect(isValidCSSColor("rgb(-1, 0, 0)")).toBe(false);
      expect(isValidCSSColor("rgb(101%, 0%, 0%)")).toBe(false);
      expect(isValidCSSColor("rgba(255, 0, 0, 1.5)")).toBe(false);
      expect(isValidCSSColor("rgba(255, 0, 0, -0.1)")).toBe(false);
    });

    it("rejects malformed rgb", () => {
      expect(isValidCSSColor("rgb(255, 0)")).toBe(false);
      expect(isValidCSSColor("rgb(255, 0, 0, 0)")).toBe(false);
      expect(isValidCSSColor("rgb(255 0 0)")).toBe(false);
    });
  });

  describe("hsl/hsla", () => {
    it("accepts hsl()", () => {
      expect(isValidCSSColor("hsl(0, 100%, 50%)")).toBe(true);
      expect(isValidCSSColor("hsl(120, 100%, 50%)")).toBe(true);
      expect(isValidCSSColor("hsl(240, 100%, 50%)")).toBe(true);
    });

    it("accepts hsla()", () => {
      expect(isValidCSSColor("hsla(0, 100%, 50%, 0.5)")).toBe(true);
      expect(isValidCSSColor("hsla(120, 100%, 50%, 1)")).toBe(true);
    });

    it("rejects out of range values", () => {
      expect(isValidCSSColor("hsl(361, 100%, 50%)")).toBe(false);
      expect(isValidCSSColor("hsl(-1, 100%, 50%)")).toBe(false);
      expect(isValidCSSColor("hsl(0, 101%, 50%)")).toBe(false);
      expect(isValidCSSColor("hsl(0, -1%, 50%)")).toBe(false);
      expect(isValidCSSColor("hsl(0, 100%, 101%)")).toBe(false);
      expect(isValidCSSColor("hsla(0, 100%, 50%, 1.5)")).toBe(false);
    });
  });

  describe("lab/lch", () => {
    it("accepts lab()", () => {
      expect(isValidCSSColor("lab(50% 100 0)")).toBe(true);
      expect(isValidCSSColor("lab(50 100 0 / 0.5)")).toBe(true);
    });

    it("accepts lch()", () => {
      expect(isValidCSSColor("lch(50% 100 200)")).toBe(true);
      expect(isValidCSSColor("lch(50 100 200 / 0.5)")).toBe(true);
    });

    it("rejects out of range lab", () => {
      expect(isValidCSSColor("lab(101% 100 0)")).toBe(false);
      expect(isValidCSSColor("lab(-1% 100 0)")).toBe(false);
      expect(isValidCSSColor("lab(50% 100 0 / 1.5)")).toBe(false);
    });

    it("rejects out of range lch", () => {
      expect(isValidCSSColor("lch(101% 100 200)")).toBe(false);
      expect(isValidCSSColor("lch(50% -1 200)")).toBe(false);
      expect(isValidCSSColor("lch(50% 100 361)")).toBe(false);
    });
  });

  describe("oklab/oklch", () => {
    it("accepts oklab()", () => {
      expect(isValidCSSColor("oklab(0.5 0.1 0.1)")).toBe(true);
      expect(isValidCSSColor("oklab(50% 0.1 0.1 / 0.5)")).toBe(true);
    });

    it("accepts oklch()", () => {
      expect(isValidCSSColor("oklch(50% 0.1 200)")).toBe(true);
      expect(isValidCSSColor("oklch(0.5 0.1 200 / 0.5)")).toBe(true);
    });

    it("rejects out of range oklab", () => {
      expect(isValidCSSColor("oklab(1.5 0.1 0.1)")).toBe(false);
      expect(isValidCSSColor("oklab(-0.1 0.1 0.1)")).toBe(false);
    });

    it("rejects out of range oklch", () => {
      expect(isValidCSSColor("oklch(1.5 0.1 200)")).toBe(false);
      expect(isValidCSSColor("oklch(0.5 -0.1 200)")).toBe(false);
      expect(isValidCSSColor("oklch(0.5 0.1 361)")).toBe(false);
    });
  });

  describe("color() function", () => {
    it("accepts color() with valid color spaces", () => {
      expect(isValidCSSColor("color(srgb 1 0 0)")).toBe(true);
      expect(isValidCSSColor("color(display-p3 1 0 0)")).toBe(true);
      expect(isValidCSSColor("color(a98-rgb 1 0 0)")).toBe(true);
      expect(isValidCSSColor("color(rec2020 1 0 0)")).toBe(true);
      expect(isValidCSSColor("color(xyz 1 0 0)")).toBe(true);
    });
  });

  describe("injection attempts", () => {
    it("rejects semicolon injection", () => {
      expect(isValidCSSColor("red; color: blue")).toBe(false);
      expect(isValidCSSColor("red; background: url(http://evil.com)")).toBe(false);
    });

    it("rejects brace injection", () => {
      expect(isValidCSSColor("red} * { color: blue")).toBe(false);
      expect(isValidCSSColor("red { color: blue }")).toBe(false);
    });

    it("rejects url() injection", () => {
      expect(isValidCSSColor("url(http://evil.com)")).toBe(false);
      expect(isValidCSSColor("red url(http://evil.com)")).toBe(false);
    });

    it("rejects expression() injection", () => {
      expect(isValidCSSColor("expression(alert(1))")).toBe(false);
    });

    it("rejects injection in function", () => {
      expect(isValidCSSColor("rgb(255, 0, 0); background: red")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects empty string", () => {
      expect(isValidCSSColor("")).toBe(false);
      expect(isValidCSSColor("   ")).toBe(false);
    });

    it("rejects invalid color names", () => {
      expect(isValidCSSColor("not-a-color")).toBe(false);
      expect(isValidCSSColor("reddish")).toBe(false);
      expect(isValidCSSColor("bluish")).toBe(false);
    });

    it("handles whitespace", () => {
      expect(isValidCSSColor("  red  ")).toBe(true);
      expect(isValidCSSColor("\t#ff0000\n")).toBe(true);
    });

    it("rejects null/undefined-like inputs", () => {
      expect(isValidCSSColor(null as unknown as string)).toBe(false);
      expect(isValidCSSColor(undefined as unknown as string)).toBe(false);
      expect(isValidCSSColor(123 as unknown as string)).toBe(false);
    });
  });
});

describe("sanitizeCSSCustomPropertyKey", () => {
  it("preserves valid keys", () => {
    expect(sanitizeCSSCustomPropertyKey("foo")).toBe("foo");
    expect(sanitizeCSSCustomPropertyKey("foo-bar")).toBe("foo-bar");
    expect(sanitizeCSSCustomPropertyKey("foo_bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("fooBar")).toBe("fooBar");
    expect(sanitizeCSSCustomPropertyKey("123foo")).toBe("123foo");
    expect(sanitizeCSSCustomPropertyKey("foo123")).toBe("foo123");
  });

  it("replaces special characters with underscore", () => {
    expect(sanitizeCSSCustomPropertyKey("foo.bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo;bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo:bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo,bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo@bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo#bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo$bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo%bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo^bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo&bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo*bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo(bar)")).toBe("foo_bar_");
    expect(sanitizeCSSCustomPropertyKey("foo[bar]")).toBe("foo_bar_");
    expect(sanitizeCSSCustomPropertyKey("foo{bar}")).toBe("foo_bar_");
    expect(sanitizeCSSCustomPropertyKey("foo|bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo/bar")).toBe("foo_bar");
    expect(sanitizeCSSCustomPropertyKey("foo\\bar")).toBe("foo_bar");
  });

  it("sanitizes double hyphen prefix", () => {
    expect(sanitizeCSSCustomPropertyKey("--foo")).toBe("__foo");
    expect(sanitizeCSSCustomPropertyKey("---foo")).toBe("___foo");
  });

  it("truncates to 100 characters", () => {
    const longKey = "a".repeat(150);
    expect(sanitizeCSSCustomPropertyKey(longKey).length).toBe(100);
  });

  it("handles empty string", () => {
    expect(sanitizeCSSCustomPropertyKey("")).toBe("");
  });

  it("handles null/undefined-like inputs", () => {
    expect(sanitizeCSSCustomPropertyKey(null as unknown as string)).toBe("");
    expect(sanitizeCSSCustomPropertyKey(undefined as unknown as string)).toBe("");
  });

  it("is deterministic", () => {
    const key = "foo.bar;baz";
    expect(sanitizeCSSCustomPropertyKey(key)).toBe(sanitizeCSSCustomPropertyKey(key));
    expect(sanitizeCSSCustomPropertyKey(key)).toBe("foo_bar_baz");
  });
});

describe("escapeCSSSelectorValue", () => {
  it("passes through simple values", () => {
    expect(escapeCSSSelectorValue("simple")).toBe("simple");
    expect(escapeCSSSelectorValue("with-hyphen")).toBe("with-hyphen");
    expect(escapeCSSSelectorValue("with_underscore")).toBe("with_underscore");
    expect(escapeCSSSelectorValue("123")).toBe("123");
  });

  it("escapes brackets", () => {
    expect(escapeCSSSelectorValue("with[bracket]")).toBe("with\\[bracket\\]");
    expect(escapeCSSSelectorValue("[starts]")).toBe("\\[starts\\]");
    expect(escapeCSSSelectorValue("ends]")).toBe("ends\\]");
  });

  it("escapes quotes", () => {
    expect(escapeCSSSelectorValue('quote"double')).toBe('quote\\"double');
    expect(escapeCSSSelectorValue("quote'single")).toBe("quote\\'single");
  });

  it("escapes backslash", () => {
    expect(escapeCSSSelectorValue("backslash\\path")).toBe("backslash\\\\path");
    expect(escapeCSSSelectorValue("\\")).toBe("\\\\");
  });

  it("escapes non-ASCII characters", () => {
    // é = U+00E9
    expect(escapeCSSSelectorValue("café")).toBe("caf\\E9 ");
    // ñ = U+00F1
    expect(escapeCSSSelectorValue("niño")).toBe("ni\\F1 o");
  });

  it("escapes emoji", () => {
    // 😀 = U+1F600
    expect(escapeCSSSelectorValue("😀")).toBe("\\1F600 ");
  });

  it("escapes control characters", () => {
    expect(escapeCSSSelectorValue("a\nb")).toBe("a\\A b");
    expect(escapeCSSSelectorValue("a\tb")).toBe("a\\9 b");
  });

  it("handles empty string", () => {
    expect(escapeCSSSelectorValue("")).toBe("");
  });

  it("handles null/undefined-like inputs", () => {
    expect(escapeCSSSelectorValue(null as unknown as string)).toBe("");
    expect(escapeCSSSelectorValue(undefined as unknown as string)).toBe("");
  });

  it("escapes multiple special chars", () => {
    expect(escapeCSSSelectorValue('[test]"value"')).toBe('\\[test\\]\\"value\\"');
  });
});