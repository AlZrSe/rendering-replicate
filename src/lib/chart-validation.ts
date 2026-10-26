/**
 * Chart Validation Utilities
 *
 * Provides validation and sanitization functions for chart configuration
 * to prevent CSS injection vulnerabilities.
 */

/**
 * Validates that a string is a valid CSS color value.
 * Uses a comprehensive regex that matches all standard CSS color formats.
 *
 * @param value - The string to validate
 * @returns true if the value is a valid CSS color, false otherwise
 */
export function isValidCSSColor(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  // CSS Color keywords
  const colorKeywords = [
    "currentcolor",
    "transparent",
    "inherit",
    "initial",
    "unset",
    "revert",
    "revert-layer",
    // Named colors (subset of most common)
    "aliceblue",
    "antiquewhite",
    "aqua",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "black",
    "blanchedalmond",
    "blue",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkslategrey",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "fuchsia",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "gray",
    "green",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
    "lime",
    "limegreen",
    "linen",
    "magenta",
    "maroon",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "navy",
    "oldlace",
    "olive",
    "olivedrab",
    "orange",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "purple",
    "rebeccapurple",
    "red",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "silver",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "teal",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "white",
    "whitesmoke",
    "yellow",
    "yellowgreen",
  ];

  const lowerValue = trimmed.toLowerCase();
  if (colorKeywords.includes(lowerValue)) {
    return true;
  }

  // Hex colors: #rgb, #rgba, #rrggbb, #rrggbbaa
  const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  if (hexRegex.test(trimmed)) {
    return true;
  }

  // RGB/RGBA: rgb(), rgba() with numbers or percentages
  // rgb() takes 3 values, rgba() takes 4
  const rgbRegex = /^rgb\(\s*([0-9]{1,3}%?\s*,\s*){2}[0-9]{1,3}%?\s*\)$/;
  const rgbaRegex = /^rgba\(\s*([0-9]{1,3}%?\s*,\s*){3}[0-9.]+\s*\)$/;
  if (rgbRegex.test(trimmed) || rgbaRegex.test(trimmed)) {
    // Validate RGB values are in range
    const match = trimmed.match(
      /rgba?\(\s*([0-9.%]+)\s*,\s*([0-9.%]+)\s*,\s*([0-9.%]+)\s*(?:,\s*([0-9.]+))?\s*\)/,
    );
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const r = match[1];
      const g = match[2];
      const b = match[3];
      const a = match[4];
      const rVal = r.endsWith("%") ? (parseFloat(r) / 100) * 255 : parseFloat(r);
      const gVal = g.endsWith("%") ? (parseFloat(g) / 100) * 255 : parseFloat(g);
      const bVal = b.endsWith("%") ? (parseFloat(b) / 100) * 255 : parseFloat(b);
      const aVal = a !== undefined ? parseFloat(a) : 1;

      if (rVal < 0 || rVal > 255 || gVal < 0 || gVal > 255 || bVal < 0 || bVal > 255) {
        return false;
      }
      if (aVal < 0 || aVal > 1) {
        return false;
      }
      // Ensure rgb() doesn't have alpha, rgba() has alpha
      const isRgb = trimmed.startsWith("rgb(");
      const hasAlpha = a !== undefined;
      if (isRgb && hasAlpha) {
        return false;
      }
      if (!isRgb && !hasAlpha) {
        return false;
      }
      return true;
    }
    return false;
  }

  // HSL/HSLA: hsl(), hsla()
  const hslRegex =
    /^hsla?\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}%\s*,\s*[0-9]{1,3}%\s*(,\s*[0-9.]+)?\s*\)$/;
  if (hslRegex.test(trimmed)) {
    const match = trimmed.match(
      /hsla?\(\s*([0-9]+)\s*,\s*([0-9]+)%\s*,\s*([0-9]+)%\s*(?:,\s*([0-9.]+))?\s*\)/,
    );
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const h = match[1];
      const s = match[2];
      const l = match[3];
      const a = match[4];
      const hVal = parseInt(h, 10);
      const sVal = parseInt(s, 10);
      const lVal = parseInt(l, 10);
      const aVal = a !== undefined ? parseFloat(a) : 1;

      if (hVal < 0 || hVal > 360 || sVal < 0 || sVal > 100 || lVal < 0 || lVal > 100) {
        return false;
      }
      if (aVal < 0 || aVal > 1) {
        return false;
      }
      return true;
    }
    return false;
  }

  // LAB: lab()
  // Format: lab(L a b) or lab(L a b / alpha) or lab(L% a b / alpha)
  const labRegex = /^lab\(\s*([0-9.]+)%?\s+([0-9.-]+)\s+([0-9.-]+)\s*(?:\/\s*([0-9.]+))?\s*\)$/;
  if (labRegex.test(trimmed)) {
    const match = trimmed.match(labRegex);
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const l = match[1];
      const a = match[2];
      const b = match[3];
      const alpha = match[4];
      const lVal = l.endsWith("%") ? parseFloat(l) : parseFloat(l);
      const aVal = parseFloat(a);
      const bVal = parseFloat(b);
      const alphaVal = alpha !== undefined ? parseFloat(alpha) : 1;

      if (lVal < 0 || lVal > 100 || alphaVal < 0 || alphaVal > 1) {
        return false;
      }
      return true;
    }
    return false;
  }

  // LCH: lch()
  // Format: lch(L C H) or lch(L C H / alpha) or lch(L% C H / alpha)
  const lchRegex = /^lch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9]+)\s*(?:\/\s*([0-9.]+))?\s*\)$/;
  if (lchRegex.test(trimmed)) {
    const match = trimmed.match(lchRegex);
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const l = match[1];
      const c = match[2];
      const h = match[3];
      const alpha = match[4];
      const lVal = l.endsWith("%") ? parseFloat(l) : parseFloat(l);
      const cVal = parseFloat(c);
      const hVal = parseInt(h, 10);
      const alphaVal = alpha !== undefined ? parseFloat(alpha) : 1;

      if (
        lVal < 0 ||
        lVal > 100 ||
        cVal < 0 ||
        hVal < 0 ||
        hVal > 360 ||
        alphaVal < 0 ||
        alphaVal > 1
      ) {
        return false;
      }
      return true;
    }
    return false;
  }

  // OKLAB: oklab()
  // Format: oklab(L a b) or oklab(L a b / alpha) or oklab(L% a b / alpha)
  // Use simple string check first to avoid regex issues
  if (trimmed.startsWith("oklab(") && trimmed.endsWith(")")) {
    const content = trimmed.slice(6, -1).trim(); // Remove "oklab(" and ")"
    const parts = content.split(/\s+/).filter((p) => p !== "/");
    if (
      parts.length >= 3 &&
      parts.length <= 4 &&
      parts[0] !== undefined &&
      parts[1] !== undefined &&
      parts[2] !== undefined
    ) {
      const lStr = parts[0];
      const aStr = parts[1];
      const bStr = parts[2];
      const alphaStr = parts[3];

      const lVal = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
      const aVal = parseFloat(aStr);
      const bVal = parseFloat(bStr);
      const alphaVal = alphaStr !== undefined ? parseFloat(alphaStr) : 1;

      if (isNaN(lVal) || isNaN(aVal) || isNaN(bVal) || isNaN(alphaVal)) {
        return false;
      }
      if (lVal < 0) return false;
      if (lVal > 1) return false;
      if (alphaVal < 0) return false;
      if (alphaVal > 1) return false;
      return true;
    }
    return false;
  }

  // OKLCH: oklch()
  // Format: oklch(L C H) or oklch(L C H / alpha) or oklch(L% C H / alpha)
  // Use simple string check first to avoid regex issues
  if (trimmed.startsWith("oklch(") && trimmed.endsWith(")")) {
    const content = trimmed.slice(6, -1).trim(); // Remove "oklch(" and ")"
    const parts = content.split(/\s+/).filter((p) => p !== "/");
    if (
      parts.length >= 3 &&
      parts.length <= 4 &&
      parts[0] !== undefined &&
      parts[1] !== undefined &&
      parts[2] !== undefined
    ) {
      const lStr = parts[0];
      const cStr = parts[1];
      const hStr = parts[2];
      const alphaStr = parts[3];

      const lVal = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
      const cVal = parseFloat(cStr);
      const hVal = parseInt(hStr, 10);
      const alphaVal = alphaStr !== undefined ? parseFloat(alphaStr) : 1;

      if (isNaN(lVal) || isNaN(cVal) || isNaN(hVal) || isNaN(alphaVal)) {
        return false;
      }
      // Validate ranges per CSS spec - explicit checks
      if (lVal < 0) return false;
      if (lVal > 1) return false;
      if (cVal < 0) return false;
      if (hVal < 0) return false;
      if (hVal > 360) return false;
      if (alphaVal < 0) return false;
      if (alphaVal > 1) return false;
      return true;
    }
    return false;
  }

  // color() function (color space colors)
  const colorRegex = /^color\(\s*[\w-]+\s+[0-9.\s/]+\s*\)$/;
  if (colorRegex.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a key for use as a CSS custom property name.
 * Only allows alphanumeric characters, hyphens, and underscores.
 *
 * @param key - The input key to sanitize
 * @returns Sanitized key safe for use in CSS custom property names
 */
export function sanitizeCSSCustomPropertyKey(key: string): string {
  if (!key || typeof key !== "string") {
    return "";
  }

  // Replace any character not matching [a-zA-Z0-9_-] with underscore
  let sanitized = key.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Ensure it doesn't start with hyphens (we add --color- prefix)
  // Convert each leading hyphen to underscore
  let leadingHyphens = 0;
  for (let i = 0; i < sanitized.length; i++) {
    if (sanitized[i] === "-") {
      leadingHyphens++;
    } else {
      break;
    }
  }
  if (leadingHyphens > 0) {
    sanitized = "_".repeat(leadingHyphens) + sanitized.slice(leadingHyphens);
  }

  // Trim to reasonable length (100 chars)
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  return sanitized;
}

/**
 * Escapes a value for safe use in a CSS attribute selector.
 * Per CSSOM spec: escape [, ], ", ', \, and non-ASCII characters.
 *
 * @param value - The value to escape
 * @returns Escaped value safe for use in CSS attribute selectors
 */
export function escapeCSSSelectorValue(value: string): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  let escaped = "";

  for (let i = 0; i < value.length; i++) {
    // Use codePointAt on the string directly to handle surrogate pairs correctly
    const code = value.codePointAt(i);
    if (code === undefined) {
      continue;
    }

    // Handle surrogate pairs - skip the next code unit if this is a high surrogate
    if (code > 0xffff) {
      i++; // Skip the low surrogate
    }

    const char = value[i];

    // Escape special characters per CSSOM spec
    if (char === "[" || char === "]" || char === '"' || char === "'" || char === "\\") {
      escaped += "\\" + char;
    }
    // Escape non-ASCII characters (code > 127)
    else if (code > 127) {
      // Use minimal hex digits with space terminator per CSSOM spec
      escaped += "\\" + code.toString(16).toUpperCase() + " ";
    }
    // ASCII printable characters (32-126) - keep as-is
    else if (code >= 32 && code <= 126) {
      escaped += char;
    }
    // Control characters - escape as minimal hex
    else {
      escaped += "\\" + code.toString(16).toUpperCase() + " ";
    }
  }

  return escaped;
}

/**
 * Development-mode warning for rejected color values.
 * Logs a warning to console.
 *
 * @param color - The rejected color value
 * @param key - The config key associated with the color
 */
export function warnInvalidColor(color: string, key: string): void {
  console.warn(
    `[Chart] Invalid color value for key "${key}": "${color}". ` +
      "Color will be ignored. Use a valid CSS color format.",
  );
}
