export function normalizeNamePart(value: string): string {
  const letters = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 2).padEnd(2, 'X');
}

export function buildLoginId(
  initials: string,
  firstName: string,
  lastName: string,
  joinYear: number,
  serial: number
): string {
  const prefix = initials.replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(2, 'X').slice(0, 2);
  return `${prefix}${normalizeNamePart(firstName)}${normalizeNamePart(lastName)}${joinYear}${String(serial).padStart(4, '0')}`;
}
