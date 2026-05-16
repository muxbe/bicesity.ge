import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");

const home = read("src", "app", "page.tsx");
const productDetail = read("src", "app", "shop", "[id]", "page.tsx");
const adminLayout = read("src", "app", "admin", "layout.tsx");
const sellerLayout = read("src", "app", "seller", "layout.tsx");
const adminInventory = read("src", "features", "admin", "admin-inventory-view.tsx");
const v3 = read("docs", "v3", "index.html");

const failures = [];

function requireIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    failures.push(message);
  }
}

function requireNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) {
    failures.push(message);
  }
}

requireIncludes(
  home,
  '<LanguageSwitcher compact className="sm:hidden" />',
  "User mobile header does not include compact language control."
);
requireIncludes(
  home,
  'grid-cols-[minmax(0,1fr)_auto]',
  "User mobile filter row is not compact search + filters."
);
requireIncludes(
  home,
  'className="brand-control hidden h-11 rounded-xl border px-3 text-sm sm:block"',
  "Category/stock controls are not hidden from the mobile closed filter row."
);
requireIncludes(
  home,
  '<label className="block text-xs font-semibold text-slate-500 mb-2">{t(\'home.allCategories\')}</label>',
  "Detailed filter panel is missing category control."
);
requireIncludes(
  home,
  '<label className="block text-xs font-semibold text-slate-500 mb-2">{t(\'home.allStock\')}</label>',
  "Detailed filter panel is missing stock control."
);
requireNotIncludes(
  home,
  'relative z-[90] border-t border-cyan-100/80 bg-white/80',
  "User page still has a separate language row."
);

requireIncludes(
  productDetail,
  "<LanguageSwitcher compact />",
  "Product detail nav does not include compact language control."
);
requireNotIncludes(
  productDetail,
  'relative z-[90] border-b border-cyan-100 bg-white',
  "Product detail still has a separate language row."
);

requireIncludes(adminLayout, "<LanguageSwitcher compact />", "Admin layout language switcher is not compact.");
requireIncludes(sellerLayout, "<LanguageSwitcher compact />", "Seller layout language switcher is not compact.");

requireIncludes(
  adminInventory,
  "grid-cols-3 gap-2 mb-4 sm:gap-3 sm:mb-5",
  "Admin inventory metrics are not compact on mobile."
);
requireIncludes(
  adminInventory,
  "grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center",
  "Admin inventory search/filter controls are not compact on mobile."
);

requireIncludes(v3, ".viewport-mobile .tool-row", "V3 mobile catalog tools are missing.");
requireIncludes(v3, ".viewport-mobile .tool-row .fake-select", "V3 mobile catalog does not hide stacked select controls.");

if (failures.length > 0) {
  console.error("mobile visual polish failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("mobile visual polish verified.");
