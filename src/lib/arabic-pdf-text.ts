const PDF_RTL_SPACE = "\u00a0";

export function protectPdfRtlNumbers(text: string, arabicContext?: boolean): string {
  const containsArabic = arabicContext ?? /\p{Script=Arabic}/u.test(text);
  return text.replace(/\d+(?:[.,:/+-]\d+)*/gu, (token) => {
    const pdfToken = containsArabic ? Array.from(token).reverse().join("") : token;
    return `\u200e${pdfToken}\u200e`;
  });
}

function wrapLogicalWords(text: string, maxLineLength: number): string[][] {
  const limit = Math.max(1, Math.floor(maxLineLength));
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [[]];

  const lines: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const nextLength = currentLength + (current.length ? 1 : 0) + Array.from(word).length;
    if (current.length && nextLength > limit) {
      lines.push(current);
      current = [word];
      currentLength = Array.from(word).length;
    } else {
      current.push(word);
      currentLength = nextLength;
    }
  }

  if (current.length) lines.push(current);
  return lines;
}

export function toPdfRtlLines(text: string, maxLineLength: number): string[] {
  return text
    .normalize("NFC")
    .split(/\r?\n/u)
    .flatMap((paragraph) => {
      const arabicContext = /\p{Script=Arabic}/u.test(paragraph);
      return wrapLogicalWords(paragraph, maxLineLength).map((words) =>
        words.length
          ? words.map((word) => protectPdfRtlNumbers(word, arabicContext)).join(PDF_RTL_SPACE)
          : "",
      );
    });
}

export function toPdfRtlVisualText(text: string, maxLineLength: number): string {
  return toPdfRtlLines(text, maxLineLength).join("\n");
}
