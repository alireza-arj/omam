/**
 * Minimal RFC 4180 writer. Every field is quoted so a note containing a comma,
 * a quote or a newline cannot shift the columns of a payroll export.
 */
function escapeField(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.map(escapeField).join(",")];

  for (const row of rows) {
    lines.push(row.map(escapeField).join(","));
  }

  // A BOM so Excel opens Persian names and Rial amounts as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
