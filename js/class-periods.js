const MOBANK_CLASS_PERIODS = Object.freeze([
  Object.freeze({ value: 4, label: 'Period 4', shortLabel: 'P4' }),
  Object.freeze({ value: 5, label: 'Period 5', shortLabel: 'P5' }),
  Object.freeze({ value: 6, label: 'Period 6', shortLabel: 'P6' }),
  Object.freeze({ value: 7, label: 'Period 7', shortLabel: 'P7' }),
  Object.freeze({ value: 8, label: 'Symphonic Orchestra', shortLabel: 'Symphonic' }),
  Object.freeze({ value: 10, label: 'Chamber Orchestra', shortLabel: 'Chamber' })
]);

if (typeof window !== 'undefined') {
  window.MOBANK_CLASS_PERIODS = MOBANK_CLASS_PERIODS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MOBANK_CLASS_PERIODS;
}
