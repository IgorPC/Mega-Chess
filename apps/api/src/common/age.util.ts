// Parses the "YYYY-MM-DD" parts directly instead of `new Date(birthDate)`,
// which treats date-only strings as UTC midnight and can shift the local
// calendar day by one in negative-offset timezones (e.g. Brazil), causing
// an off-by-one age right around the birthday.
export function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = (today.getMonth() + 1) - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return age;
}

export const MINIMUM_DUEL_AGE = 18;
