/**
 * markdownToTipTap.js
 *
 * Hand-rolled, regex-based Markdown → TipTap document JSON converter.
 * No external dependencies — pure JS.
 *
 * Supports:
 *  - Headings:       # H1  ## H2  ### H3
 *  - Bullet lists:   - item  or  * item
 *  - Ordered lists:  1. item
 *  - Tables:         | col | col |  (pipe-separated rows)
 *  - Bold:           **text**
 *  - Italic:         *text*  or  _text_
 *  - Plain paragraphs
 *
 * Returns a valid TipTap document: { type: 'doc', content: [...] }
 * Falls back to a single paragraph wrapping the raw string on any error.
 */

// ---------------------------------------------------------------------------
// Inline parser — converts a raw text string into an array of TipTap inline
// nodes, handling bold and italic marks.
// ---------------------------------------------------------------------------

/**
 * Parse inline Markdown (bold, italic) into TipTap text nodes with marks.
 * @param {string} text - Raw inline text, possibly containing ** and * / _
 * @returns {Array} Array of TipTap text/inline nodes
 */
function parseInline(text) {
  const nodes = [];

  // Token regex — order matters:
  //   1. Bold:   **...**
  //   2. Italic: *...*  or  _..._  (single, not double)
  //   3. Plain text run (anything else up to the next marker)
  const tokenRe = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|([^*_]+|[*_])/g;

  let match;
  while ((match = tokenRe.exec(text)) !== null) {
    if (match[1]) {
      // Bold: **text**
      const inner = match[2];
      nodes.push({
        type: 'text',
        text: inner,
        marks: [{ type: 'bold' }],
      });
    } else if (match[3]) {
      // Italic: *text*
      const inner = match[4];
      nodes.push({
        type: 'text',
        text: inner,
        marks: [{ type: 'italic' }],
      });
    } else if (match[5]) {
      // Italic: _text_
      const inner = match[6];
      nodes.push({
        type: 'text',
        text: inner,
        marks: [{ type: 'italic' }],
      });
    } else if (match[7]) {
      // Plain text (includes lone * or _ that didn't form a pair)
      const raw = match[7];
      if (raw.length > 0) {
        nodes.push({ type: 'text', text: raw });
      }
    }
  }

  return nodes.length > 0 ? nodes : (text ? [{ type: 'text', text: text }] : []);
}

// ---------------------------------------------------------------------------
// Block-level helpers
// ---------------------------------------------------------------------------

/**
 * Build a TipTap heading node.
 * @param {number} level - 1, 2, or 3
 * @param {string} text  - Raw inline content of the heading
 */
function makeHeading(level, text) {
  return {
    type: 'heading',
    attrs: { level },
    content: parseInline(text.trim()),
  };
}

/**
 * Build a TipTap paragraph node.
 * @param {string} text - Raw inline content
 */
function makeParagraph(text) {
  const content = parseInline(text);
  if (content.length > 0) {
    return { type: 'paragraph', content };
  }
  return { type: 'paragraph' };
}

/**
 * Build a TipTap listItem wrapping a paragraph.
 * @param {string} text - Raw inline content of the list item
 */
function makeListItem(text) {
  return {
    type: 'listItem',
    content: [makeParagraph(text.trim())],
  };
}

// ---------------------------------------------------------------------------
// Table parser
// ---------------------------------------------------------------------------

/**
 * Determine whether a line is a Markdown table separator row (e.g. |---|---|).
 * @param {string} line
 */
function isTableSeparator(line) {
  return /^\s*\|[\s\-:|]+\|\s*$/.test(line);
}

/**
 * Split a pipe-delimited table row into cell strings, trimming whitespace.
 * @param {string} line
 * @returns {string[]}
 */
function splitTableRow(line) {
  // Remove leading/trailing pipe then split
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Parse a block of consecutive table lines into a TipTap table node.
 * The first row is treated as a header row; the separator row is skipped;
 * all subsequent rows are body rows.
 *
 * @param {string[]} lines - The table lines (may include separator)
 * @returns {object} TipTap table node
 */
function parseTable(lines) {
  const rows = [];
  let headerDone = false;
  let isHeader = true;

  for (const line of lines) {
    if (isTableSeparator(line)) {
      // Skip separator and mark that header has been processed
      headerDone = true;
      isHeader = false;
      continue;
    }

    const cells = splitTableRow(line);
    const cellNodes = cells.map((cellText) => ({
      type: isHeader ? 'tableHeader' : 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [makeParagraph(cellText)],
    }));

    rows.push({
      type: 'tableRow',
      content: cellNodes,
    });

    if (!headerDone) {
      // First row done — next non-separator rows are body rows
      isHeader = false;
    }
  }

  return {
    type: 'table',
    content: rows,
  };
}

// ---------------------------------------------------------------------------
// Main parser — block-level state machine
// ---------------------------------------------------------------------------

/**
 * Convert a Markdown string to a TipTap document JSON object.
 *
 * @param {string} markdownString
 * @returns {{ type: 'doc', content: Array }}
 */
export function markdownToTipTap(markdownString) {
  // Fallback helper — used on any thrown exception
  const fallback = () => ({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: markdownString }],
      },
    ],
  });

  try {
    if (typeof markdownString !== 'string') {
      return fallback();
    }

    const lines = markdownString.split('\n');
    const docContent = [];

    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // -----------------------------------------------------------------------
      // Skip blank lines (they act as block separators)
      // -----------------------------------------------------------------------
      if (line.trim() === '') {
        i++;
        continue;
      }

      // -----------------------------------------------------------------------
      // Heading: # / ## / ###
      // -----------------------------------------------------------------------
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        docContent.push(makeHeading(level, headingMatch[2]));
        i++;
        continue;
      }

      // -----------------------------------------------------------------------
      // Table: line starts with a pipe character
      // -----------------------------------------------------------------------
      if (/^\s*\|/.test(line)) {
        const tableLines = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          tableLines.push(lines[i]);
          i++;
        }
        docContent.push(parseTable(tableLines));
        continue;
      }

      // -----------------------------------------------------------------------
      // Bullet list: - item  or  * item  (but NOT ** bold **)
      // Note: we check for a space after the marker to avoid matching **bold**
      // -----------------------------------------------------------------------
      if (/^[-*]\s+/.test(line)) {
        const listItems = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^[-*]\s+/, '');
          listItems.push(makeListItem(itemText));
          i++;
        }
        docContent.push({
          type: 'bulletList',
          content: listItems,
        });
        continue;
      }

      // -----------------------------------------------------------------------
      // Ordered list: 1. item
      // -----------------------------------------------------------------------
      if (/^\d+\.\s+/.test(line)) {
        const listItems = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\d+\.\s+/, '');
          listItems.push(makeListItem(itemText));
          i++;
        }
        docContent.push({
          type: 'orderedList',
          attrs: { start: 1 },
          content: listItems,
        });
        continue;
      }

      // -----------------------------------------------------------------------
      // Plain paragraph — consume consecutive non-blank, non-special lines
      // -----------------------------------------------------------------------
      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^#{1,3}\s+/.test(lines[i]) &&
        !/^\s*\|/.test(lines[i]) &&
        !/^[-*]\s+/.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }

      if (paraLines.length > 0) {
        // Join continuation lines with a space (soft wrap)
        docContent.push(makeParagraph(paraLines.join(' ')));
      }
    }

    // Guard: if nothing was parsed (e.g. all blank lines), return one empty paragraph
    if (docContent.length === 0) {
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      };
    }

    return { type: 'doc', content: docContent };
  } catch (_err) {
    return fallback();
  }
}

export default markdownToTipTap;
