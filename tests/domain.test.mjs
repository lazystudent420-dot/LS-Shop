import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyStore,
  execute,
  dueBalance,
  reservedCredit,
  viewStore,
  quote,
  reminderDue,
  money,
} from "../functions/src/engine.mjs";
const owner = { uid: "owner", anonymous: false },
  customer = {
    uid: "customer",
    anonymous: false,
    email: "c@example.test",
    emailVerified: true,
  };
const now = Date.parse("2026-09-12T06:00:00Z");
function fixture() {
  const s = emptyStore("owner");
  s.products.p = {
    id: "p",
    name: "Rice",
    pack: "1 kg",
    category: "Pantry",
    price: 10000,
    salePrice: null,
    stock: 10,
    visible: true,
  };
  s.customers.customer = {
    id: "customer",
    name: "Customer",
    creditApproved: true,
    creditLimit: 100000,
    email: "c@example.test",
    emailVerified: true,
  };
  return s;
}
const checkout = {
  items: [{ id: "p", qty: 2 }],
  name: "Customer",
  phone: "1234567890",
  fulfillment: "pickup",
  payment: "credit",
  date: "2026-09-13",
  slot: "10:00–12:00",
};
const go = (s, who, cmd, data, key = "test") =>
  execute(s, who, cmd, data, key, now);
