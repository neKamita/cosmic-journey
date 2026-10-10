import { describe, expect, it } from 'vitest';
import { LIGHT_YEAR_KM, formatDistance, lightYearsUnit } from './format';

// Intl uses non-breaking spaces as group separators; normalise them for readable assertions.
const plain = (s: string): string => s.replace(/[  ]/g, ' ');

describe('formatDistance', () => {
  it('formats kilometres with grouping', () => {
    expect(plain(formatDistance(400))).toBe('400 км');
    expect(plain(formatDistance(384_400))).toBe('384 400 км');
  });

  it('switches to millions, billions and trillions of km', () => {
    expect(plain(formatDistance(149.6e6))).toBe('149,6 млн км');
    expect(plain(formatDistance(25.9e9))).toBe('25,9 млрд км');
    expect(plain(formatDistance(4e12))).toBe('4,0 трлн км');
  });

  it('switches to light years from one light year', () => {
    expect(plain(formatDistance(4.24 * LIGHT_YEAR_KM))).toBe('4,2 св. года');
    expect(plain(formatDistance(26_700 * LIGHT_YEAR_KM))).toBe('26 700 св. лет');
    expect(plain(formatDistance(54e6 * LIGHT_YEAR_KM))).toBe('54,0 млн св. лет');
    expect(plain(formatDistance(46.5e9 * LIGHT_YEAR_KM))).toBe('46,5 млрд св. лет');
  });

  it('rejects invalid input', () => {
    expect(formatDistance(Number.NaN)).toBe('—');
    expect(formatDistance(-1)).toBe('—');
  });
});

describe('lightYearsUnit', () => {
  it('uses Russian plural forms', () => {
    expect(lightYearsUnit(1)).toBe('св. год');
    expect(lightYearsUnit(3)).toBe('св. года');
    expect(lightYearsUnit(11)).toBe('св. лет');
    expect(lightYearsUnit(21)).toBe('св. год');
  });
});
