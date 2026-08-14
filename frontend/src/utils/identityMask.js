export function maskAadhaar(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function maskPan(value) {
  const pan = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (pan.length !== 10) return String(value || '');
  return `${pan.slice(0, 3)}XX${pan.slice(5, 9)}X`;
}

export function maskPassport(value) {
  const raw = String(value || '').toUpperCase().replace(/\s+/g, '');
  if (raw.length < 3) return '';
  return `${raw[0]}${'X'.repeat(Math.max(raw.length - 3, 1))}${raw.slice(-2)}`;
}

export function maskVoterId(value) {
  const raw = String(value || '').toUpperCase().replace(/\s+/g, '');
  if (raw.length < 3) return '';
  return `${raw.slice(0, 2)}${'X'.repeat(Math.max(raw.length - 4, 1))}${raw.slice(-2)}`;
}

export function maskIdentity(idType, value) {
  if (!value) return '';
  const type = String(idType || '').toLowerCase();
  if (type.includes('aadhaar') || type.includes('aadhar') || /^\d{12}$/.test(String(value).replace(/\D/g, ''))) {
    return maskAadhaar(value);
  }
  if (type === 'pan' || /^[A-Z]{5}\d{4}[A-Z]$/i.test(value)) return maskPan(value);
  if (type.includes('passport')) return maskPassport(value);
  if (type.includes('voter')) return maskVoterId(value);
  const text = String(value);
  if (text.length <= 4) return text;
  return `${'X'.repeat(text.length - 4)}${text.slice(-4)}`;
}

export function isPlainIdentity(idType, value) {
  if (!value || /x{2,}/i.test(String(value))) return false;
  const type = String(idType || '').toLowerCase();
  if (type.includes('aadhaar') || type.includes('aadhar')) return /^\d{12}$/.test(String(value).replace(/\D/g, ''));
  if (type === 'pan') return /^[A-Z]{5}\d{4}[A-Z]$/i.test(String(value).replace(/\s/g, ''));
  if (type.includes('passport') || type.includes('voter')) return String(value).replace(/\s/g, '').length >= 6;
  return false;
}
