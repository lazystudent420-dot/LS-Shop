import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { within, fireEvent, waitFor } from "@testing-library/dom";
test("customer checkout persists and owner accepts the order through rendered controls", async () => {
  const built = await build({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    define: { "import.meta.env": "{}" },
    loader: { ".css": "empty" },
    platform: "browser",
    logLevel: "silent",
  });
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://demo.example.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.structuredClone = structuredClone;
  Object.defineProperty(w.navigator, "locks", {
    value: { request: async (_key, fn) => fn() },
  });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.confirm = () => true;
  w.eval(built.outputFiles[0].text);
  const ui = within(w.document.body);
  try {
    await waitFor(() => assert.ok(ui.getByText("What’s on your list?")), {
      container: w.document.body,
    });
    fireEvent.click(
      ui.getByRole("button", { name: "Add Farm-fresh tomatoes" }),
    );
    await waitFor(
      () => assert.ok(ui.getByRole("button", { name: /Basket\s*1/ })),
      { container: w.document.body },
    );
    fireEvent.click(ui.getByRole("button", { name: /Basket\s*1/ }));
    await waitFor(
      () => assert.ok(ui.getByRole("button", { name: "Continue to checkout" })),
      { container: w.document.body },
    );
    fireEvent.click(ui.getByRole("button", { name: "Continue to checkout" }));
    await waitFor(
      () => assert.ok(ui.getByRole("dialog", { name: "Checkout" })),
      { container: w.document.body },
    );
    const checkout = ui.getByRole("dialog", { name: "Checkout" });
    fireEvent.submit(checkout.querySelector("form"));
    await waitFor(
      () => assert.ok(ui.getByRole("heading", { name: "My orders" })),
      { container: w.document.body },
    );
    assert.match(ui.getAllByText("Placed").at(-1).textContent, /Placed/);
    fireEvent.click(ui.getByRole("button", { name: /Try shop owner view/ }));
    await waitFor(
      () => assert.ok(ui.getByRole("heading", { name: "Overview" })),
      { container: w.document.body },
    );
    const order = w.document.querySelector("details");
    order.open = true;
    fireEvent.click(ui.getByRole("button", { name: "Mark Accepted" }));
    await waitFor(() => assert.ok(ui.getByText("Accepted")), {
      container: w.document.body,
    });
    const stored = JSON.parse(w.localStorage.getItem("grove-demo-v1"));
    assert.equal(
      Object.values(stored["green-basket"].orders)[0].status,
      "Accepted",
    );
    assert.equal(stored["green-basket"].products.tomatoes.stock, 35);
    fireEvent.click(ui.getByRole("button", { name: "Website editor" }));
    await waitFor(
      () => assert.ok(ui.getByRole("button", { name: "Publish website" })),
      { container: w.document.body },
    );
    assert.ok(ui.getByLabelText("Heading"));
  } finally {
    await new Promise((r) => setTimeout(r, 100));
    w.close();
  }
});
