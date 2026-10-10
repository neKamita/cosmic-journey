export const LIGHT_YEAR_KM = 9.4607e12;

const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const plural = new Intl.PluralRules('ru-RU');

const LY_FORMS: Record<Intl.LDMLPluralRule, string> = {
  zero: 'св. лет',
  one: 'св. год',
  two: 'св. года',
  few: 'св. года',
  many: 'св. лет',
  other: 'св. года',
};

/** Russian form of "light years" for an integer count. */
export function lightYearsUnit(count: number): string {
  return LY_FORMS[plural.select(count)];
}

/**
 * Human-readable Russian distance, switching units with magnitude:
 * km → млн км → млрд км → трлн км → св. лет → млн/млрд св. лет.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1e6) return `${integer.format(Math.round(km))} км`;
  if (km < 1e9) return `${oneDecimal.format(km / 1e6)} млн км`;
  if (km < 1e12) return `${oneDecimal.format(km / 1e9)} млрд км`;
  if (km < LIGHT_YEAR_KM) return `${oneDecimal.format(km / 1e12)} трлн км`;

  const ly = km / LIGHT_YEAR_KM;
  if (ly < 10) return `${oneDecimal.format(ly)} ${LY_FORMS.other}`;
  if (ly < 1e6) {
    const rounded = Math.round(ly);
    return `${integer.format(rounded)} ${lightYearsUnit(rounded)}`;
  }
  if (ly < 1e9) return `${oneDecimal.format(ly / 1e6)} млн св. лет`;
  return `${oneDecimal.format(ly / 1e9)} млрд св. лет`;
}
