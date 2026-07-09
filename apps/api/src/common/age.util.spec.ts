import { calculateAge, MINIMUM_DUEL_AGE } from './age.util';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('age.util', () => {
  describe('calculateAge', () => {
    it('returns 18 the day after the 18th birthday', () => {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      eighteenYearsAgo.setDate(eighteenYearsAgo.getDate() - 1);
      expect(calculateAge(toDateString(eighteenYearsAgo))).toBe(18);
    });

    it('returns 17 the day before the 18th birthday', () => {
      const almostEighteen = new Date();
      almostEighteen.setFullYear(almostEighteen.getFullYear() - 18);
      almostEighteen.setDate(almostEighteen.getDate() + 1);
      expect(calculateAge(toDateString(almostEighteen))).toBe(17);
    });

    it('returns 18 exactly on the 18th birthday', () => {
      const today = new Date();
      const birthday = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      expect(calculateAge(toDateString(birthday))).toBe(18);
    });

    it('computes age correctly for a much older birth date', () => {
      expect(calculateAge('1990-01-01')).toBeGreaterThanOrEqual(MINIMUM_DUEL_AGE);
    });
  });

  it('MINIMUM_DUEL_AGE is 18', () => {
    expect(MINIMUM_DUEL_AGE).toBe(18);
  });
});
