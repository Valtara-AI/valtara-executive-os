import * as React from "react";

// Deliberately not a general Markdown renderer, and not react-markdown/
// remark - these four legal documents only use headers, bold, horizontal
// rules, pipe tables, and blank-line-separated paragraphs, so a full
// CommonMark parser is unjustified weight for a v1 legal page. If a future
// doc needs constructs this doesn't handle (nested lists, links, code
// blocks), reach for a real library instead of extending this by hand.

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

function renderTable(lines: string[], key: number): React.ReactNode {
  const rows = lines
    .filter((line) => !/^\|[\s-|]+\|$/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const [header, ...body] = rows;
  if (!header) return null;

  return (
    <div key={key} className="overflow-x-auto">
      <table className="my-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border-b border-border px-2 py-1 text-left font-medium">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-border px-2 py-1 align-top">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderLegalMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push(<hr key={key++} className="my-4 border-border" />);
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2]!;
      const className =
        level === 1
          ? "mt-6 text-xl font-semibold"
          : level === 2
            ? "mt-5 text-lg font-semibold"
            : "mt-4 text-base font-semibold";
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={key++} className={className}>
          {renderInline(text)}
        </Tag>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        tableLines.push(lines[i]!.trim());
        i++;
      }
      blocks.push(renderTable(tableLines, key++));
      continue;
    }

    if (/^-\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^-\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc pl-6 text-sm">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Plain paragraph - collect until the next blank line or a line that
    // starts a different block type (heading, table, list, rule).
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^(#{1,3})\s/.test(lines[i]!) &&
      !lines[i]!.trim().startsWith("|") &&
      !/^-\s+/.test(lines[i]!.trim()) &&
      lines[i]!.trim() !== "---"
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 text-sm">
        {renderInline(paraLines.join(" "))}
      </p>,
    );
  }

  return blocks;
}
