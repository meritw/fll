import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { MISSIONS, missionCard } from "./missions";

describe("mission cards", () => {
  it("points every seeded mission at a rulebook card in public/", () => {
    const seen = new Set<string>();
    for (const [number, name] of MISSIONS) {
      const card = missionCard(number);
      assert.ok(card, `${name} is missing a card`);
      assert.equal(seen.has(card.src), false, card.src);
      seen.add(card.src);
      const file = path.join(process.cwd(), "public", card.src);
      assert.equal(fs.existsSync(file), true, file);
      assert.ok(card.width > 400 && card.height > 400);
    }
    assert.equal(missionCard(16), null);
    assert.equal(seen.size, MISSIONS.length);
  });
});
