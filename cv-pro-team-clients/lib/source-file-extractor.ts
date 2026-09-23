import { Buffer } from 'node:buffer';
import { strFromU8, unzipSync } from 'fflate';

export type SourceExtraction = {
  status: 'text' | 'needs_visual_review' | 'unsupported_format' | 'extraction_failed';
  extractionMethod: string;
  text?: string;
  totalPages?: number;
  emptyPages?: number[];
  message?: string;
};

const WORD_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
]);

const OFFICE_ARCHIVE_EXTENSIONS = new Set([
  'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp',
]);

function extension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\s*\/?\s*>/gi, '\t')
      .replace(/<text:tab\s*\/?\s*>/gi, '\t')
      .replace(/<w:br\s*\/?\s*>/gi, '\n')
      .replace(/<a:br\s*\/?\s*>/gi, '\n')
      .replace(/<text:line-break\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:w:p|a:p|text:p|text:h|table:table-row|w:tr)>/gi, '\n')
      .replace(/<\/(?:w:tc|a:tc|table:table-cell)>/gi, '\t')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function naturalNumber(path: string) {
  return Number(path.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);
}

function archiveText(bytes: Uint8Array, names: string[]) {
  const archive = unzipSync(bytes);
  return names
    .filter((name) => archive[name])
    .map((name) => {
      const text = xmlToText(strFromU8(archive[name]));
      return text ? `[${name}]\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function extractSpreadsheetArchive(archive: Record<string, Uint8Array>) {
  const sharedXml = archive['xl/sharedStrings.xml']
    ? strFromU8(archive['xl/sharedStrings.xml'])
    : '';
  const sharedStrings = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)]
    .map((match) => xmlToText(match[1]));
  const sheets = Object.keys(archive)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => naturalNumber(a) - naturalNumber(b));
  return sheets.map((name) => {
    const xml = strFromU8(archive[name]);
    const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)].map((row) => {
      const cells = [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)].map((cell) => {
        const attributes = cell[1];
        const body = cell[2];
        const type = attributes.match(/\bt="([^"]+)"/i)?.[1] ?? '';
        if (type === 'inlineStr') return xmlToText(body);
        const rawValue = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
        if (type === 's') return sharedStrings[Number(rawValue)] ?? rawValue;
        return decodeXmlEntities(rawValue).trim();
      });
      return cells.join('\t').trimEnd();
    }).filter(Boolean);
    return rows.length ? `[${name}]\n${rows.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
}

function extractOfficeArchive(bytes: Uint8Array, fileName: string) {
  const archive = unzipSync(bytes);
  const ext = extension(fileName);
  if (ext === 'xlsx') return extractSpreadsheetArchive(archive);
  let names: string[];
  if (ext === 'docx') {
    names = Object.keys(archive).filter((name) =>
      /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(name),
    );
  } else if (ext === 'pptx') {
    names = Object.keys(archive)
      .filter((name) => /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i.test(name))
      .sort((a, b) => naturalNumber(a) - naturalNumber(b) || a.localeCompare(b));
  } else {
    names = ['content.xml'];
  }
  return archiveText(bytes, names);
}

function rtfToText(value: string) {
  return value
    .replace(/\\'([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_match, code) => String.fromCharCode(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\(?:par|line)\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(value: string) {
  return decodeXmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractLegacyWord(bytes: Uint8Array) {
  const { default: WordExtractor } = await import('word-extractor');
  const document = await new WordExtractor().extract(Buffer.from(bytes));
  return [
    document.getHeaders({ includeFooters: false }),
    document.getBody(),
    document.getTextboxes(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getAnnotations(),
    document.getFooters(),
  ].map((part) => part.trim()).filter(Boolean).join('\n\n');
}

export async function extractSourceText(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<SourceExtraction> {
  const mimeType = input.mimeType.toLowerCase().split(';', 1)[0];
  const ext = extension(input.fileName);

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    try {
      const { getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(input.bytes);
      try {
        if (pdf.numPages > 100) {
          return {
            status: 'needs_visual_review',
            extractionMethod: 'pdf-text',
            totalPages: pdf.numPages,
            message: 'PDF de plus de 100 pages : révision ciblée requise.',
          };
        }
        const pages: string[] = [];
        const emptyPages: number[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')
            .join('')
            .trim();
          if (!pageText) emptyPages.push(pageNumber);
          pages.push(`[Page ${pageNumber}]\n${pageText}`);
          page.cleanup();
        }
        const text = pages.join('\n\n').trim();
        return {
          status: emptyPages.length || !text ? 'needs_visual_review' : 'text',
          extractionMethod: 'pdf-text',
          text,
          totalPages: pdf.numPages,
          emptyPages,
          ...(emptyPages.length || !text
            ? { message: 'Certaines pages ne contiennent pas de texte exploitable et doivent être lues visuellement.' }
            : {}),
        };
      } finally {
        await pdf.loadingTask.destroy();
      }
    } catch {
      return {
        status: 'extraction_failed',
        extractionMethod: 'pdf-text',
        message: 'PDF illisible, chiffré ou endommagé.',
      };
    }
  }

  if (OFFICE_ARCHIVE_EXTENSIONS.has(ext)) {
    try {
      const text = extractOfficeArchive(input.bytes, input.fileName);
      return text
        ? { status: 'text', extractionMethod: `office-${ext}-xml`, text }
        : { status: 'needs_visual_review', extractionMethod: `office-${ext}-xml`, message: 'Le fichier Office ne contient aucun texte extractible.' };
    } catch {
      return { status: 'extraction_failed', extractionMethod: `office-${ext}-xml`, message: 'Archive Office illisible ou endommagée.' };
    }
  }

  if (mimeType === 'application/msword' || ext === 'doc') {
    try {
      const text = await extractLegacyWord(input.bytes);
      return text
        ? { status: 'text', extractionMethod: 'word-binary', text }
        : { status: 'needs_visual_review', extractionMethod: 'word-binary', message: 'Le document Word ne contient aucun texte extractible.' };
    } catch {
      return { status: 'extraction_failed', extractionMethod: 'word-binary', message: 'Document Word binaire illisible ou protégé.' };
    }
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  if (mimeType === 'application/rtf' || mimeType === 'text/rtf' || ext === 'rtf') {
    return { status: 'text', extractionMethod: 'rtf-text', text: rtfToText(decoder.decode(input.bytes)) };
  }
  if (mimeType === 'text/html' || ext === 'html' || ext === 'htm') {
    return { status: 'text', extractionMethod: 'html-text', text: htmlToText(decoder.decode(input.bytes)) };
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    ['txt', 'csv', 'tsv', 'json', 'xml', 'md', 'eml'].includes(ext)
  ) {
    return { status: 'text', extractionMethod: 'plain-text', text: decoder.decode(input.bytes).trim() };
  }

  if (WORD_MIME_TYPES.has(mimeType)) {
    return { status: 'extraction_failed', extractionMethod: 'office-document', message: 'Format bureautique reconnu mais non extractible.' };
  }
  return {
    status: 'unsupported_format',
    extractionMethod: 'none',
    message: 'Format non pris en charge pour une extraction de texte fiable.',
  };
}
