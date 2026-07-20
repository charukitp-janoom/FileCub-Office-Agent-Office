import { test } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited, recordFailure, recordSuccess } from "./login-rate-limit";

test("login-rate-limit: locks out after 5 failures, and a success clears the counter", () => {
  const key = `test-key-${Math.random()}`;
  assert.equal(isRateLimited(key), false);

  for (let i = 0; i < 4; i++) recordFailure(key);
  assert.equal(isRateLimited(key), false); // still under the threshold

  recordFailure(key); // 5th failure
  assert.equal(isRateLimited(key), true);

  recordSuccess(key);
  assert.equal(isRateLimited(key), false);
});

test("login-rate-limit: different keys are tracked independently", () => {
  const a = `key-a-${Math.random()}`;
  const b = `key-b-${Math.random()}`;
  for (let i = 0; i < 5; i++) recordFailure(a);
  assert.equal(isRateLimited(a), true);
  assert.equal(isRateLimited(b), false);
});
