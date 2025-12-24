import { describe, it, expect } from 'vitest';
import { parseVisionMarkdown } from './vision';

describe('parseVisionMarkdown', () => {
  it('should return empty object for empty input', () => {
    const result = parseVisionMarkdown('');
    expect(result).toEqual({});
  });

  it('should parse a standard template correctly', () => {
    const markdown = `
## 🌟 Long-Term Aspiration (10+ Years)
Become the leading provider of sustainable energy solutions globally.

## 🎯 3-Year Vision
Expand to 3 continents and achieve $100M ARR.

## 📅 12-Month Goals
Launch the new solar storage product line.
Secure series B funding.

## 🧠 Core Values
1. Sustainability
2. Innovation
3. Integrity
`;
    const result = parseVisionMarkdown(markdown);

    expect(result.longTerm).toBe('Become the leading provider of sustainable energy solutions globally.');
    expect(result.threeYear).toBe('Expand to 3 continents and achieve $100M ARR.');
    expect(result.twelveMonth).toContain('Launch the new solar storage product line.');
    expect(result.twelveMonth).toContain('Secure series B funding.');
    expect(result.coreValues).toEqual(['Sustainability', 'Innovation', 'Integrity']);
  });

  it('should handle different list formats for Core Values', () => {
    const markdown = `
## 🧠 Core Values
- Customer Obsession
*  Bias for Action
3.  Think Big
`;
    const result = parseVisionMarkdown(markdown);
    expect(result.coreValues).toEqual(['Customer Obsession', 'Bias for Action', 'Think Big']);
  });

  it('should handle missing sections gracefully', () => {
    const markdown = `
## 📅 12-Month Goals
Survive the year.
`;
    const result = parseVisionMarkdown(markdown);
    expect(result.twelveMonth).toBe('Survive the year.');
    expect(result.longTerm).toBeUndefined();
    expect(result.threeYear).toBeUndefined();
    expect(result.coreValues).toBeUndefined();
  });

  it('should ignore content outside of known headers', () => {
    const markdown = `
# My Personal Vision
This is some intro text.

## 📅 12-Month Goals
Goal 1
`;
    const result = parseVisionMarkdown(markdown);
    expect(result.twelveMonth).toBe('Goal 1');
  });

  it('should handle extra whitespace and newlines', () => {
    const markdown = `
## 📅 12-Month Goals

   Goal A   
   Goal B   

## 🧠 Core Values
`;
    const result = parseVisionMarkdown(markdown);
    expect(result.twelveMonth).toBe('Goal A\n   Goal B');
  });
});
