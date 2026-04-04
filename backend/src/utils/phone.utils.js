const PK_LOCAL_REGEX = /^03\d{9}$/;
const PK_INTL_REGEX = /^\+923\d{9}$/;
const PK_INTL_WITHOUT_PLUS_REGEX = /^923\d{9}$/;

export const sanitizePhoneInput = (value = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return `${hasPlus ? "+" : ""}${digits}`;
};

export const normalizePakistanPhone = (value = "") => {
  const sanitized = sanitizePhoneInput(value);
  if (!sanitized) return "";

  const digits = sanitized.replace(/\D/g, "");
  if (PK_LOCAL_REGEX.test(digits)) {
    return `+92${digits.slice(1)}`;
  }
  if (PK_INTL_WITHOUT_PLUS_REGEX.test(digits)) {
    return `+${digits}`;
  }
  if (PK_INTL_REGEX.test(sanitized)) {
    return sanitized;
  }
  return sanitized;
};

export const isPakistanPhone = (value = "") => {
  const normalized = normalizePakistanPhone(value);
  return PK_INTL_REGEX.test(normalized);
};
