// Lao mobile numbers: 020XXXXXXXX (11 digits) or 030XXXXXXX (10 digits).
// Spaces/dashes are stripped; a +856 / 856 prefix becomes 0 (same rule as the API).

export function normalizePhone(input: string): string {
  let s = input.replace(/[\s\-().]/g, '');
  if (s.startsWith('+856')) s = `0${s.slice(4)}`;
  else if (s.startsWith('856')) s = `0${s.slice(3)}`;
  return s;
}

export function isValidLaoPhone(input: string): boolean {
  const s = normalizePhone(input);
  return /^020\d{8}$/.test(s) || /^030\d{7}$/.test(s);
}
