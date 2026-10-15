import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { highlightLines } from "./highlight";

describe("highlightLines", () => {
  it("colors a Python keyword and escapes a tag in the same file", async () => {
    const lines = await highlightLines('from pybricks.hubs import PrimeHub\nx = "<b>"\n', "python");
    assert.match(lines[0], /<span class="code-token"/);
    assert.match(lines[0], /--shiki-light:#D73A49/);
    assert.match(lines[0], />from</);
    assert.match(lines[1], /&lt;b&gt;/);
    assert.doesNotMatch(lines[1], /<b>/);
  });

  it("escapes plain text without coloring it", async () => {
    const lines = await highlightLines("<script>\n", "plaintext");
    assert.deepEqual(lines, ["&lt;script&gt;"]);
  });

  it("leaves a very long Python file as escaped text", async () => {
    const text = Array.from({ length: 4001 }, () => "from").join("\n");
    const lines = await highlightLines(text, "python");
    assert.equal(lines.length, 4001);
    assert.equal(lines[0], "from");
  });
});