test("checkout reserves stock and credit; duplicate retry returns original", () => {
  let r = go(fixture(), customer, "checkout", checkout);
  assert.equal(r.state.products.p.stock, 8);
  assert.equal(reservedCredit(r.state, "customer"), 20000);
  assert.equal(dueBalance(r.state, "customer"), 0);
  const again = go(r.state, customer, "checkout", checkout);
  assert.deepEqual(again, r);
});
test("server ignores submitted price and total", () => {
  const r = go(fixture(), customer, "checkout", {
    ...checkout,
    total: 1,
    items: [{ id: "p", qty: 1, price: 1 }],
  });
  assert.equal(r.state.orders["O-test"].total, 10000);
});
test("acceptance converts reservation into a charge once", () => {
  let s = go(fixture(), customer, "checkout", checkout).state;
  s = go(
    s,
    owner,
    "order",
    { id: "O-test", status: "Accepted" },
    "accept",
  ).state;
  assert.equal(dueBalance(s, "customer"), 20000);
  assert.equal(reservedCredit(s, "customer"), 0);
  assert.equal(
    go(s, owner, "order", { id: "O-test", status: "Accepted" }, "accept").state
      .charges["O-test"].amount,
    20000,
  );
});
test("cancellation restores stock exactly once", () => {
  let s = go(fixture(), customer, "checkout", checkout).state;
  s = go(
    s,
    customer,
    "order",
    { id: "O-test", status: "Cancelled" },
    "cancel",
  ).state;
  assert.equal(s.products.p.stock, 10);
  assert.equal(
    go(s, customer, "order", { id: "O-test", status: "Cancelled" }, "cancel")
      .state.products.p.stock,
    10,
  );
  assert.throws(
    () => go(s, owner, "order", { id: "O-test", status: "Cancelled" }, "other"),
    /transition/,
  );
});
test("paid allocations block cancellation until reversed", () => {
  let s = go(fixture(), customer, "checkout", checkout).state;
  s = go(
    s,
    owner,
    "order",
    { id: "O-test", status: "Accepted" },
    "accept",
  ).state;
  s = go(
    s,
    owner,
    "payment",
    { uid: "customer", amount: 5000, method: "Cash" },
    "pay",
  ).state;
  assert.throws(
    () =>
      go(s, owner, "order", { id: "O-test", status: "Cancelled" }, "cancel"),
    /Reverse allocated/,
  );
  s = go(
    s,
    owner,
    "reverse",
    { id: "P-pay", kind: "payment", reason: "Refunded in cash" },
    "reverse",
  ).state;
  s = go(
    s,
    owner,
    "order",
    { id: "O-test", status: "Cancelled" },
    "cancel",
  ).state;
  assert.equal(dueBalance(s, "customer"), 0);
  assert.equal(s.products.p.stock, 10);
});
test("overpayment and credit overrun rejected", () => {
  assert.throws(
    () =>
      go(fixture(), owner, "payment", {
        uid: "customer",
        amount: 1,
        method: "Cash",
      }),
    /exceeds/,
  );
  const s = fixture();
  s.customers.customer.creditLimit = 100;
  assert.throws(() => go(s, customer, "checkout", checkout), /limit/);
});
test("oldest charges settle first; payment retry does not double collect", () => {
  let s = go(
    fixture(),
    owner,
    "charge",
    {
      uid: "customer",
      amount: 5000,
      description: "Previous due",
      dueDate: "2026-09-12",
    },
    "a",
  ).state;
  s = go(
    s,
    owner,
    "charge",
    {
      uid: "customer",
      amount: 8000,
      description: "Next due",
      dueDate: "2026-09-13",
    },
    "b",
  ).state;
  s = go(
    s,
    owner,
    "payment",
    { uid: "customer", amount: 7000, method: "Cash" },
    "p",
  ).state;
  assert.equal(s.charges["C-a"].remaining, 0);
  assert.equal(s.charges["C-b"].remaining, 6000);
  assert.equal(
    dueBalance(
      go(
        s,
        owner,
        "payment",
        { uid: "customer", amount: 7000, method: "Cash" },
        "p",
      ).state,
      "customer",
    ),
    6000,
  );
});
test("customers cannot mutate products, credit, or ledger", () => {
  for (const cmd of [
    "product",
    "customer",
    "charge",
    "payment",
    "reverse",
    "settings",
    "publish",
    "draft",
  ])
    assert.throws(() => go(fixture(), customer, cmd, {}), /Owner/);
});
test("different owner cannot operate this shop", () => {
  assert.throws(
    () => go(fixture(), { uid: "other-owner" }, "product", {}),
    /Owner/,
  );
});
test("another customer cannot read order details", () => {
  const s = go(fixture(), customer, "checkout", checkout).state;
  const v = viewStore(s, { uid: "outsider" });
  assert.equal(Object.keys(v.orders).length, 0);
  assert.equal(Object.keys(v.customers).length, 0);
  assert.equal(v.audit, undefined);
  assert.equal(v.draft, undefined);
});
test("customer can cancel only their placed order", () => {
  let s = go(fixture(), customer, "checkout", checkout).state;
  assert.throws(
    () =>
      go(s, { uid: "other" }, "order", { id: "O-test", status: "Cancelled" }),
    /Cannot/,
  );
  s = go(s, owner, "order", { id: "O-test", status: "Accepted" }, "a").state;
  assert.throws(
    () =>
      go(
        s,
        customer,
        "order",
        { id: "O-test", status: "Cancelled" },
        "cancel-new",
      ),
    /Cannot/,
  );
});
test("stock, duplicate lines, invalid quantities rejected", () => {
  const s = fixture();
  assert.throws(
    () =>
      quote(
        s,
        [
          { id: "p", qty: 7 },
          { id: "p", qty: 7 },
        ],
        "pickup",
      ),
    /stock/,
  );
  for (const qty of [-1, 0, 1.5, NaN])
    assert.throws(() => quote(s, [{ id: "p", qty }], "pickup"));
});
test("slots and postal coverage are enforced", () => {
  const s = fixture();
  s.config.slotCapacity = 1;
  const placed = go(s, customer, "checkout", checkout).state;
  assert.throws(
    () => go(placed, customer, "checkout", checkout, "two"),
    /full/,
  );
  assert.throws(
    () =>
      go(s, customer, "checkout", {
        ...checkout,
        fulfillment: "delivery",
        address: "Road",
        postcode: "WRONG",
      }),
    /area/,
  );
  assert.throws(
    () => go(s, customer, "checkout", { ...checkout, date: "2020-01-01" }),
    /date/,
  );
});
test("delivery minimum, sale savings, and inclusive tax", () => {
  const s = fixture();
  s.products.p.salePrice = 8000;
  s.config.taxBps = 1000;
  const q = quote(s, [{ id: "p", qty: 2 }], "delivery");
  assert.equal(q.savings, 4000);
  assert.equal(q.tax, 1455);
  assert.equal(q.total, 19000);
  s.config.minOrder = 20000;
  assert.throws(
    () =>
      go(s, customer, "checkout", {
        ...checkout,
        fulfillment: "delivery",
        address: "Road",
        postcode: "721507",
      }),
    /minimum/,
  );
});
test("guest cannot use credit", () =>
  assert.throws(
    () => go(fixture(), { ...customer, anonymous: true }, "checkout", checkout),
    /registered/,
  ));
