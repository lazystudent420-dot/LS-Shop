import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import {
  emptyStore,
  execute,
  viewStore,
  publicStore,
  reminderDue,
  money,
} from "./engine.mjs";
initializeApp();
const db = getFirestore();
const emailKey = defineSecret("EMAIL_API_KEY");
const groups = [
  "products",
  "orders",
  "customers",
  "charges",
  "payments",
  "audit",
  "revisions",
  "requests",
  "reminderHistory",
];
const actorOf = (r) => ({
  uid: r.auth?.uid || "",
  email: r.auth?.token.email || "",
  emailVerified: !!r.auth?.token.email_verified,
  anonymous: r.auth?.token.firebase?.sign_in_provider === "anonymous",
  admin: r.auth?.token.platformAdmin === true,
});
const validId = (x) => typeof x === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
// Records are separate documents. A store revision serializes conflicting operations.
// This first-release repository reads a complete store in each transaction; see scale limits in README.
async function load(tx, ref) {
  const head = await tx.get(ref);
  if (!head.exists) throw new HttpsError("not-found", "Store not found");
  const s = { ...head.data() };
  for (const g of groups) {
    const docs = await tx.get(ref.collection(g));
    s[g] = Object.fromEntries(docs.docs.map((d) => [d.id, d.data()]));
  }
  return s;
}
function save(tx, ref, before, after) {
  const {
    products,
    orders,
    customers,
    charges,
    payments,
    audit,
    revisions,
    requests,
    reminderHistory,
    ...head
  } = after;
  tx.set(ref, head);
  let writes = 2;
  for (const g of groups)
    for (const [key, value] of Object.entries(after[g] || {})) {
      if (JSON.stringify(before?.[g]?.[key]) !== JSON.stringify(value)) {
        tx.set(ref.collection(g).doc(key), value);
        writes++;
      }
    }
  if (writes > 450)
    throw new HttpsError("resource-exhausted", "Operation is too large");
  const pub = publicStore(after);
  tx.set(db.doc("publicStores/" + ref.id), {
    config: pub.config,
    published: pub.published,
  });
  for (const [key, p] of Object.entries(after.products)) {
    if (JSON.stringify(before?.products?.[key]) !== JSON.stringify(p))
      tx.set(db.doc("publicStores/" + ref.id + "/products/" + key), p);
  }
}
const opts = {
  region: process.env.FUNCTIONS_REGION || "us-central1",
  maxInstances: 10,
  timeoutSeconds: 60,
};
export const storeApi = onCall(opts, async (r) => {
  const actor = actorOf(r),
    { storeId, command, data = {}, requestId } = r.data || {};
  if (!actor.uid) throw new HttpsError("unauthenticated", "Sign in first");
  if (!validId(storeId))
    throw new HttpsError("invalid-argument", "Invalid store address");
  const ref = db.doc("stores/" + storeId);
  try {
    return await db.runTransaction(async (tx) => {
      if (command === "create") {
        if (actor.anonymous) throw Error("Create an account to open a store");
        const existing = await tx.get(ref);
        if (existing.exists) {
          if (existing.data().config.ownerId === actor.uid) return { storeId };
          throw Error("Store address is already taken");
        }
        if (
          typeof data.name !== "string" ||
          !data.name.trim() ||
          data.name.length > 100
        )
          throw Error("Enter a store name");
        const s = emptyStore(actor.uid, data.name.trim(), storeId);
        save(tx, ref, null, s);
        return { storeId };
      }
      const before = await load(tx, ref);
      if (command === "view") {
        if (
          before.config.status !== "active" &&
          !actor.admin &&
          actor.uid !== before.config.ownerId
        )
          throw Error("This store is suspended");
        return viewStore(before, actor);
      }
      const out = execute(before, actor, command, data, requestId);
      save(tx, ref, before, out.state);
      return out.result;
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError(
      "failed-precondition",
      e.message || "Operation failed",
    );
  }
});
export const myStores = onCall(opts, async (r) => {
  const actor = actorOf(r);
  if (!actor.uid) throw new HttpsError("unauthenticated", "Sign in first");
  const q = actor.admin
    ? db.collection("stores").limit(100)
    : db
        .collection("stores")
        .where("config.ownerId", "==", actor.uid)
        .limit(100);
  const snaps = await q.get();
  return snaps.docs.map((d) => ({ id: d.id, ...d.data().config }));
});
// Scheduled mail is disabled by default. An attempted/unknown delivery is never blindly retried.
export const paymentReminders = onSchedule(
  { ...opts, schedule: "every 60 minutes", secrets: [emailKey] },
  async () => {
    if (
      process.env.FUNCTIONS_EMULATOR === "true" ||
      process.env.ENABLE_REMINDER_EMAILS !== "true"
    )
      return;
    const sender = process.env.EMAIL_FROM;
    if (!sender || !emailKey.value()) return;
    const shops = await db
      .collection("stores")
      .where("config.reminders", "==", true)
      .get();
    for (const shop of shops.docs) {
      const customerDocs = await shop.ref.collection("customers").get();
      for (const customer of customerDocs.docs) {
        let auth;
        try {
          auth = await getAuth().getUser(customer.id);
        } catch {
          continue;
        }
        if (!auth.emailVerified || !auth.email) continue;
        const job = await db.runTransaction(async (tx) => {
          const s = await load(tx, shop.ref);
          const c = s.customers[customer.id];
          if (!c) return null;
          c.email = auth.email;
          c.emailVerified = auth.emailVerified;
          const due = reminderDue(s, customer.id);
          if (!due) return null;
          const jobRef = shop.ref
            .collection("reminderHistory")
            .doc(customer.id + "_" + due.date);
          const old = await tx.get(jobRef);
          if (old.exists) return null;
          tx.create(jobRef, {
            uid: customer.id,
            date: due.date,
            status: "attempted",
            amount: due.amount,
          });
          return { due, ref: jobRef, store: s.config };
        });
        if (!job) continue;
        // Recheck immediately before dispatch; a provider send cannot be atomic with a ledger payment.
        const fresh = await db.runTransaction(async (tx) => {
          const s = await load(tx, shop.ref);
          if (s.customers[customer.id]) {
            s.customers[customer.id].email = auth.email;
            s.customers[customer.id].emailVerified = true;
          }
          return reminderDue(s, customer.id);
        });
        if (!fresh) {
          await job.ref.update({ status: "skipped", reason: "No longer due" });
          continue;
        }
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + emailKey.value(),
              "Content-Type": "application/json",
              "Idempotency-Key": shop.id + "-" + customer.id + "-" + fresh.date,
            },
            body: JSON.stringify({
              from: sender,
              to: [auth.email],
              subject: "Payment reminder from " + job.store.name,
              text: `Hello ${fresh.name},\nYour outstanding due amount at ${job.store.name} is ${money(fresh.amount, job.store.currency)}. Please contact your shop to arrange payment. If you have just paid, please disregard this reminder.`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          await job.ref.update({
            status: response.ok ? "sent" : "failed",
            httpStatus: response.status,
          });
        } catch {
          await job.ref.update({
            status: "unknown",
            reason: "Delivery outcome uncertain; manual review required",
          });
        }
      }
    }
  },
);
