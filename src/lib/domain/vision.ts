/**
 * Domain logic for parsing structured Vision documents.
 * Extracts key sections like "12-Month Goals", "Core Values", etc.
 */

export interface ParsedVision {
  longTerm?: string;
  threeYear?: string;
  twelveMonth?: string;
  coreValues?: string[];
}

export function parseVisionMarkdown(markdown: string): ParsedVision {
  const result: ParsedVision = {};

  if (!markdown) return result;

  // Normalize line endings
  const text = markdown.replace(/\r\n/g, "\n");

  // Extract 12-Month Goals
  // Matches content between "## 📅 12-Month Goals" and the next "##" header or end of string
  const twelveMonthMatch = text.match(/##\s*📅\s*12-Month Goals\s*([\s\S]*?)(?=##|$)/i);
  if (twelveMonthMatch && twelveMonthMatch[1]) {
    result.twelveMonth = twelveMonthMatch[1].trim();
  }

  // Extract 3-Year Vision
  const threeYearMatch = text.match(/##\s*🎯\s*3-Year Vision\s*([\s\S]*?)(?=##|$)/i);
  if (threeYearMatch && threeYearMatch[1]) {
    result.threeYear = threeYearMatch[1].trim();
  }

  // Extract Long-Term Aspiration
  const longTermMatch = text.match(/##\s*🌟\s*Long-Term Aspiration\s*\(?10\+ Years\)?\s*([\s\S]*?)(?=##|$)/i);
  if (longTermMatch && longTermMatch[1]) {
    result.longTerm = longTermMatch[1].trim();
  }

  // Extract Core Values
  const valuesMatch = text.match(/##\s*🧠\s*Core Values\s*([\s\S]*?)(?=##|$)/i);
  if (valuesMatch && valuesMatch[1]) {
    const valuesText = valuesMatch[1].trim();
    // Split by lines that look like list items (1., -, *)
    const lines = valuesText.split('\n');
    const values: string[] = [];
    
    for (const line of lines) {
      const cleaned = line.replace(/^(\d+\.|-|\*)\s*/, '').trim();
      if (cleaned) {
        values.push(cleaned);
      }
    }
    
    if (values.length > 0) {
      result.coreValues = values;
    }
  }

  return result;
}
