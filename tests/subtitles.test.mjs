import test from "node:test";
import assert from "node:assert/strict";

function splitIntoPhrases(text) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const phrases = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    const joined = current.join(" ");
    if (current.length >= 5 || /[.!?]$/.test(word) || joined.length > 34) {
      phrases.push(joined);
      current = [];
    }
  }
  if (current.length) phrases.push(current.join(" "));
  return phrases;
}

test("subtitle phrases stay short enough for Shorts", () => {
  const phrases = splitIntoPhrases("Here is a quick story from Japan. More visitors are looking beyond Tokyo and Osaka.");
  assert.ok(phrases.length >= 3);
  assert.ok(phrases.every((phrase) => phrase.length <= 42));
});
