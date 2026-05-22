function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatCompactDate(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatCompactDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function withCjkDateSpacing(value) {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g, '$1 年 $2 月 $3 日')
    .replace(/(^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g, '$1$2 月 $3 日');
}

export function formatLocaleDate(value, options) {
  if (options?.hour || options?.minute || options?.second) {
    return formatCompactDateTime(value);
  }
  return formatCompactDate(value);
}

export function formatLocaleDateTime(value) {
  return formatCompactDateTime(value);
}
