import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ShoppingBasket,
  Search,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  X,
  MapPin,
  Leaf,
  Truck,
  ShieldCheck,
  Clock,
  LayoutDashboard,
  Package,
  Users,
  Palette,
  Settings,
  LogOut,
  ShoppingBag,
  Menu,
  ChevronRight,
  Store,
  Check,
  Undo2,
  Redo2,
  GripVertical,
  ExternalLink,
  Download,
} from "lucide-react";
import {
  api,
  demo,
  start,
  demoRole,
  login,
  logout,
  resetPassword,
  verifyEmail,
  myStores,
  upload,
  type Actor,
} from "./api";
import {
  quote,
  money,
  digits,
  dueBalance,
  reservedCredit,
  localDay,
  plusDays,
} from "../functions/src/engine.mjs";
import "./style.css";
type Any = any;
const vals = (o: Any): Any[] => Object.values(o || {});
const uid = () => crypto.randomUUID();
function Field({ label, children, ...props }: Any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function Modal({ title, children, close }: Any) {
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row spread">
          <h2>{title}</h2>
          <button className="icon" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Empty({ title, body }: Any) {
  return (
    <div className="empty">
      <ShoppingBasket size={36} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
function App() {
  const [actor, setActor] = useState<Actor | null>(null),
    [storeId, setStoreId] = useState(
      new URLSearchParams(location.search).get("store") ||
        (demo ? "green-basket" : ""),
    ),
    [s, setS] = useState<Any>(null),
    [view, setView] = useState("shop"),
    [page, setPage] = useState("home"),
    [search, setSearch] = useState(""),
    [cat, setCat] = useState("All essentials"),
    [cart, setCart] = useState<Record<string, number>>({}),
    [drawer, setDrawer] = useState(false),
    [modal, setModal] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Any>(null),
    [stores, setStores] = useState<Any[]>([]);
  useEffect(() => {
    if (!modal && !drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []);
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(''); setDrawer(false); }
      if (event.key !== 'Tab') return;
      const controls = focusable(), first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [modal, drawer]);
  const owner = !!actor && s?.config.ownerId === actor.uid,
    admin = !!actor?.admin;
  const refresh = async () => {
    if (storeId) {
      try {
        setS(await api(storeId, "view"));
        setError("");
      } catch (e: Any) {
        setError(e.message);
        setS(null);
      }
    }
  };
  useEffect(() => {
    let unsub: Any;
    start(setActor).then((x) => (unsub = x));
    const handler = (e: Any) => setError(e.detail);
    window.addEventListener("app-error", handler);
    return () => {
      unsub?.();
      window.removeEventListener("app-error", handler);
    };
  }, []);
  useEffect(() => {
    if (actor) {
      refresh();
      myStores()
        .then(setStores)
        .catch((e) => setError(e.message));
    }
  }, [actor, storeId]);
  useEffect(() => {
    if (!actor || !storeId) return;
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [actor, storeId]);
  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem("grove-cart-" + storeId) || "{}"));
  }, [storeId]);
  const updateCart = (id: string, n: number) => {
    const next = { ...cart };
    if (n <= 0) delete next[id];
    else next[id] = n;
    setCart(next);
    localStorage.setItem("grove-cart-" + storeId, JSON.stringify(next));
  };
  const act = async (command: string, data: Any = {}, requestId?: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await api(storeId, command, data, requestId);
      await refresh();
      setNotice("Saved successfully");
      return r;
    } catch (e: Any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const safe = (p: Promise<Any>) => p.catch(() => {});
  const moveStore = (id: string) => {
    setS(null);
    setStoreId(id);
    history.replaceState(null, "", "?store=" + encodeURIComponent(id));
    setView("shop");
    setPage("home");
  };
  const fmt = (n: number) => money(n, s?.config.currency || "INR");
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
  const [fulfill, setFulfill] = useState("pickup");
  let total: Any = null,
    cartError = "";
  if (s && items.length) {
    try {
      total = quote(s, items, fulfill);
    } catch (e: Any) {
      cartError = e.message;
    }
  }
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const open = (name: string, item: Any = null) => {
    setSelected(item);
    setModal(name);
  };
  const nav = [
    ["overview", "Overview", LayoutDashboard],
    ["products", "Products", Package],
    ["orders", "Orders", ShoppingBag],
    ["customers", "Customers & dues", Users],
    ["editor", "Website editor", Palette],
    ["settings", "Store settings", Settings],
  ] as const;
  return (
    <div
      style={
        {
          "--green": s?.config.color || "#244e3b",
          fontFamily: s?.config.font || "DM Sans",
        } as React.CSSProperties
      }
    >
      {demo && (
        <div className="demo-bar">
          <span>
            <b>Interactive demo</b> · Changes stay on this device. No real
            orders or emails.
          </span>
          <button
            onClick={() => {
              const a = demoRole(
                actor?.uid === "demo-owner" ? "customer" : "owner",
              );
              setActor(a);
              setView(a.uid === "demo-owner" ? "overview" : "shop");
            }}
          >
            Try {actor?.uid === "demo-owner" ? "customer" : "shop owner"} view{" "}
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("shop");
          }}
        >
          <span className="brand-icon">
            <ShoppingBasket size={24} />
          </span>
          <span>
            grove<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-store">
          {s?.config.logo ? (
            <img
              src={s.config.logo}
              alt="Store logo"
              style={{ width: 24, height: 24, objectFit: "contain" }}
            />
          ) : (
            <Store size={16} />
          )}
          <span>{s?.config.name || "Your neighborhood, online"}</span>
        </div>
        <nav>
          <button
            className={view === "shop" ? "active" : ""}
            onClick={() => setView("shop")}
          >
            Shop
          </button>
          <button onClick={() => setView("myorders")}>My orders</button>
          <button onClick={() => setView("account")}>My account</button>
          {owner && (
            <button className="owner-link" onClick={() => setView("overview")}>
              Manage store <ArrowUpRight size={14} />
            </button>
          )}
          {admin && (
            <button onClick={() => setView("platform")}>Platform</button>
          )}
        </nav>
        <button className="basket-btn" onClick={() => setDrawer(true)}>
          <ShoppingBasket size={18} />
          <span>Basket</span>
          <b>{count}</b>
        </button>
      </header>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button
            className="icon"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {!storeId ? (
        <main className="onboard">
          <span className="eyebrow">YOUR STORE. YOUR COMMUNITY.</span>
          <h1>
            A little shop.
            <br />A world of possibility.
          </h1>
          <p>
            Bring your grocery store online, with one simple workspace for
            products, orders, and customer accounts.
          </p>
          <div className="row">
            <button className="primary" onClick={() => open("create")}>
              Open your store <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => open("visit")}>
              Visit a store
            </button>
          </div>
          <div className="store-list">
            {stores.map((t) => (
              <button
                key={t.id}
                className="card"
                onClick={() => moveStore(t.id)}
              >
                <Store />
                {t.name}
                <ArrowRight />
              </button>
            ))}
          </div>
        </main>
      ) : !s ? (
        <main className="loading">
          <ShoppingBasket size={40} />
          <h2>
            {error
              ? "Unable to open this store"
              : "Opening your neighborhood store…"}
          </h2>
          <button className="secondary" onClick={() => open("visit")}>
            Choose store
          </button>
        </main>
      ) : (
        <>
          {view === "shop" && (
            <>
              <div className="store-strip">
                <span>
                  <MapPin size={14} />
                  {s.config.address || s.config.name}
                </span>
                <span>
                  <Clock size={14} />
                  {s.config.hours}
                </span>
                <span>
                  Pickup & local delivery <Truck size={14} />
                </span>
              </div>
              <div className="page-tabs">
                {s.published.pages.map((p: Any) => (
                  <button
                    className={page === p.id ? "chosen" : ""}
                    key={p.id}
                    onClick={() => setPage(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <main className="storefront">
                {(
                  s.published.pages.find((p: Any) => p.id === page) ||
                  s.published.pages[0]
                ).sections.map((b: Any, i: number) => (
                  <React.Fragment key={b.id}>
                    {b.type === "banner" ? (
                      <section className="hero">
                        <div className="hero-copy">
                          <div className="eyebrow">
                            <span /> YOUR NEIGHBORHOOD STORE, ONLINE
                          </div>
                          <h1>{b.title}</h1>
                          <p>{b.body}</p>
                          <button
                            className="primary"
                            onClick={() =>
                              document
                                .getElementById("catalog")
                                ?.scrollIntoView({ behavior: "smooth" })
                            }
                          >
                            Shop the essentials <ArrowRight size={18} />
                          </button>
                          <div className="hero-note">
                            <Leaf size={15} /> Freshly picked. Thoughtfully
                            priced.
                          </div>
                        </div>
                        <div className="hero-art">
                          {b.image ? (
                            <img src={b.image} alt={b.title} />
                          ) : (
                            <>
                              <div className="art-circle" />
                              <div className="produce p1">🥬</div>
                              <div className="produce p2">🍅</div>
                              <div className="produce p3">🥕</div>
                              <div className="produce p4">🥑</div>
                              <div className="produce p5">🍋</div>
                              <div className="fresh-stamp">
                                GOOD FOOD
                                <br />
                                <Leaf size={24} />
                                <br />
                                CLOSE TO HOME
                              </div>
                              <div className="art-label">
                                <span className="dot" /> Handpicked for your
                                everyday
                              </div>
                            </>
                          )}
                        </div>
                      </section>
                    ) : b.type === "image" ? (
                      <figure className="section-image">
                        <img src={b.image} alt={b.title} />
                        <figcaption>{b.body}</figcaption>
                      </figure>
                    ) : b.type === "button" ? (
                      <a className="primary custom-link" href={b.link}>
                        {b.title}
                        <ArrowUpRight size={16} />
                      </a>
                    ) : b.type === "contact" ? (
                      <section className="content-block">
                        <h2>{b.title || "Find us nearby"}</h2>
                        <p>{b.body}</p>
                        <p>
                          {s.config.address} · {s.config.phone}
                        </p>
                      </section>
                    ) : b.type === "categories" ? (
                      <div className="categories">
                        {[
                          ...new Set(vals(s.products).map((p) => p.category)),
                        ].map((c) => (
                          <button
                            onClick={() => {
                              setCat(c);
                              document
                                .getElementById("catalog")
                                ?.scrollIntoView();
                            }}
                            key={c}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ) : b.type === "products" ? (
                      <section className="content-block">
                        <h2>{b.title || "From our shelves"}</h2>
                        <p>{b.body}</p>
                        <div className="mini-products">
                          {vals(s.products)
                            .filter((p) => p.visible)
                            .slice(0, 4)
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() => open("detail", p)}
                              >
                                {p.emoji || "🛒"} {p.name} ·{" "}
                                {fmt(p.salePrice ?? p.price)}
                              </button>
                            ))}
                        </div>
                      </section>
                    ) : (
                      <section className="content-block">
                        <h2>{b.title}</h2>
                        <p style={{ columnCount: b.columns || 1 }}>{b.body}</p>
                      </section>
                    )}
                  </React.Fragment>
                ))}
                <div className="trust-row">
                  <span>
                    <Leaf />
                    Freshness comes first
                  </span>
                  <span>
                    <Truck />
                    Local delivery, made easy
                  </span>
                  <span>
                    <ShieldCheck />
                    Pay when you receive
                  </span>
                </div>
                <section id="catalog" className="catalog">
                  <div className="row spread catalog-heading">
                    <div>
                      <span className="eyebrow">THE EVERYDAY GOOD STUFF</span>
                      <h2>What’s on your list?</h2>
                    </div>
                    <label className="search">
                      <Search size={18} />
                      <input
                        placeholder="Search your essentials…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search products"
                      />
                    </label>
                  </div>
                  <div className="categories">
                    {[
                      "All essentials",
                      ...new Set(
                        vals(s.products)
                          .filter((p) => p.visible)
                          .map((p) => p.category),
                      ),
                    ].map((c) => (
                      <button
                        className={cat === c ? "chosen" : ""}
                        key={c}
                        onClick={() => setCat(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="product-grid">
                    {vals(s.products)
                      .filter(
                        (p) =>
                          p.visible &&
                          (cat === "All essentials" || p.category === cat) &&
                          p.name.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((p, i) => (
                        <article className="product-card" key={p.id}>
                          <button
                            className={"product-image tone-" + (i % 4)}
                            onClick={() => open("detail", p)}
                            aria-label={"View " + p.name}
                          >
                            {p.salePrice && (
                              <span className="sale">
                                SAVE{" "}
                                {Math.round((1 - p.salePrice / p.price) * 100)}%
                              </span>
                            )}
                            {p.image ? (
                              <img src={p.image} alt={p.name} />
                            ) : (
                              <span>
                                {p.emoji ||
                                  (
                                    {
                                      Vegetables: "🥦",
                                      Fruits: "🍎",
                                      Bakery: "🥖",
                                      "Dairy & eggs": "🥛",
                                      Pantry: "🌾",
                                    } as Any
                                  )[p.category] ||
                                  "🛒"}
                              </span>
                            )}
                          </button>
                          <div className="product-info">
                            <span className="product-category">
                              {p.category}
                            </span>
                            <h3>
                              <button onClick={() => open("detail", p)}>
                                {p.name}
                              </button>
                            </h3>
                            <p>{p.pack}</p>
                            <div className="row spread">
                              <div className="price">
                                {fmt(p.salePrice ?? p.price)}{" "}
                                {p.salePrice && <del>{fmt(p.price)}</del>}
                              </div>
                              {cart[p.id] ? (
                                <div className="quantity">
                                  <button
                                    aria-label={"Remove one " + p.name}
                                    onClick={() =>
                                      updateCart(p.id, cart[p.id] - 1)
                                    }
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span>{cart[p.id]}</span>
                                  <button
                                    disabled={cart[p.id] >= p.stock}
                                    aria-label={"Add one " + p.name}
                                    onClick={() =>
                                      updateCart(p.id, cart[p.id] + 1)
                                    }
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="add-btn"
                                  disabled={!p.stock}
                                  onClick={() => updateCart(p.id, 1)}
                                  aria-label={"Add " + p.name}
                                >
                                  {p.stock ? (
                                    <Plus size={19} />
                                  ) : (
                                    <small>Sold out</small>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!vals(s.products).some(
                    (p) =>
                      p.visible &&
                      (cat === "All essentials" || p.category === cat) &&
                      p.name.toLowerCase().includes(search.toLowerCase()),
                  ) && (
                    <Empty
                      title="Nothing on this shelf yet"
                      body="Try another category or search term."
                    />
                  )}
                </section>
                <section className="neighbor">
                  <div>
                    <span className="eyebrow">SMALL STORE. BIG HEART.</span>
                    <h2>
                      Your everyday shop,
                      <br />
                      just a little closer.
                    </h2>
                    <p>
                      Every basket supports a local business. Thank you for
                      shopping with your neighborhood.
                    </p>
                  </div>
                  <ShoppingBasket size={105} strokeWidth={1} />
                </section>
              </main>
              <footer>
                <a className="brand" href="#">
                  grove.
                </a>
                <span>Good food. Good neighbors.</span>
                <button onClick={() => open("visit")}>Switch store</button>
                <button onClick={() => open("create")}>
                  Open a store <ArrowUpRight size={14} />
                </button>
              </footer>
            </>
          )}
          {owner && nav.some((n) => n[0] === view) && (
            <div className="workspace">
              <aside>
                <div className="workspace-label">STORE WORKSPACE</div>
                {nav.map(([v, label, Icon]) => (
                  <button
                    key={v}
                    className={view === v ? "selected" : ""}
                    onClick={() => setView(v)}
                  >
                    <Icon size={18} />
                    {label}
                    {v === "orders" && (
                      <small>
                        {
                          vals(s.orders).filter(
                            (o) =>
                              !["Completed", "Cancelled"].includes(o.status),
                          ).length
                        }
                      </small>
                    )}
                  </button>
                ))}
                <div className="sidebar-bottom">
                  <div className="store-avatar">{s.config.name[0]}</div>
                  <b>{s.config.name}</b>
                  <small>
                    {s.config.currency} · {s.config.country}
                  </small>
                  <button onClick={() => setView("shop")}>
                    View storefront <ExternalLink size={14} />
                  </button>
                </div>
              </aside>
              <main className="workspace-main">
                <div className="row spread">
                  <div>
                    <span className="eyebrow">{s.config.name}</span>
                    <h1>{nav.find((n) => n[0] === view)?.[1]}</h1>
                  </div>
                  {view === "products" && (
                    <button className="primary" onClick={() => open("product")}>
                      Add product <Plus size={16} />
                    </button>
                  )}
                </div>
                {view === "overview" && (
                  <>
                    <p className="muted">
                      A clear picture of your store, at a glance.
                    </p>
                    <div className="stats">
                      {[
                        [
                          "Completed sales",
                          fmt(
                            vals(s.orders)
                              .filter((o) => o.status === "Completed")
                              .reduce((n, o) => n + o.total, 0),
                          ),
                        ],
                        [
                          "Active orders",
                          vals(s.orders).filter(
                            (o) =>
                              !["Completed", "Cancelled"].includes(o.status),
                          ).length,
                        ],
                        [
                          "Customer dues",
                          fmt(
                            vals(s.charges)
                              .filter((c) => !c.reversed)
                              .reduce((n, c) => n + c.remaining, 0),
                          ),
                        ],
                        [
                          "Low-stock products",
                          vals(s.products).filter((p) => p.stock < 10).length,
                        ],
                      ].map(([label, value]) => (
                        <div className="stat" key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <section className="panel">
                      <div className="row spread">
                        <h2>Recent orders</h2>
                        <button
                          className="text-btn"
                          onClick={() => setView("orders")}
                        >
                          View all <ArrowRight size={15} />
                        </button>
                      </div>
                      <Orders
                        s={s}
                        owner={owner}
                        fmt={fmt}
                        act={act}
                        busy={busy}
                      />
                    </section>
                    <section className="panel">
                      <h2>Stock to keep an eye on</h2>
                      {vals(s.products)
                        .filter((p) => p.stock < 10)
                        .map((p) => (
                          <div className="list-row" key={p.id}>
                            <b>{p.name}</b>
                            <span>{p.stock} left</span>
                            <button
                              className="secondary"
                              onClick={() => open("product", p)}
                            >
                              Update stock
                            </button>
                          </div>
                        ))}
                    </section>
                  </>
                )}
                {view === "products" && (
                  <section className="panel">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Available</th>
                            <th>Visibility</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {vals(s.products).map((p) => (
                            <tr key={p.id}>
                              <td>
                                <b>{p.name}</b>
                                <small>{p.pack}</small>
                              </td>
                              <td>{p.category}</td>
                              <td>{fmt(p.salePrice ?? p.price)}</td>
                              <td>{p.stock}</td>
                              <td>
                                <span className="badge">
                                  {p.visible ? "Published" : "Hidden"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="text-btn"
                                  onClick={() => open("product", p)}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!vals(s.products).length && (
                      <Empty
                        title="Your shelves are ready"
                        body="Add your first product to start selling."
                      />
                    )}
                  </section>
                )}
                {view === "orders" && (
                  <section className="panel">
                    <Orders
                      s={s}
                      owner={owner}
                      fmt={fmt}
                      act={act}
                      busy={busy}
                    />
                  </section>
                )}
                {view === "customers" && (
                  <section className="panel">
                    <h2>Customer accounts</h2>
                    <p className="muted">
                      Approve credit, record previous dues, and log payments
                      already collected.
                    </p>
                    {vals(s.customers).map((c) => (
                      <div className="customer-row" key={c.id}>
                        <div className="avatar">{c.name[0]}</div>
                        <div>
                          <b>{c.name}</b>
                          <small>{c.phone}</small>
                        </div>
                        <div>
                          <small>Outstanding</small>
                          <strong>{fmt(dueBalance(s, c.id))}</strong>
                        </div>
                        <span className="badge">
                          {c.creditApproved ? "Credit approved" : "Cash only"}
                        </span>
                        <button
                          className="secondary"
                          onClick={() => open("ledger", c)}
                        >
                          Open account <ArrowRight size={15} />
                        </button>
                      </div>
                    ))}
                    {!vals(s.customers).length && (
                      <Empty
                        title="Your customers will appear here"
                        body="Customers join through My account on your storefront."
                      />
                    )}
                  </section>
                )}
                {view === "editor" && <Editor s={s} act={act} busy={busy} />}
                {view === "settings" && (
                  <>
                    <SettingsForm s={s} act={act} busy={busy} />
                    <section className="panel">
                      <h2>Reminder history</h2>
                      {vals(s.reminderHistory).map((r) => (
                        <div className="list-row" key={r.uid + r.date}>
                          <span>{s.customers[r.uid]?.name || r.uid}</span>
                          <span>{r.date}</span>
                          <span className="badge">{r.status}</span>
                        </div>
                      ))}
                      {!vals(s.reminderHistory).length && (
                        <p className="muted">No reminder attempts yet.</p>
                      )}
                    </section>
                  </>
                )}
              </main>
            </div>
          )}
          {view === "myorders" && (
            <main className="account-main">
              <span className="eyebrow">YOUR SHOPPING</span>
              <h1>My orders</h1>
              <p className="muted">
                {actor?.anonymous
                  ? "Guest orders are private to this browser session. Create an account to keep access across devices."
                  : "Track your latest baskets, from the shop to your door."}
              </p>
              <Orders
                s={{
                  ...s,
                  orders: Object.fromEntries(
                    Object.entries(s.orders || {}).filter(
                      ([, o]: Any) => o.uid === actor?.uid,
                    ),
                  ),
                }}
                owner={false}
                fmt={fmt}
                act={act}
                busy={busy}
              />
            </main>
          )}
          {view === "account" && (
            <main className="account-main">
              <span className="eyebrow">WELCOME TO YOUR NEIGHBORHOOD</span>
              <h1>My account</h1>
              {actor?.anonymous ? (
                <div className="panel">
                  <p>
                    Create an account to keep your order history and request
                    store credit.
                  </p>
                  <button className="primary" onClick={() => open("auth")}>
                    Sign in or register
                  </button>
                </div>
              ) : (
                <>
                  <div className="row spread">
                    <p>{actor?.email}</p>
                    {!demo && (
                      <div className="row">
                        <button
                          className="secondary"
                          onClick={() =>
                            verifyEmail()
                              .then(() => setNotice("Verification email sent"))
                              .catch((e) => setError(e.message))
                          }
                        >
                          Verify email
                        </button>
                        <button className="secondary" onClick={() => logout()}>
                          Sign out <LogOut size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  {s.customers?.[actor!.uid] ? (
                    <Ledger
                      s={s}
                      customer={s.customers[actor!.uid]}
                      owner={false}
                      act={act}
                      busy={busy}
                    />
                  ) : (
                    <form
                      className="panel form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        safe(
                          act("join", {
                            name: f.get("name"),
                            phone: f.get("phone"),
                          }),
                        );
                      }}
                    >
                      <h2>Join this store</h2>
                      <p className="muted">
                        Your shop owner can approve a credit limit after you
                        join.
                      </p>
                      <Field label="Full name" name="name" required />
                      <Field label="Phone number" name="phone" required />
                      <button className="primary" disabled={busy}>
                        Save profile
                      </button>
                    </form>
                  )}
                </>
              )}
              <section className="panel">
                <h2>Your stores</h2>
                {stores.map((t) => (
                  <button
                    className="secondary"
                    onClick={() => moveStore(t.id)}
                    key={t.id}
                  >
                    {t.name}
                  </button>
                ))}
                <button className="text-btn" onClick={() => open("create")}>
                  Open a new store <Plus size={15} />
                </button>
              </section>
            </main>
          )}
          {view === "platform" && admin && (
            <main className="account-main">
              <h1>Platform administration</h1>
              {stores.map((t) => (
                <div className="panel row spread" key={t.id}>
                  <b>{t.name}</b>
                  <span>{t.status}</span>
                  <button
                    className="secondary"
                    onClick={() =>
                      api(t.id, "suspend", { suspended: t.status === "active" })
                        .then(() => myStores())
                        .then(setStores)
                        .catch((e) => setError(e.message))
                    }
                  >
                    {t.status === "active" ? "Suspend" : "Restore"}
                  </button>
                  <button onClick={() => moveStore(t.id)}>Open</button>
                </div>
              ))}
            </main>
          )}
        </>
      )}
      {drawer && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawer(false);
          }}
        >
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your basket"
          >
            <div className="row spread">
              <h2>
                Your basket <small>({count})</small>
              </h2>
              <button
                className="icon"
                onClick={() => setDrawer(false)}
                aria-label="Close basket"
              >
                <X />
              </button>
            </div>
            <p className="muted">{s?.config.name}</p>
            {items.length ? (
              items.map((i) => (
                <div className="basket-item" key={i.id}>
                  <span className="basket-emoji">
                    {s?.products[i.id]?.emoji || "🛒"}
                  </span>
                  <div>
                    <b>{s?.products[i.id]?.name || "Unavailable product"}</b>
                    <small>{s?.products[i.id]?.pack}</small>
                    <button
                      className="text-btn"
                      onClick={() => updateCart(i.id, 0)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="quantity">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => updateCart(i.id, i.qty - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    {i.qty}
                    <button
                      aria-label="Increase quantity"
                      onClick={() => updateCart(i.id, i.qty + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="Good things start with a basket"
                body="Add a few essentials to get started."
              />
            )}
            {cartError && <p className="error-text">{cartError}</p>}
            {total && (
              <>
                <div className="totals">
                  <span>
                    Subtotal <b>{fmt(total.subtotal)}</b>
                  </span>
                  {total.savings > 0 && (
                    <span className="green">
                      You save <b>{fmt(total.savings)}</b>
                    </span>
                  )}
                </div>
                <button
                  className="primary full"
                  onClick={() => {
                    setDrawer(false);
                    open("checkout");
                  }}
                >
                  Continue to checkout <ArrowRight size={18} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {modal && (
        <Modal
          title={
            (
              {
                auth: "Welcome to Grove",
                create: "Open your store",
                visit: "Visit a store",
                product: selected ? "Edit product" : "Add a product",
                checkout: "Checkout",
                detail: selected?.name,
                ledger: selected?.name,
              } as Any
            )[modal] || modal
          }
          close={() => setModal("")}
        >
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {modal === "auth" && (
            <AuthForm done={() => setModal("")} report={setError} />
          )}
          {modal === "visit" && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                moveStore(String(new FormData(e.currentTarget).get("slug")));
                setModal("");
              }}
            >
              <Field
                label="Store address"
                name="slug"
                placeholder="green-basket"
                pattern="[a-z0-9-]+"
                required
              />
              <button className="primary">Open store</button>
            </form>
          )}
          {modal === "create" && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (actor?.anonymous) {
                  setModal("auth");
                  return;
                }
                const f = new FormData(e.currentTarget),
                  slug = String(f.get("slug"));
                setBusy(true);
                try {
                  await api(slug, "create", { name: f.get("name") });
                  setStores(await myStores());
                  moveStore(slug);
                  setModal("");
                } catch (e: Any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                One workspace for your catalog, orders, customer dues, and
                storefront.
              </p>
              <Field label="Store name" name="name" required maxLength={100} />
              <Field
                label="Unique store address"
                name="slug"
                pattern="[a-z0-9-]{3,50}"
                placeholder="your-shop-name"
                required
              />
              <small>Your website uses ?store=your-shop-name.</small>
              <button className="primary" disabled={busy}>
                {actor?.anonymous
                  ? "Create an account to continue"
                  : "Create store"}
              </button>
            </form>
          )}
          {modal === "product" && (
            <ProductForm
              product={selected}
              currency={s.config.currency}
              busy={busy}
              save={(d: Any) => act("product", d).then(() => setModal(""))}
              uploadFile={(f: File) => upload(storeId, f)}
              report={setError}
            />
          )}
          {modal === "detail" && (
            <div className="detail">
              <div className="detail-image">
                {selected.image ? (
                  <img src={selected.image} alt={selected.name} />
                ) : (
                  selected.emoji || "🛒"
                )}
              </div>
              <span className="eyebrow">
                {selected.category} · {selected.pack}
              </span>
              <p>{selected.description}</p>
              <h2>{fmt(selected.salePrice ?? selected.price)}</h2>
              <p>{selected.stock} packs available</p>
              <button
                className="primary full"
                disabled={
                  !selected.stock || cart[selected.id] >= selected.stock
                }
                onClick={() => {
                  updateCart(selected.id, (cart[selected.id] || 0) + 1);
                  setModal("");
                  setNotice("Added to your basket");
                }}
              >
                Add to basket <Plus size={17} />
              </button>
            </div>
          )}
          {modal === "checkout" && (
            <Checkout
              s={s}
              items={items}
              actor={actor}
              fulfill={fulfill}
              setFulfill={setFulfill}
              busy={busy}
              submit={(d: Any, key: string) =>
                act("checkout", d, key).then((r) => {
                  setCart({});
                  localStorage.removeItem("grove-cart-" + storeId);
                  setModal("");
                  setView("myorders");
                  setNotice("Order " + r.orderId + " placed");
                })
              }
            />
          )}
          {modal === "ledger" && (
            <Ledger
              s={s}
              customer={selected}
              owner={owner}
              act={act}
              busy={busy}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
function AuthForm({ done, report }: Any) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState("");
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await login(
            email,
            String(new FormData(e.currentTarget).get("password")),
            register,
          );
          done();
        } catch (e: Any) {
          report(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e: Any) => setEmail(e.target.value)}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        minLength={8}
        required
        autoComplete={register ? "new-password" : "current-password"}
      />
      <button className="primary" disabled={busy}>
        {register ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        className="text-btn"
        onClick={() => setRegister(!register)}
      >
        {register
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
      <button
        type="button"
        className="text-btn"
        onClick={() =>
          resetPassword(email)
            .then(() => report("Password reset email sent"))
            .catch((e: Any) => report(e.message))
        }
      >
        Reset password
      </button>
    </form>
  );
}
function ProductForm({
  product,
  currency,
  busy,
  save,
  uploadFile,
  report,
}: Any) {
  const [image, setImage] = useState(product?.image || ""),
    [uploading, setUploading] = useState(false);
  const factor = 10 ** digits(currency);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          id: product?.id || uid(),
          name: f.get("name"),
          category: f.get("category"),
          pack: f.get("pack"),
          description: f.get("description"),
          price: Math.round(Number(f.get("price")) * factor),
          salePrice: f.get("sale")
            ? Math.round(Number(f.get("sale")) * factor)
            : null,
          stock: Number(f.get("stock")),
          visible: f.get("visible") === "on",
          image,
        }).catch(() => {});
      }}
    >
      <Field
        label="Product name"
        name="name"
        defaultValue={product?.name}
        required
      />
      <div className="form-grid">
        <Field
          label="Category"
          name="category"
          defaultValue={product?.category || "Vegetables"}
          required
        />
        <Field
          label="Pack / weight"
          name="pack"
          defaultValue={product?.pack || "500 g"}
          required
        />
        <Field
          label={"Price (" + currency + ")"}
          name="price"
          type="number"
          min={1 / factor}
          step={1 / factor}
          defaultValue={product ? product.price / factor : ""}
          required
        />
        <Field
          label="Sale price (optional)"
          name="sale"
          type="number"
          min={1 / factor}
          step={1 / factor}
          defaultValue={product?.salePrice ? product.salePrice / factor : ""}
        />
        <Field
          label="Available packs"
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={product?.stock || 0}
          required
        />
      </div>
      <Field label="Description">
        <textarea name="description" defaultValue={product?.description} />
      </Field>
      <Field
        label="Image URL"
        type="url"
        value={image}
        onChange={(e: Any) => setImage(e.target.value)}
      />
      <Field
        label="Or upload a photo (up to 5 MB)"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e: Any) => {
          if (!e.target.files[0]) return;
          setUploading(true);
          try {
            setImage(await uploadFile(e.target.files[0]));
          } catch (e: Any) {
            report(e.message);
          } finally {
            setUploading(false);
          }
        }}
      />
      <label className="check">
        <input
          type="checkbox"
          name="visible"
          defaultChecked={product?.visible ?? true}
        />
        Show in storefront
      </label>
      <button className="primary" disabled={busy || uploading}>
        {uploading ? "Uploading…" : "Save product"}
      </button>
    </form>
  );
}
function Checkout({ s, items, actor, fulfill, setFulfill, busy, submit }: Any) {
  const [key] = useState(uid()),
    [error, setError] = useState("");
  let q: Any;
  try {
    q = quote(s, items, fulfill);
  } catch (e: Any) {
    return <p className="error-text">{e.message}</p>;
  }
  const fmt = (n: number) => money(n, s.config.currency),
    today = localDay(Date.now(), s.config.timezone);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        submit({ ...f, fulfillment: fulfill, items }, key).catch((e: Any) =>
          setError(e.message),
        );
      }}
    >
      <div className="toggle">
        <button
          type="button"
          className={fulfill === "pickup" ? "chosen" : ""}
          onClick={() => setFulfill("pickup")}
        >
          Store pickup · Free
        </button>
        <button
          type="button"
          className={fulfill === "delivery" ? "chosen" : ""}
          onClick={() => setFulfill("delivery")}
        >
          Local delivery · {fmt(s.config.deliveryFee)}
        </button>
      </div>
      <div className="form-grid">
        <Field
          label="Your name"
          name="name"
          defaultValue={s.customers?.[actor.uid]?.name}
          required
        />
        <Field
          label="Phone"
          name="phone"
          defaultValue={s.customers?.[actor.uid]?.phone}
          required
        />
        <Field
          label="Date"
          name="date"
          type="date"
          min={today}
          max={plusDays(today, 30)}
          defaultValue={plusDays(today, 1)}
          required
        />
        <Field label="Time slot">
          <select name="slot">
            {s.config.slots.map((v: string) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      {fulfill === "delivery" && (
        <>
          <Field label="Delivery address" name="address" required />
          <Field label="Postal code" name="postcode" required />
          <small>
            Delivery area: {s.config.postcodes.join(", ")} · Minimum{" "}
            {fmt(s.config.minOrder)}
          </small>
        </>
      )}
      <Field label="Payment method">
        <select name="payment">
          <option value="cash">
            Pay at {fulfill === "pickup" ? "pickup" : "delivery"}
          </option>
          {!actor.anonymous && s.customers?.[actor.uid]?.creditApproved && (
            <option value="credit">Approved store credit</option>
          )}
        </select>
      </Field>
      <div className="totals">
        <span>
          Items <b>{fmt(q.subtotal)}</b>
        </span>
        <span>
          Sale savings <b>{fmt(q.savings)}</b>
        </span>
        <span>
          Delivery <b>{fmt(q.delivery)}</b>
        </span>
        <span>
          Tax {s.config.taxInclusive ? "(included)" : ""}
          <b>{fmt(q.tax)}</b>
        </span>
        <span className="grand">
          Total <b>{fmt(q.total)}</b>
        </span>
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="primary full" disabled={busy}>
        {busy ? "Placing order…" : "Place order · " + fmt(q.total)}
      </button>
      <small>
        Stock, delivery capacity, and your total are checked before your order
        is accepted.
      </small>
    </form>
  );
}
function Orders({ s, owner, fmt, act, busy }: Any) {
  const [filter, setFilter] = useState("All"),
    [error, setError] = useState("");
  const orders = vals(s.orders).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const run = (command: string, d: Any) =>
    act(command, d).catch((e: Any) => setError(e.message));
  return (
    <>
      <div className="categories">
        {["All", "Placed", "Preparing", "Completed", "Cancelled"].map((x) => (
          <button
            key={x}
            onClick={() => setFilter(x)}
            className={filter === x ? "chosen" : ""}
          >
            {x}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      {orders
        .filter((o) => filter === "All" || o.status === filter)
        .map((o) => (
          <details className="order" key={o.id}>
            <summary>
              <div>
                <b>#{o.id.slice(0, 10).toUpperCase()}</b>
                <small>
                  {o.name} · {o.date}
                </small>
              </div>
              <span
                className={
                  "badge " + (o.status === "Completed" ? "success" : "")
                }
              >
                {o.status}
              </span>
              <strong>{fmt(o.total)}</strong>
              <ChevronRight size={18} />
            </summary>
            <div className="order-details">
              <p>
                <b>
                  {o.fulfillment === "pickup" ? "Store pickup" : "Delivery"}
                </b>{" "}
                · {o.date} · {o.slot}
              </p>
              {o.address && (
                <p>
                  {o.address} · {o.postcode}
                </p>
              )}
              <p>{o.phone}</p>
              {o.lines.map((l: Any) => (
                <div className="row spread" key={l.id}>
                  <span>
                    {l.qty} × {l.name} · {l.pack}
                  </span>
                  <b>{fmt(l.price * l.qty)}</b>
                </div>
              ))}
              <p>
                Payment:{" "}
                {o.payment === "credit"
                  ? "Store credit — see statement"
                  : o.paymentReceived
                    ? "Received"
                    : "Not yet received"}
              </p>
              <div className="row wrap">
                {owner && !["Completed", "Cancelled"].includes(o.status) && (
                  <button
                    disabled={busy}
                    className="primary"
                    onClick={() =>
                      run("order", {
                        id: o.id,
                        status: (
                          {
                            Placed: "Accepted",
                            Accepted: "Preparing",
                            Preparing:
                              o.fulfillment === "pickup"
                                ? "Ready for pickup"
                                : "Dispatched",
                            Dispatched: "Completed",
                            "Ready for pickup": "Completed",
                          } as Any
                        )[o.status],
                      })
                    }
                  >
                    Mark{" "}
                    {
                      (
                        {
                          Placed: "Accepted",
                          Accepted: "Preparing",
                          Preparing:
                            o.fulfillment === "pickup"
                              ? "Ready for pickup"
                              : "Dispatched",
                          Dispatched: "Completed",
                          "Ready for pickup": "Completed",
                        } as Any
                      )[o.status]
                    }
                  </button>
                )}
                {((owner &&
                  ["Placed", "Accepted", "Preparing"].includes(o.status)) ||
                  (!owner && o.status === "Placed")) && (
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => {
                      if (confirm("Cancel this order and restore its stock?"))
                        run("order", { id: o.id, status: "Cancelled" });
                    }}
                  >
                    Cancel order
                  </button>
                )}
                {owner &&
                  o.payment === "cash" &&
                  !o.paymentReceived &&
                  o.status !== "Cancelled" && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "Confirm that you have received " +
                              fmt(o.total) +
                              "?",
                          )
                        )
                          run("collected", { id: o.id });
                      }}
                    >
                      Record payment received
                    </button>
                  )}
                {owner && o.payment === "cash" && o.paymentReceived && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt(
                        "Confirm money was refunded outside the app. Enter the refund reason:",
                      );
                      if (reason) run("refund", { id: o.id, reason });
                    }}
                  >
                    Record refund
                  </button>
                )}
              </div>
            </div>
          </details>
        ))}
      {!orders.length && (
        <Empty
          title="No orders yet"
          body="Your next basket is the beginning of something good."
        />
      )}
    </>
  );
}
function Ledger({ s, customer, owner, act, busy }: Any) {
  const [mode, setMode] = useState(""),
    [error, setError] = useState(""),
    [requestKey, setRequestKey] = useState(uid());
  const c = s.customers[customer.id] || customer,
    fmt = (n: number) => money(n, s.config.currency),
    factor = 10 ** digits(s.config.currency);
  const charges = vals(s.charges).filter((x) => x.uid === c.id),
    payments = vals(s.payments).filter((x) => x.uid === c.id);
  const balance = dueBalance(s, c.id);
  const submit = (cmd: string, data: Any) =>
    act(cmd, data, requestKey)
      .then(() => {
        setMode("");
        setRequestKey(uid());
      })
      .catch((e: Any) => setError(e.message));
  return (
    <div>
      <div className="stats ledger-stats">
        <div className="stat">
          <span>Outstanding</span>
          <strong>{fmt(balance)}</strong>
        </div>
        <div className="stat">
          <span>Available credit</span>
          <strong>
            {fmt(
              c.creditApproved
                ? Math.max(0, c.creditLimit - balance - reservedCredit(s, c.id))
                : 0,
            )}
          </strong>
        </div>
      </div>
      {charges.some(
        (c) =>
          !c.reversed &&
          c.remaining > 0 &&
          c.dueDate <= localDay(Date.now(), s.config.timezone),
      ) && (
        <div className="due-notice">
          You have a payment due. Contact your shop to arrange payment.
        </div>
      )}
      {owner && (
        <div className="row wrap">
          {[
            ["customer", "Credit settings"],
            ["charge", "Add previous due"],
            ["payment", "Record payment"],
          ].map(([key, label]) => (
            <button
              className="secondary"
              key={key}
              onClick={() => {
                setMode(key);
                setRequestKey(uid());
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {mode && (
        <form
          className="form inset"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            submit(mode, {
              ...f,
              uid: c.id,
              amount: Math.round(Number(f.amount) * factor),
              creditLimit: Math.round(Number(f.creditLimit) * factor),
              creditApproved: f.creditApproved === "on",
            });
          }}
        >
          {mode === "customer" ? (
            <>
              <label className="check">
                <input
                  name="creditApproved"
                  type="checkbox"
                  defaultChecked={c.creditApproved}
                />
                Approved for store credit
              </label>
              <Field
                label="Credit limit"
                name="creditLimit"
                type="number"
                min="0"
                step={1 / factor}
                defaultValue={c.creditLimit / factor}
                required
              />
            </>
          ) : (
            <>
              <Field
                label={"Amount (" + s.config.currency + ")"}
                name="amount"
                type="number"
                step={1 / factor}
                min={1 / factor}
                max={mode === "payment" ? balance / factor : undefined}
                required
              />
              {mode === "charge" ? (
                <>
                  <Field label="Description" name="description" required />
                  <Field
                    label="Due date"
                    type="date"
                    name="dueDate"
                    defaultValue={plusDays(
                      localDay(Date.now(), s.config.timezone),
                      7,
                    )}
                    required
                  />
                </>
              ) : (
                <>
                  <Field label="Payment method">
                    <select name="method">
                      <option>Cash</option>
                      <option>Bank transfer</option>
                      <option>Other</option>
                    </select>
                  </Field>
                  <Field label="Reference / receipt" name="reference" />
                </>
              )}
            </>
          )}
          <button className="primary" disabled={busy}>
            Save
          </button>
        </form>
      )}
      <h3>Statement</h3>
      {[
        ...charges.map((x) => ({ ...x, kind: "charge" })),
        ...payments.map((x) => ({ ...x, kind: "payment" })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((x) => (
          <div className="statement-row" key={x.id}>
            <div>
              <b>
                {x.kind === "payment" ? "Payment · " + x.method : x.description}
              </b>
              <small>
                {x.date.slice(0, 10)} {x.dueDate && "· Due " + x.dueDate}
              </small>
              {x.reversed && (
                <small>Reversed: {x.reversalReason || "Order cancelled"}</small>
              )}
            </div>
            <div>
              <strong>
                {x.kind === "payment" ? "−" : ""}
                {fmt(x.amount)}
              </strong>
              {x.kind === "charge" && <small>{fmt(x.remaining)} left</small>}
            </div>
            {owner && !x.reversed && (
              <button
                className="text-btn"
                onClick={() => {
                  const reason = prompt(
                    "Reason for reversal (financial history is retained):",
                  );
                  if (reason)
                    submit("reverse", { id: x.id, kind: x.kind, reason });
                }}
              >
                Reverse
              </button>
            )}
          </div>
        ))}
      {!charges.length && !payments.length && (
        <Empty
          title="A fresh start"
          body="Charges and recorded payments will appear here."
        />
      )}
    </div>
  );
}
function SettingsForm({ s, act, busy }: Any) {
  const c = s.config,
    factor = 10 ** digits(c.currency);
  return (
    <form
      className="panel form settings"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        act("settings", {
          ...f,
          deliveryFee: Math.round(Number(f.deliveryFee) * factor),
          minOrder: Math.round(Number(f.minOrder) * factor),
          taxBps: Math.round(Number(f.taxRate) * 100),
          slotCapacity: Number(f.slotCapacity),
          repeatDays: Number(f.repeatDays),
          postcodes: String(f.postcodes)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          slots: String(f.slots)
            .split(",")
            .map((x) => x.trim()),
          taxInclusive: f.taxInclusive === "on",
          reminders: f.reminders === "on",
        }).catch(() => {});
      }}
    >
      <h2>Store details</h2>
      <div className="form-grid">
        {[
          ["logo", "Store logo URL"],
          ["name", "Store name"],
          ["country", "Country code"],
          ["currency", "Currency code"],
          ["timezone", "Time zone"],
          ["phone", "Phone"],
          ["hours", "Opening hours"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            name={key}
            defaultValue={c[key]}
            required={["name", "country", "currency", "timezone"].includes(key)}
          />
        ))}
        <Field
          label="Brand color"
          name="color"
          type="color"
          defaultValue={c.color}
        />
      </div>
      <Field label="Store address" name="address" defaultValue={c.address} />
      <Field label="Store font">
        <select name="font" defaultValue={c.font || "DM Sans"}>
          {["DM Sans", "Manrope", "Georgia", "Arial"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </Field>
      <h2>Delivery & pickup</h2>
      <div className="form-grid">
        <Field
          label="Delivery fee"
          name="deliveryFee"
          type="number"
          min="0"
          step={1 / factor}
          defaultValue={c.deliveryFee / factor}
        />
        <Field
          label="Delivery minimum"
          name="minOrder"
          type="number"
          min="0"
          step={1 / factor}
          defaultValue={c.minOrder / factor}
        />
        <Field
          label="Orders per slot"
          name="slotCapacity"
          type="number"
          min="1"
          defaultValue={c.slotCapacity}
        />
      </div>
      <Field
        label="Delivery postal codes (comma separated)"
        name="postcodes"
        defaultValue={c.postcodes.join(", ")}
      />
      <Field
        label="Time slots (comma separated, 24-hour HH:MM–HH:MM)"
        name="slots"
        defaultValue={c.slots.join(", ")}
        required
      />
      <h2>Tax & reminders</h2>
      <Field
        label="Tax rate (%)"
        name="taxRate"
        type="number"
        min="0"
        max="100"
        step="0.01"
        defaultValue={c.taxBps / 100}
      />
      <label className="check">
        <input
          name="taxInclusive"
          type="checkbox"
          defaultChecked={c.taxInclusive}
        />
        Prices include tax
      </label>
      <label className="check">
        <input name="reminders" type="checkbox" defaultChecked={c.reminders} />
        Enable payment reminders
      </label>
      <Field
        label="Repeat after day 3, every (days)"
        name="repeatDays"
        type="number"
        min="1"
        max="90"
        defaultValue={c.repeatDays}
      />
      <p className="muted">
        Email reminders require a configured sender. In-app due notices work
        immediately.
      </p>
      <button className="primary" disabled={busy}>
        Save settings <Check size={17} />
      </button>
    </form>
  );
}
function Editor({ s, act, busy }: Any) {
  const [draft, setDraft] = useState(s.draft),
    [history, setHistory] = useState<Any[]>([]),
    [future, setFuture] = useState<Any[]>([]),
    [page, setPage] = useState(0),
    [mobile, setMobile] = useState(false),
    [drag, setDrag] = useState<number | null>(null);
  const update = (next: Any) => {
    setHistory([...history, draft]);
    setFuture([]);
    setDraft(next);
  };
  const change = (i: number, key: string, value: Any) => {
    const next = structuredClone(draft);
    next.pages[page].sections[i][key] = value;
    update(next);
  };
  const reorder = (from: number, to: number) => {
    const next = structuredClone(draft);
    const [b] = next.pages[page].sections.splice(from, 1);
    next.pages[page].sections.splice(to, 0, b);
    update(next);
  };
  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button
          className="icon"
          disabled={!history.length}
          aria-label="Undo"
          onClick={() => {
            setFuture([draft, ...future]);
            setDraft(history[history.length - 1]);
            setHistory(history.slice(0, -1));
          }}
        >
          <Undo2 size={18} />
        </button>
        <button
          className="icon"
          disabled={!future.length}
          aria-label="Redo"
          onClick={() => {
            setHistory([...history, draft]);
            setDraft(future[0]);
            setFuture(future.slice(1));
          }}
        >
          <Redo2 size={18} />
        </button>
        <button className="secondary" onClick={() => setMobile(!mobile)}>
          {mobile ? "Desktop" : "Mobile"} preview
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act("draft", draft).catch(() => {})}
        >
          Save draft
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            act("draft", draft)
              .then(() => act("publish"))
              .catch(() => {})
          }
        >
          Publish website <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="muted">
        Draft changes stay private until you publish. Shopping, checkout, and
        accounts remain available.
      </p>
      <div className="row wrap">
        <select
          aria-label="Page"
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
        >
          {draft.pages.map((p: Any, i: number) => (
            <option key={p.id} value={i}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() => {
            const label = prompt("Page name");
            if (label) {
              update({
                ...draft,
                pages: [...draft.pages, { id: uid(), label, sections: [] }],
              });
              setPage(draft.pages.length);
            }
          }}
        >
          Add page <Plus size={14} />
        </button>
        <button
          className="text-btn"
          onClick={() => {
            const label = prompt("Navigation label", draft.pages[page].label);
            if (label) {
              const next = structuredClone(draft);
              next.pages[page].label = label;
              update(next);
            }
          }}
        >
          Rename
        </button>
      </div>
      <div className="editor-layout">
        <div className="sections">
          {draft.pages[page].sections.map((b: Any, i: number) => (
            <div
              className="section-card"
              key={b.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== null) reorder(drag, i);
                setDrag(null);
              }}
            >
              <div className="row spread">
                <span className="row">
                  <GripVertical size={15} />
                  <b>{b.type}</b>
                </span>
                <span>
                  <button
                    aria-label="Move section up"
                    disabled={i === 0}
                    onClick={() => reorder(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move section down"
                    disabled={i === draft.pages[page].sections.length - 1}
                    onClick={() => reorder(i, i + 1)}
                  >
                    ↓
                  </button>
                  <button
                    aria-label="Remove section"
                    onClick={() => {
                      const next = structuredClone(draft);
                      next.pages[page].sections.splice(i, 1);
                      update(next);
                    }}
                  >
                    <X size={15} />
                  </button>
                </span>
              </div>
              <Field
                label="Heading"
                value={b.title}
                onChange={(e: Any) => change(i, "title", e.target.value)}
              />
              <Field label="Text">
                <textarea
                  value={b.body}
                  onChange={(e) => change(i, "body", e.target.value)}
                />
              </Field>
              {["image", "banner"].includes(b.type) && (
                <Field
                  label="Image URL"
                  value={b.image}
                  onChange={(e: Any) => change(i, "image", e.target.value)}
                />
              )}
              <Field label="Columns">
                <select
                  value={b.columns || 1}
                  onChange={(e) => change(i, "columns", Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              {b.type === "button" && (
                <Field
                  label="Link (HTTPS or #catalog)"
                  value={b.link}
                  onChange={(e: Any) => change(i, "link", e.target.value)}
                />
              )}
            </div>
          ))}
          <select
            aria-label="Add section"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const next = structuredClone(draft);
              next.pages[page].sections.push({
                id: uid(),
                type: e.target.value,
                title: "Your heading",
                body: "",
                image: "",
                link: "",
                columns: 1,
              });
              update(next);
            }}
          >
            <option value="">+ Add a section</option>
            {[
              "banner",
              "text",
              "image",
              "products",
              "categories",
              "button",
              "contact",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className={"editor-preview " + (mobile ? "mobile" : "")}>
          <div className="preview-nav">
            <ShoppingBasket size={20} />
            <b>{s.config.name}</b>
            <span>Basket</span>
          </div>
          {draft.pages[page].sections.map((b: Any) => (
            <div className={"preview-block " + b.type} key={b.id}>
              {b.image && <img src={b.image} alt={b.title} />}
              <h2>{b.title}</h2>
              <p style={{ columnCount: b.columns || 1 }}>{b.body}</p>
              {b.type === "products" && (
                <div className="mini-products">
                  {vals(s.products)
                    .slice(0, 3)
                    .map((p) => (
                      <span key={p.id}>{p.name}</span>
                    ))}
                </div>
              )}
              {b.type === "button" && (
                <span className="primary">{b.title}</span>
              )}
            </div>
          ))}
          <div className="preview-protected">
            Product catalog · Basket · Checkout · Account
          </div>
        </div>
      </div>
      <section className="panel">
        <h3>Published versions</h3>
        {vals(s.revisions)
          .reverse()
          .map((r) => (
            <div className="list-row" key={r.id}>
              <span>{new Date(r.date).toLocaleString()}</span>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act("restore", { id: r.id })
                    .then(() => {
                      setDraft(r.content);
                      setPage(0);
                      setHistory([]);
                      setFuture([]);
                    })
                    .catch(() => {})
                }
              >
                Restore to draft
              </button>
            </div>
          ))}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
