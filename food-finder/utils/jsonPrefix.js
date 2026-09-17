/**
 * Parse the first complete JSON object/array from a text response.
 * Some MCP tools append a human-readable advisory after structured JSON.
 */
function extractFirstJsonValue(text) {
  if (typeof text !== 'string') return null;

  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      const expectedOpening = char === '}' ? '{' : '[';
      if (stack.pop() !== expectedOpening) return null;

      if (stack.length === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

module.exports = { extractFirstJsonValue };
