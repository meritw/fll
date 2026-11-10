import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commitNumberDraft } from "./number-draft";

describe("commitNumberDraft", () => {
  it("commits digit-only drafts and rejects empty or partial text", () => {
    assert.equal(commitNumberDraft("80"), 80);
    assert.equal(commitNumberDraft("0"), 0);
    assert.equal(commitNumberDraft(""), null);
    assert.equal(commitNumberDraft("8a"), null);
    assert.equal(commitNumberDraft(" 8"), null);
  });
});
