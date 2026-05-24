export const fmtUSD = (n: number, digits = 2): string => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(digits)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(digits)}k`;
  return `$${n.toFixed(digits)}`;
};

export const fmtNum = (n: number, digits = 2): string => {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
};

export const fmtPct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`;
