import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import test from "node:test";
const env = await initializeTestEnvironment({
  projectId: "demo-grove",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "stores/one"), { config: { ownerId: "owner1" } });
  await setDoc(doc(db, "stores/two"), { config: { ownerId: "owner2" } });
  await setDoc(doc(db, "stores/one/orders/o"), {
    uid: "customer1",
    total: 500,
  });
  await setDoc(doc(db, "stores/one/customers/customer1"), { creditLimit: 100 });
  await setDoc(doc(db, "publicStores/one"), { config: { status: "active" } });
  await setDoc(doc(db, "publicStores/one/products/p"), { visible: true });
  await setDoc(doc(db, "publicStores/one/products/hidden"), { visible: false });
});
test("customers cannot read other customers, owners cannot cross stores, balances are write protected", async () => {
  const c = env.authenticatedContext("customer1").firestore(),
    other = env.authenticatedContext("customer2").firestore(),
    owner = env.authenticatedContext("owner1").firestore(),
    anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(c, "stores/one/orders/o")));
  await assertFails(getDoc(doc(other, "stores/one/orders/o")));
  await assertFails(getDoc(doc(owner, "stores/two")));
  await assertFails(
    setDoc(doc(c, "stores/one/customers/customer1"), { creditLimit: 999999 }),
  );
  await assertFails(setDoc(doc(owner, "stores/one/orders/o"), { total: 0 }));
  await assertSucceeds(getDoc(doc(anon, "publicStores/one/products/p")));
  await assertFails(getDoc(doc(anon, "publicStores/one/products/hidden")));
  await assertFails(getDoc(doc(anon, "stores/one/orders/o")));
});
test.after(async () => env.cleanup());
