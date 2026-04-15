type YamlScalar = boolean | null | number | string;
export type YamlValue = YamlObject | YamlScalar | YamlValue[];

export interface YamlObject {
  [key: string]: YamlValue;
}

interface Token {
  content: string;
  indent: number;
}

function stripInlineComment(line: string) {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? null : char;
      continue;
    }

    if (char === "#" && !quote) {
      const previous = index === 0 ? " " : line[index - 1];
      if (/\s/.test(previous)) {
        return line.slice(0, index).trimEnd();
      }
    }
  }

  return line.trimEnd();
}

function findUnquotedColon(value: string) {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? null : char;
      continue;
    }

    if (char === ":" && !quote) {
      return index;
    }
  }

  return -1;
}

function parseQuotedString(value: string) {
  const quote = value[0];
  const inner = value.slice(1, -1);

  if (quote === '"') {
    return inner.replace(/\\"/g, '"');
  }

  return inner.replace(/\\'/g, "'");
}

function parseScalar(value: string): YamlValue {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return parseQuotedString(trimmed);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();

    if (!inner) {
      return [];
    }

    return inner
      .split(",")
      .map((item) => parseScalar(item) as YamlScalar)
      .filter((item) => item !== "");
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed === "null") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

function tokenize(text: string): Token[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((rawLine) => {
      const line = stripInlineComment(rawLine);

      if (!line.trim()) {
        return null;
      }

      const indent = line.match(/^ */)?.[0].length ?? 0;

      return {
        indent,
        content: line.trimStart(),
      };
    })
    .filter((token): token is Token => token !== null);
}

function parseMapping(
  tokens: Token[],
  startIndex: number,
  indent: number,
): [YamlObject, number] {
  const object: YamlObject = {};
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.indent < indent || token.indent > indent) {
      break;
    }

    if (token.content.startsWith("- ")) {
      break;
    }

    const colonIndex = findUnquotedColon(token.content);

    if (colonIndex === -1) {
      index += 1;
      continue;
    }

    const key = token.content.slice(0, colonIndex).trim();
    const remainder = token.content.slice(colonIndex + 1).trim();

    index += 1;

    if (remainder) {
      object[key] = parseScalar(remainder);
      continue;
    }

    if (index < tokens.length && tokens[index].indent > indent) {
      const [nested, nextIndex] = parseBlock(tokens, index, tokens[index].indent);
      object[key] = nested;
      index = nextIndex;
      continue;
    }

    object[key] = "";
  }

  return [object, index];
}

function parseSequence(
  tokens: Token[],
  startIndex: number,
  indent: number,
): [YamlValue[], number] {
  const items: YamlValue[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.indent < indent || token.indent !== indent) {
      break;
    }

    if (!token.content.startsWith("- ")) {
      break;
    }

    const remainder = token.content.slice(2).trim();
    index += 1;

    if (!remainder) {
      if (index < tokens.length && tokens[index].indent > indent) {
        const [nested, nextIndex] = parseBlock(tokens, index, tokens[index].indent);
        items.push(nested);
        index = nextIndex;
      } else {
        items.push("");
      }
      continue;
    }

    const colonIndex = findUnquotedColon(remainder);

    if (colonIndex === -1) {
      items.push(parseScalar(remainder));
      continue;
    }

    const key = remainder.slice(0, colonIndex).trim();
    const value = remainder.slice(colonIndex + 1).trim();
    const entry: YamlObject = {};

    if (value) {
      entry[key] = parseScalar(value);
    } else if (index < tokens.length && tokens[index].indent > indent) {
      const [nested, nextIndex] = parseBlock(tokens, index, tokens[index].indent);
      entry[key] = nested;
      index = nextIndex;
    } else {
      entry[key] = "";
    }

    while (
      index < tokens.length &&
      tokens[index].indent > indent &&
      !tokens[index].content.startsWith("- ")
    ) {
      const [extra, nextIndex] = parseMapping(tokens, index, tokens[index].indent);
      Object.assign(entry, extra);
      index = nextIndex;
    }

    items.push(entry);
  }

  return [items, index];
}

function parseBlock(
  tokens: Token[],
  index: number,
  indent: number,
): [YamlValue, number] {
  if (!tokens[index]) {
    return [{}, index];
  }

  if (tokens[index].content.startsWith("- ")) {
    return parseSequence(tokens, index, indent);
  }

  return parseMapping(tokens, index, indent);
}

export function parseYaml(text: string): YamlObject {
  const tokens = tokenize(text);

  if (!tokens.length) {
    return {};
  }

  const [parsed] = parseBlock(tokens, 0, tokens[0].indent);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    return {};
  }

  return parsed;
}
