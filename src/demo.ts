import { emptyStore } from "../functions/src/engine.mjs";
export function seed() {
  const s: any = emptyStore("demo-owner", "The Green Basket", "green-basket");
  s.config.address = "Jhargram, West Bengal";
  s.config.minOrder = 15000;
  const products = [
    [
      "tomatoes",
      "Farm-fresh tomatoes",
      "Vegetables",
      "500 g",
      3500,
      2900,
      36,
      "🍅",
    ],
    ["avocado", "Creamy avocados", "Fruits", "2 pieces", 18000, null, 12, "🥑"],
    [
      "bananas",
      "Naturally sweet bananas",
      "Fruits",
      "6 pieces",
      5500,
      null,
      28,
      "🍌",
    ],
    ["carrots", "Crunchy carrots", "Vegetables", "500 g", 4000, null, 20, "🥕"],
    [
      "milk",
      "Fresh whole milk",
      "Dairy & eggs",
      "1 litre",
      6800,
      null,
      18,
      "🥛",
    ],
    ["bread", "Whole wheat bread", "Bakery", "400 g", 5000, 4500, 8, "🍞"],
    ["eggs", "Farm eggs", "Dairy & eggs", "6 pieces", 6500, null, 24, "🥚"],
    ["rice", "Everyday basmati rice", "Pantry", "1 kg", 12500, null, 32, "🌾"],
  ];
  products.forEach(
    ([id, name, category, pack, price, salePrice, stock, emoji]) =>
      (s.products[id as string] = {
        id,
        name,
        category,
        pack,
        price,
        salePrice,
        stock,
        emoji,
        description:
          "Carefully selected everyday goodness. Packed fresh by your neighborhood store.",
        image: "",
        visible: true,
      }),
  );
  s.customers["demo-customer"] = {
    id: "demo-customer",
    name: "Aditi Sen",
    phone: "9000000000",
    email: "aditi@example.test",
    emailVerified: true,
    creditApproved: true,
    creditLimit: 100000,
  };
  s.draft.pages[0].sections[0].title = "Fresh picks.\nEveryday goodness.";
  s.draft.pages[0].sections[0].body =
    "A little fresher. A little closer. Shop your daily essentials from the people who know your neighborhood.";
  s.published = structuredClone(s.draft);
  return s;
}
