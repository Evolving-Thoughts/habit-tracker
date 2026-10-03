import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { IDBFactory } from "fake-indexeddb";
const source = await readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
const id = "11111111-1111-4111-8111-111111111111";
async function setup(
  pref = { enabled: true, subscriptionId: id },
  permission = "granted",
  allowed = true,
) {
  const indexedDB = new IDBFactory();
  await new Promise((resolve, reject) => {
    const open = indexedDB.open("habit-push-preferences", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("settings");
    open.onerror = reject;
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(pref, "push");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const events = {};
  const shown = [];
  const requests = [];
  const opened = [];
  const focused = [];
  const self = {
    networkFails: false,
    location: { origin: "https://example.invalid" },
    addEventListener: (kind, fn) => (events[kind] = fn),
    registration: {
      showNotification: async (...args) => {
        shown.push(args);
      },
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [],
      openWindow: async (url) => {
        opened.push(url);
      },
    },
    skipWaiting: async () => {},
  };
  runInNewContext(source, {
    self,
    indexedDB,
    Notification: { permission },
    URL,
    Date,
    fetch: async (...args) => {
      requests.push(args);
      if (self.networkFails) throw new Error("offline");
      return { ok: true, json: async () => ({ allowed }) };
    },
  });
  const payload = {
    type: "timer-finished",
    timerId: id,
    deliveryId: id,
    subscriptionId: id,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    title: "Never expose this private title",
  };
  const push = (data = payload) =>
    new Promise((resolve, reject) =>
      events.push({
        data: { json: () => data },
        waitUntil: (promise) => promise.then(resolve, reject),
      }),
    );
  return { push, shown, requests, payload, events, self, opened, focused };
}
test("shows only the hardcoded neutral message, with safe root data and a deduplicating tag", async () => {
  const result = await setup();
  await result.push();
  assert.equal(result.shown.length, 1);
  assert.equal(result.shown[0][0], "Dein Timer ist abgelaufen");
  assert.ok(!JSON.stringify(result.shown).includes("Never expose"));
  assert.equal(result.shown[0][1].renotify, false);
  assert.equal(result.shown[0][1].data.url, "/");
  assert.equal(result.requests[0][0], `/api/push/deliveries/${id}`);
  assert.equal(result.requests[0][1].credentials, "include");
  assert.equal(result.requests[0][1].cache, "no-store");
});
for (const [label, pref, permission, allowed] of [
  ["explicit opt-out", { enabled: false, subscriptionId: id }, "granted", true],
  [
    "different/rebound device id",
    { enabled: true, subscriptionId: "other" },
    "granted",
    true,
  ],
  ["revoked permission", { enabled: true, subscriptionId: id }, "denied", true],
  [
    "revoked session or stopped timer",
    { enabled: true, subscriptionId: id },
    "granted",
    false,
  ],
])
  test(`does not show application notification after ${label}`, async () => {
    const result = await setup(pref, permission, allowed);
    await result.push();
    assert.equal(result.shown.length, 0);
  });
test("ignores expired, malformed and arbitrary-type messages", async () => {
  const result = await setup();
  for (const payload of [
    null,
    { ...result.payload, expiresAt: new Date(0).toISOString() },
    { ...result.payload, deliveryId: "bad" },
    { ...result.payload, type: "other" },
  ])
    await result.push(payload);
  assert.equal(result.shown.length, 0);
  assert.equal(result.requests.length, 0);
});
test("click opens only the app origin, not a payload-supplied external URL", async () => {
  const result = await setup();
  let closed = false;
  await new Promise((resolve, reject) =>
    result.events.notificationclick({
      notification: {
        close: () => {
          closed = true;
        },
        data: { url: "https://evil.example" },
      },
      waitUntil: (promise) => promise.then(resolve, reject),
    }),
  );
  assert.equal(closed, true);
  assert.deepEqual(result.opened, ["https://example.invalid/"]);
});
test("click focuses an existing same-origin window without discarding its current form", async () => {
  const result = await setup();
  result.self.clients.matchAll = async () => [
    {
      url: "https://example.invalid/",
      focus: async () => result.focused.push(true),
    },
  ];
  await new Promise((resolve, reject) =>
    result.events.notificationclick({
      notification: { close() {} },
      waitUntil: (promise) => promise.then(resolve, reject),
    }),
  );
  assert.deepEqual(result.focused, [true]);
  assert.deepEqual(result.opened, []);
});

test("an offline receipt check cannot produce an application notification", async () => {
  const result = await setup();
  result.self.networkFails = true;
  await result.push();
  assert.equal(result.shown.length, 0);
});
