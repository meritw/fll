import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOME_MEDIA_SCOPE,
  isJournalMediaKey,
  isMediaScopeId,
  objectKeyForMedia,
} from "./storage";

describe("journal media object keys", () => {
  it("accepts meeting ids and the home scope", () => {
    assert.equal(isMediaScopeId("abc-meeting"), true);
    assert.equal(isMediaScopeId(HOME_MEDIA_SCOPE), true);
    assert.equal(isMediaScopeId("bad/id"), false);
    assert.equal(isMediaScopeId(".."), false);
  });

  it("builds and validates home media keys", () => {
    const key = objectKeyForMedia(HOME_MEDIA_SCOPE, "image/jpeg");
    assert.match(key, /^journal\/home\/[0-9a-f-]{36}\.jpg$/i);
    assert.equal(isJournalMediaKey(HOME_MEDIA_SCOPE, key), true);
    assert.equal(isJournalMediaKey("other-meeting", key), false);
  });

  it("still validates meeting media keys", () => {
    const meetingId = "11111111-1111-1111-1111-111111111111";
    const key = objectKeyForMedia(meetingId, "video/mp4");
    assert.equal(isJournalMediaKey(meetingId, key), true);
    assert.equal(isJournalMediaKey(HOME_MEDIA_SCOPE, key), false);
  });
});
