// Pure domain layer. The production adapter executes every mutation in a Firestore transaction.
export const fail = (condition, message) => {
  if (!condition) throw new Error(message);
};
const str = (v, max = 200) => {
  fail(
    typeof v === "string" && v.trim().length > 0 && v.length <= max,
    "Invalid text",
  );
  return v.trim();
};
const num = (v, min = 0, max = 100000000) => {
  fail(
    Number.isSafeInteger(v) && v >= min && v <= max,
    "Invalid amount or quantity",
  );
  return v;
};
const id = (v) => {
  fail(
    typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v),
    "Invalid identifier",
  );
  return v;
};
const url = (v) => {
  if (!v) return "";
  fail(/^https:\/\//.test(v) && v.length < 2000, "Use an HTTPS image or link");
  return v;
};
export const digits = (currency) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
export const money = (amount, currency = "INR") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(
    amount / 10 ** digits(currency),
  );
export const localDay = (now, tz) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
export const plusDays = (date, n) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const dueBalance = (s, uid) =>
  Object.values(s.charges)
    .filter((c) => c.uid === uid && !c.reversed)
    .reduce((n, c) => n + c.remaining, 0);
export const reservedCredit = (s, uid) =>
  Object.values(s.orders)
    .filter(
      (o) => o.uid === uid && o.status === "Placed" && o.payment === "credit",
    )
    .reduce((n, o) => n + o.total, 0);
export function emptyStore(
  ownerId,
  name = "My grocery store",
  slug = "my-store",
) {
  return {
    config: {
      ownerId,
      name,
      slug,
      status: "active",
      country: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      deliveryFee: 3000,
      minOrder: 10000,
      postcodes: ["721507"],
      slotCapacity: 10,
      slots: ["10:00–12:00", "14:00–16:00", "17:00–19:00"],
      taxBps: 0,
      taxInclusive: true,
      reminders: true,
      repeatDays: 7,
      phone: "",
      address: "",
      hours: "Daily · 8 am – 9 pm",
      color: "#244e3b",
      logo: "",
      font: "DM Sans",
    },
    products: {},
    orders: {},
    customers: {},
    charges: {},
    payments: {},
    audit: {},
    revisions: {},
    requests: {},
    draft: {
      pages: [
        {
          id: "home",
          label: "Home",
          sections: [
            {
              id: "welcome",
              type: "banner",
              title: "Good food. Close to home.",
              body: "Your everyday essentials, from your neighborhood store.",
              image: "",
              link: "",
            },
          ],
        },
      ],
    },
    published: {
      pages: [
        {
          id: "home",
          label: "Home",
          sections: [
            {
              id: "welcome",
              type: "banner",
              title: "Good food. Close to home.",
              body: "Your everyday essentials, from your neighborhood store.",
              image: "",
              link: "",
            },
          ],
        },
      ],
    },
  };
}
export function publicStore(s) {
  return {
    config: s.config,
    products: Object.fromEntries(
      Object.entries(s.products).filter(([, p]) => p.visible),
    ),
    published: s.published,
  };
}
export function viewStore(s, actor) {
  if (actor.uid === s.config.ownerId || actor.admin) return s;
  return {
    ...publicStore(s),
    orders: Object.fromEntries(
      Object.entries(s.orders).filter(([, o]) => o.uid === actor.uid),
    ),
    customers: Object.fromEntries(
      Object.entries(s.customers).filter(([k]) => k === actor.uid),
    ),
    charges: Object.fromEntries(
      Object.entries(s.charges).filter(([, o]) => o.uid === actor.uid),
    ),
    payments: Object.fromEntries(
      Object.entries(s.payments).filter(([, o]) => o.uid === actor.uid),
    ),
  };
}
export function quote(s, items, fulfillment) {
  fail(
    Array.isArray(items) && items.length > 0 && items.length <= 50,
    "Basket must contain 1–50 products",
  );
  const counts = {};
  for (const i of items) {
    id(i.id);
    counts[i.id] = (counts[i.id] || 0) + num(i.qty, 1, 1000);
  }
  const lines = Object.entries(counts).map(([pid, qty]) => {
    const p = s.products[pid];
    fail(p && p.visible, "Product is unavailable");
    fail(qty <= p.stock, "Insufficient stock: " + p.name);
    return {
      id: pid,
      name: p.name,
      pack: p.pack,
      qty,
      price: p.salePrice ?? p.price,
      original: p.price,
    };
  });
  const subtotal = lines.reduce((n, p) => n + p.qty * p.price, 0),
    savings = lines.reduce((n, p) => n + p.qty * (p.original - p.price), 0);
  const delivery = fulfillment === "delivery" ? s.config.deliveryFee : 0;
  const tax = s.config.taxInclusive
    ? Math.round((subtotal * s.config.taxBps) / (10000 + s.config.taxBps))
    : Math.round((subtotal * s.config.taxBps) / 10000);
  const total = subtotal + delivery + (s.config.taxInclusive ? 0 : tax);
  num(total, 1);
  return { lines, subtotal, savings, delivery, tax, total };
}
function validatePages(data) {
  fail(
    Array.isArray(data.pages) &&
      data.pages.length > 0 &&
      data.pages.length <= 10,
    "Use 1–10 pages",
  );
  return {
    pages: data.pages.map((p) => ({
      id: id(p.id),
      label: str(p.label, 40),
      sections: p.sections
        .slice(0, 20)
        .map((b) => ({
          id: id(b.id),
          type: [
            "banner",
            "text",
            "image",
            "products",
            "categories",
            "button",
            "contact",
          ].includes(b.type)
            ? b.type
            : "text",
          title: String(b.title || "").slice(0, 150),
          body: String(b.body || "").slice(0, 3000),
          image: url(b.image),
          link: b.link?.startsWith("#") ? b.link : url(b.link),
          columns: [1, 2, 3, 4].includes(b.columns) ? b.columns : 1,
        })),
    })),
  };
}
export function execute(
  input,
  actor,
  command,
  data = {},
  requestId,
  now = Date.now(),
) {
  const s = structuredClone(input);
  id(requestId);
  fail(actor.uid, "Sign in first");
  const key = actor.uid + "_" + requestId;
  const fingerprint = JSON.stringify({ command, data });
  if (s.requests[key]) {
    fail(
      s.requests[key].fingerprint === fingerprint,
      "Request identifier already used for another operation",
    );
    return { state: s, result: s.requests[key].result };
  }
  fail(s.config.status === "active" || actor.admin, "This store is suspended");
  const owner = actor.uid === s.config.ownerId;
  const own = () => fail(owner, "Owner access required");
  let result = { ok: true };
  const stamp = new Date(now).toISOString();
  const today = localDay(now, s.config.timezone);
  const audit = (action, details) => {
    s.audit[key] = { id: key, action, details, by: actor.uid, date: stamp };
  };
  const charge = (uid, amount, description, chargeId, dueDate) => {
    num(amount, 1);
    fail(s.customers[uid], "Customer not found");
    s.charges[chargeId] = {
      id: chargeId,
      uid,
      amount,
      remaining: amount,
      description: str(description),
      date: stamp,
      dueDate: dueDate || plusDays(today, 7),
      by: actor.uid,
      reversed: false,
    };
  };
  switch (command) {
    case "join": {
      fail(!actor.anonymous, "Create an account to join the customer ledger");
      const old = s.customers[actor.uid];
      s.customers[actor.uid] = {
        ...(old || { id: actor.uid, creditApproved: false, creditLimit: 0 }),
        name: str(data.name, 100),
        phone: str(data.phone, 30),
        email: actor.email || "",
        emailVerified: !!actor.emailVerified,
      };
      break;
    }
    case "product": {
      own();
      const pid = id(data.id);
      const price = num(data.price, 1);
      const salePrice =
        data.salePrice === null ||
        data.salePrice === undefined ||
        data.salePrice === ""
          ? null
          : num(data.salePrice, 1, price);
      s.products[pid] = {
        id: pid,
        name: str(data.name, 100),
        description: String(data.description || "").slice(0, 1000),
        category: str(data.category, 60),
        pack: str(data.pack, 50),
        price,
        salePrice,
        stock: num(data.stock, 0, 100000),
        image: url(data.image),
        visible: !!data.visible,
      };
      audit("product", pid);
      break;
    }
    case "checkout": {
      fail(
        ["pickup", "delivery"].includes(data.fulfillment),
        "Choose pickup or delivery",
      );
      fail(["cash", "credit"].includes(data.payment), "Invalid payment method");
      const q = quote(s, data.items, data.fulfillment);
      str(data.name, 100);
      str(data.phone, 30);
      fail(
        /^\d{4}-\d{2}-\d{2}$/.test(data.date) &&
          data.date >= today &&
          data.date <= plusDays(today, 30),
        "Choose a date in the next 30 days",
      );
      fail(s.config.slots.includes(data.slot), "Invalid time slot");
      fail(
        new Date(data.date + "T12:00:00Z").toISOString().slice(0, 10) ===
          data.date,
        "Invalid calendar date",
      );
      if (data.date === today) {
        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: s.config.timezone,
            hour: "2-digit",
            hourCycle: "h23",
          }).format(new Date(now)),
        );
        fail(Number(data.slot.slice(0, 2)) > hour, "Choose a future time slot");
      }
      const count = Object.values(s.orders).filter(
        (o) =>
          o.date === data.date &&
          o.slot === data.slot &&
          o.status !== "Cancelled",
      ).length;
      fail(count < s.config.slotCapacity, "This time slot is full");
      if (data.fulfillment === "delivery") {
        str(data.address, 500);
        fail(
          s.config.postcodes
            .map((p) => p.toUpperCase())
            .includes(String(data.postcode).trim().toUpperCase()),
          "Outside delivery area",
        );
        fail(q.subtotal >= s.config.minOrder, "Delivery minimum not met");
      }
      if (data.payment === "credit") {
        fail(!actor.anonymous, "Credit requires a registered account");
        const c = s.customers[actor.uid];
        fail(c?.creditApproved, "Credit is not approved");
        fail(
          c.creditLimit -
            dueBalance(s, actor.uid) -
            reservedCredit(s, actor.uid) >=
            q.total,
          "Credit limit exceeded",
        );
      }
      const oid = "O-" + requestId;
      s.orders[oid] = {
        id: oid,
        uid: actor.uid,
        name: data.name,
        phone: data.phone,
        address: data.fulfillment === "delivery" ? data.address : "",
        postcode: data.fulfillment === "delivery" ? data.postcode : "",
        date: data.date,
        slot: data.slot,
        fulfillment: data.fulfillment,
        payment: data.payment,
        paymentReceived: false,
        status: "Placed",
        createdAt: stamp,
        ...q,
      };
      for (const line of q.lines) s.products[line.id].stock -= line.qty;
      result = { orderId: oid };
      break;
    }
    case "order": {
      const o = s.orders[id(data.id)];
      fail(o, "Order not found");
      fail(
        owner ||
          (o.uid === actor.uid &&
            data.status === "Cancelled" &&
            o.status === "Placed"),
        "Cannot change this order",
      );
      const next = {
        Placed: "Accepted",
        Accepted: "Preparing",
        Preparing:
          o.fulfillment === "delivery" ? "Dispatched" : "Ready for pickup",
        Dispatched: "Completed",
        "Ready for pickup": "Completed",
      };
      fail(
        data.status === next[o.status] ||
          (data.status === "Cancelled" &&
            ["Placed", "Accepted", "Preparing"].includes(o.status)),
        "Invalid order transition",
      );
      if (data.status === "Accepted" && o.payment === "credit")
        charge(o.uid, o.total, "Order " + o.id, o.id);
      if (data.status === "Cancelled") {
        const c = s.charges[o.id];
        if (c && !c.reversed) {
          fail(
            c.remaining === c.amount,
            "Reverse allocated payments before cancelling",
          );
          c.reversed = true;
          c.remaining = 0;
        }
        fail(
          !o.paymentReceived,
          "Record a refund and reversal before cancelling a paid order",
        );
        for (const line of o.lines) s.products[line.id].stock += line.qty;
      }
      o.status = data.status;
      audit("order-status", { id: o.id, status: o.status });
      break;
    }
    case "refund": {
      own();
      const o = s.orders[id(data.id)];
      fail(
        o && o.payment === "cash" && o.paymentReceived,
        "No received cash payment to reverse",
      );
      str(data.reason, 300);
      o.paymentReceived = false;
      audit("cash-refund", { id: o.id, amount: o.total, reason: data.reason });
      break;
    }
    case "collected": {
      own();
      const o = s.orders[id(data.id)];
      fail(
        o && o.payment === "cash" && o.status !== "Cancelled",
        "Use ledger payments for credit orders",
      );
      fail(!o.paymentReceived, "Payment already recorded");
      o.paymentReceived = true;
      audit("cash-collected", { id: o.id, amount: o.total });
      break;
    }
    case "customer": {
      own();
      const uid = id(data.uid);
      const c = s.customers[uid];
      fail(c, "Customer not found");
      c.creditApproved = !!data.creditApproved;
      c.creditLimit = num(data.creditLimit);
      audit("credit-approval", {
        uid,
        limit: c.creditLimit,
        approved: c.creditApproved,
      });
      break;
    }
    case "charge": {
      own();
      fail(/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate), "Choose a due date");
      charge(
        id(data.uid),
        data.amount,
        data.description,
        "C-" + requestId,
        data.dueDate,
      );
      audit("charge", "C-" + requestId);
      break;
    }
    case "payment": {
      own();
      const uid = id(data.uid),
        amount = num(data.amount, 1);
      fail(amount <= dueBalance(s, uid), "Payment exceeds outstanding balance");
      const allocations = [];
      let left = amount;
      for (const c of Object.values(s.charges)
        .filter((c) => c.uid === uid && !c.reversed && c.remaining > 0)
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        )) {
        const n = Math.min(left, c.remaining);
        if (n) {
          c.remaining -= n;
          left -= n;
          allocations.push({ chargeId: c.id, amount: n });
        }
      }
      s.payments["P-" + requestId] = {
        id: "P-" + requestId,
        uid,
        amount,
        date: stamp,
        method: str(data.method, 60),
        reference: String(data.reference || "").slice(0, 150),
        allocations,
        by: actor.uid,
        reversed: false,
      };
      audit("payment", "P-" + requestId);
      break;
    }
    case "reverse": {
      own();
      str(data.reason, 300);
      const record =
        data.kind === "payment"
          ? s.payments[id(data.id)]
          : s.charges[id(data.id)];
      fail(record && !record.reversed, "Record missing or already reversed");
      if (data.kind === "payment") {
        for (const a of record.allocations) {
          const c = s.charges[a.chargeId];
          fail(c && !c.reversed, "Invalid allocation");
          c.remaining += a.amount;
        }
      } else {
        fail(
          record.remaining === record.amount,
          "Reverse allocated payments first",
        );
        record.remaining = 0;
      }
      record.reversed = true;
      record.reversalReason = data.reason;
      record.reversedAt = stamp;
      audit("reversal", { id: record.id, reason: data.reason });
      break;
    }
    case "settings": {
      own();
      const c = s.config;
      const currency = str(data.currency, 3).toUpperCase();
      fail(/^[A-Z]{3}$/.test(currency), "Invalid currency");
      digits(currency);
      new Intl.DateTimeFormat("en", { timeZone: data.timezone });
      fail(
        currency === c.currency ||
          (!Object.keys(s.orders).length &&
            !Object.keys(s.charges).length &&
            !Object.keys(s.products).length),
        "Currency is locked after products or financial activity",
      );
      fail(/^#[0-9a-fA-F]{6}$/.test(data.color), "Invalid brand color");
      fail(
        Array.isArray(data.postcodes) && data.postcodes.length <= 100,
        "Invalid postcodes",
      );
      fail(
        Array.isArray(data.slots) &&
          data.slots.length > 0 &&
          data.slots.length <= 24 &&
          data.slots.every(
            (x) =>
              /^(?:[01]\d|2[0-3]):[0-5]\d[–-](?:[01]\d|2[0-3]):[0-5]\d$/.test(
                x,
              ) && x.slice(0, 5) < x.slice(6),
          ) &&
          new Set(data.slots).size === data.slots.length,
        "Invalid slots",
      );
      fail(
        ["DM Sans", "Manrope", "Georgia", "Arial"].includes(
          data.font || "DM Sans",
        ),
        "Invalid font",
      );
      Object.assign(c, {
        logo: url(data.logo),
        font: data.font || "DM Sans",
        name: str(data.name, 100),
        country: str(data.country, 2),
        currency,
        timezone: data.timezone,
        color: data.color,
        phone: String(data.phone || "").slice(0, 30),
        address: String(data.address || "").slice(0, 500),
        hours: String(data.hours || "").slice(0, 200),
        deliveryFee: num(data.deliveryFee),
        minOrder: num(data.minOrder),
        postcodes: data.postcodes.map((x) => str(x, 20)),
        slots: data.slots,
        slotCapacity: num(data.slotCapacity, 1, 1000),
        taxBps: num(data.taxBps, 0, 10000),
        taxInclusive: !!data.taxInclusive,
        reminders: !!data.reminders,
        repeatDays: num(data.repeatDays, 1, 90),
      });
      audit("settings", c.name);
      break;
    }
    case "draft":
      own();
      s.draft = validatePages(data);
      break;
    case "publish":
      own();
      s.published = validatePages(s.draft);
      s.revisions[requestId] = {
        id: requestId,
        date: stamp,
        by: actor.uid,
        content: structuredClone(s.published),
      };
      audit("publish", requestId);
      break;
    case "restore":
      own();
      fail(s.revisions[id(data.id)], "Version not found");
      s.draft = structuredClone(s.revisions[data.id].content);
      break;
    case "suspend":
      fail(actor.admin, "Platform administrator required");
      s.config.status = data.suspended ? "suspended" : "active";
      audit("store-status", s.config.status);
      break;
    default:
      throw new Error("Unknown operation");
  }
  s.requests[key] = { id: key, result, date: stamp, fingerprint };
  return { state: s, result };
}
export function reminderDue(s, uid, now = Date.now()) {
  const c = s.customers[uid];
  if (
    !s.config.reminders ||
    !c?.emailVerified ||
    !c.email ||
    s.config.status !== "active"
  )
    return null;
  const today = localDay(now, s.config.timezone);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: s.config.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  if (hour < 9 || hour >= 18) return null;
  const due = Object.values(s.charges).filter(
    (x) =>
      x.uid === uid && !x.reversed && x.remaining > 0 && x.dueDate <= today,
  );
  const scheduled = due.some((c) => {
    const days = Math.round(
      (Date.parse(today) - Date.parse(c.dueDate)) / 86400000,
    );
    return (
      days === 0 ||
      days === 3 ||
      (days > 3 && (days - 3) % s.config.repeatDays === 0)
    );
  });
  return scheduled
    ? {
        date: today,
        amount: due.reduce((n, c) => n + c.remaining, 0),
        email: c.email,
        name: c.name,
      }
    : null;
}
