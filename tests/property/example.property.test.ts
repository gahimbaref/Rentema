/**
 * Example property-based test to verify fast-check setup
 */

import * as fc from 'fast-check';

describe('Property-Based Testing Setup', () => {
  it('should run property-based tests with fast-check', () => {
    // Example property: reversing a string twice returns the original
    fc.assert(
      fc.property(fc.string(), (str) => {
        const reversed = str.split('').reverse().join('');
        const doubleReversed = reversed.split('').reverse().join('');
        return doubleReversed === str;
      }),
      { numRuns: 100 }
    );
  });

  it('should generate random data for testing', () => {
    // Example property: array length is preserved after mapping
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const mapped = arr.map(x => x * 2);
        return mapped.length === arr.length;
      }),
      { numRuns: 100 }
    );
  });
});
