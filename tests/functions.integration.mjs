import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
const stamp = Date.now();
async function client(name) {
  const app = initializeApp(
    { projectId: "demo-grove", apiKey: "demo-key" },
    name + stamp,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  await createUserWithEmailAndPassword(
    auth,
    `${name}${stamp}@example.test`,
    "Test-password-123",
  );
  const f = getFunctions(app);
  connectFunctionsEmulator(f, "127.0.0.1", 5001);
  return {
    uid: auth.currentUser.uid,
    call: async (
      storeId,
      command,
      data = {},
      requestId = crypto.randomUUID(),
    ) =>
      (
        await httpsCallable(
          f,
          "storeApi",
        )({ storeId, command, data, requestId })
      ).data,
  };
}
test("server transactions prevent overselling and duplicate reservations and enforce ownership", async () => {
  const owner = await client("owner"),
    one = await client("one"),
    two = await client("two"),
    store = "test-" + stamp;
  await owner.call(store, "create", { name: "Test store" });
  await owner.call(store, "product", {
    id: "rice",
    name: "Rice",
    category: "Pantry",
    pack: "1 kg",
    price: 5000,
    stock: 1,
    visible: true,
    image: "",
  });
  const order = {
    items: [{ id: "rice", qty: 1 }],
    name: "Test",
    phone: "12345678",
    fulfillment: "pickup",
    payment: "cash",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    slot: "10:00–12:00",
  };
  const result = await Promise.allSettled([
    one.call(store, "checkout", order),
    two.call(store, "checkout", order),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const v = await owner.call(store, "view");
  assert.equal(v.products.rice.stock, 0);
  assert.equal(Object.keys(v.orders).length, 1);
  await assert.rejects(() => one.call(store, "product", { id: "bad" }));
  await owner.call(store, "product", {
    id: "rice",
    name: "Rice",
    category: "Pantry",
    pack: "1 kg",
    price: 5000,
    stock: 3,
    visible: true,
    image: "",
  });
  const key = "same-request";
  const dup = await Promise.all([
    one.call(store, "checkout", order, key),
    one.call(store, "checkout", order, key),
  ]);
  assert.equal(dup[0].orderId, dup[1].orderId);
  const final = await owner.call(store, "view");
  assert.equal(final.products.rice.stock, 2);
  const personal = await two.call(store, "view");
  assert.equal(personal.customers?.[one.uid], undefined);
  assert.equal(personal.draft, undefined);
});