test("currency formatting supports zero and three decimals", () => {
  assert.match(money(123, "JPY"), /123/);
  assert.match(money(1234, "KWD"), /1.234/);
});
test("draft edits do not alter live pages; restore only affects draft", () => {
  let s = fixture();
  s = go(
    s,
    owner,
    "draft",
    {
      pages: [
        {
          id: "home",
          label: "Home",
          sections: [{ id: "b", type: "text", title: "Changed", body: "Body" }],
        },
      ],
    },
    "draft",
  ).state;
  assert.notDeepEqual(s.draft, s.published);
  s = go(s, owner, "publish", {}, "pub").state;
  assert.deepEqual(s.draft, s.published);
  const old = structuredClone(s.published);
  s = go(
    s,
    owner,
    "draft",
    { pages: [{ id: "next", label: "New", sections: [] }] },
    "edit",
  ).state;
  s = go(s, owner, "restore", { id: "pub" }, "restore").state;
  assert.deepEqual(s.published, old);
  assert.deepEqual(s.draft, old);
});
test("unsafe editor image URLs are rejected", () =>
  assert.throws(
    () =>
      go(fixture(), owner, "draft", {
        pages: [
          {
            id: "home",
            label: "Home",
            sections: [
              { id: "b", type: "image", image: "javascript:alert(1)" },
            ],
          },
        ],
      }),
    /HTTPS/,
  ));
test("reminder timing and settled accounts", () => {
  let s = go(
    fixture(),
    owner,
    "charge",
    {
      uid: "customer",
      amount: 1000,
      description: "Due",
      dueDate: "2026-09-12",
    },
    "c",
  ).state;
  assert.equal(reminderDue(s, "customer", now).amount, 1000);
  assert.equal(
    reminderDue(s, "customer", Date.parse("2026-09-12T20:00:00Z")),
    null,
  );
  assert.equal(reminderDue(s, "customer", now + 86400000), null);
  assert.equal(reminderDue(s, "customer", now + 3 * 86400000).amount, 1000);
  s = go(
    s,
    owner,
    "payment",
    { uid: "customer", amount: 1000, method: "Cash" },
    "paid",
  ).state;
  assert.equal(reminderDue(s, "customer", now), null);
});
test("suspension rejects new orders; admin restores", () => {
  let s = fixture();
  s = go(s, { uid: "admin", admin: true }, "suspend", {
    suspended: true,
  }).state;
  assert.throws(() => go(s, customer, "checkout", checkout), /suspended/);
  s = go(
    s,
    { uid: "admin", admin: true },
    "suspend",
    { suspended: false },
    "restore",
  ).state;
  assert.equal(s.config.status, "active");
});
test("payment status is independent of fulfillment", () => {
  let s = go(fixture(), customer, "checkout", {
    ...checkout,
    payment: "cash",
  }).state;
  for (const [i, status] of [
    "Accepted",
    "Preparing",
    "Ready for pickup",
    "Completed",
  ].entries())
    s = go(s, owner, "order", { id: "O-test", status }, "step" + i).state;
  assert.equal(s.orders["O-test"].paymentReceived, false);
  s = go(s, owner, "collected", { id: "O-test" }, "collect").state;
  assert.equal(s.orders["O-test"].paymentReceived, true);
});
