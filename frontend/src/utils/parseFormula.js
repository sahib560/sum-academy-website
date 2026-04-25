const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeAllowedHtml = (input = "") => {
  const raw = String(input ?? "");
  const placeholders = {
    "[[SUP_O]]": "<sup>",
    "[[SUP_C]]": "</sup>",
    "[[SUB_O]]": "<sub>",
    "[[SUB_C]]": "</sub>",
    "[[BR]]": "<br>",
    "[[B_O]]": "<b>",
    "[[B_C]]": "</b>",
    "[[I_O]]": "<i>",
    "[[I_C]]": "</i>",
    "[[EM_O]]": "<em>",
    "[[EM_C]]": "</em>",
    "[[STR_O]]": "<strong>",
    "[[STR_C]]": "</strong>",
  };

  let text = raw
    .replace(/<\s*sup\s*>/gi, "[[SUP_O]]")
    .replace(/<\s*\/\s*sup\s*>/gi, "[[SUP_C]]")
    .replace(/<\s*sub\s*>/gi, "[[SUB_O]]")
    .replace(/<\s*\/\s*sub\s*>/gi, "[[SUB_C]]")
    .replace(/<\s*br\s*\/?\s*>/gi, "[[BR]]")
    .replace(/<\s*b\s*>/gi, "[[B_O]]")
    .replace(/<\s*\/\s*b\s*>/gi, "[[B_C]]")
    .replace(/<\s*i\s*>/gi, "[[I_O]]")
    .replace(/<\s*\/\s*i\s*>/gi, "[[I_C]]")
    .replace(/<\s*em\s*>/gi, "[[EM_O]]")
    .replace(/<\s*\/\s*em\s*>/gi, "[[EM_C]]")
    .replace(/<\s*strong\s*>/gi, "[[STR_O]]")
    .replace(/<\s*\/\s*strong\s*>/gi, "[[STR_C]]");

  text = text.replace(/<\/?[^>]+>/g, "");
  text = escapeHtml(text);
  Object.entries(placeholders).forEach(([key, tag]) => {
    text = text.split(key).join(tag);
  });
  return text;
};

export const parseFormula = (text) => {
  if (!text || typeof text !== "string") return String(text ?? "");
  let result = String(text);

  const encodingFixes = {
    "â‚‚": "₂",
    "â‚ƒ": "₃",
    "â‚„": "₄",
    "â‚…": "₅",
    "â‚†": "₆",
    "â‚‡": "₇",
    "â‚ˆ": "₈",
    "â‚‰": "₉",
    "â‚€": "₀",
    "Â²": "²",
    "Â³": "³",
    "â°": "⁰",
    "âº": "⁺",
    "â»": "⁻",
    "â¼": "⁼",
    "â€™": "'",
    "â€œ": '"',
    "â€": '"',
    "Ã±": "ñ",
    "Ã©": "é",
  };
  Object.entries(encodingFixes).forEach(([bad, good]) => {
    result = result.split(bad).join(good);
  });

  result = result.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
  result = result.replace(/\^([a-zA-Z0-9+\-*/=]+)/g, "<sup>$1</sup>");

  result = result.replace(/\_\{([^}]+)\}/g, "<sub>$1</sub>");
  result = result.replace(/\_([a-zA-Z0-9]+)/g, "<sub>$1</sub>");

  const greekLetters = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\gamma": "γ",
    "\\delta": "δ",
    "\\theta": "θ",
    "\\lambda": "λ",
    "\\mu": "μ",
    "\\pi": "π",
    "\\sigma": "σ",
    "\\omega": "ω",
    "\\Delta": "Δ",
    "\\Gamma": "Γ",
    "\\Theta": "Θ",
    "\\Lambda": "Λ",
    "\\Omega": "Ω",
  };
  Object.entries(greekLetters).forEach(([code, char]) => {
    result = result.split(code).join(char);
  });

  const mathSymbols = {
    "\\times": "×",
    "\\div": "÷",
    "\\pm": "±",
    "\\neq": "≠",
    "\\leq": "≤",
    "\\geq": "≥",
    "\\approx": "≈",
    "\\infty": "∞",
    "\\degree": "°",
    "\\sqrt": "√",
    "<->": "↔",
    "->": "→",
    "=>": "⇒",
    "!=": "≠",
    "<=": "≤",
    ">=": "≥",
    "+-": "±",
    "...": "…",
    degC: "°C",
    degF: "°F",
  };
  Object.entries(mathSymbols).forEach(([code, char]) => {
    result = result.split(code).join(char);
  });

  return sanitizeAllowedHtml(result);
};

export const stripFormulaHtml = (html = "") =>
  String(html ?? "").replace(/<\/?[^>]+>/g, "").trim();

