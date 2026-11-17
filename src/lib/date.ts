// Даты в frontmatter хранятся как момент времени в UTC.
// Форматируем строго в UTC, иначе у посетителей западнее Гринвича
// дата съезжает на предыдущий день.
export function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  });
}