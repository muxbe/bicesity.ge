import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const routePath = join(dirname(fileURLToPath(import.meta.url)), "index.html");
const html = readFileSync(routePath, "utf8");

const requiredSnippets = [
  "V3 PC, Tablet, and Mobile Page Visuals",
  "279399999_116543327705069_5323243531129900723_n.jpg",
  "Bike City Biking Store logo",
  "data-viewport=\"pc\"",
  "data-viewport=\"tablet\"",
  "data-viewport=\"mobile\"",
  "viewport-tablet",
  "viewport-mobile",
  "activeViewport",
  "function viewportLabel()",
  "activeViewport === \"mobile\"",
  "activeViewport === \"tablet\" ? \"Tablet\" : \"PC\"",
  "{ id: \"all\", label: \"All pages\" }",
  "id=\"filter-query\"",
  "id=\"filter-category\"",
  "id=\"filter-stock\"",
  "id=\"filter-bike-type\"",
  "id=\"filter-min\"",
  "id=\"filter-max\"",
  "data-attribute=\"attr_1\"",
  "data-attribute=\"attr_3\"",
  "data-attribute=\"attr_7\"",
  "id=\"preview-stage\"",
  "function publicProducts()",
  "status === \"active\"",
  "Admin inventory",
  "Seller inventory",
  "Auth pages",
  "class=\"detail-key-specs\"",
  "class=\"detail-spec-grid\"",
  "class=\"detail-spec-cell\"",
  "class=\"field-card",
  "Bicycle Fields",
  "--sidebar-active",
  ".detail-panel .field",
  ".fake-select::after",
  ".viewport-tablet .admin-shell",
  ".viewport-tablet .product-grid",
  ".viewport-tablet .detail-page",
  ".viewport-tablet .auth-grid",
  ".viewport-mobile .admin-shell",
  ".viewport-mobile .product-grid",
  ".viewport-mobile .detail-page",
  ".viewport-mobile .auth-grid",
  ".viewport-mobile .detail-filter-row"
];

const missing = requiredSnippets.filter((snippet) => !html.includes(snippet));

if (missing.length > 0) {
  console.error("v3 route is missing required snippets:");
  for (const snippet of missing) {
    console.error(`- ${snippet}`);
  }
  process.exit(1);
}

console.log("v3 route structure verified.");
