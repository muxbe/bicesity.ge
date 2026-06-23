import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const componentFiles = [
  "src/features/shop/home/components/home-navigation.tsx",
  "src/features/shop/home/components/home-filter-toolbar.tsx",
  "src/features/shop/home/components/detailed-filter-panel.tsx",
  "src/features/shop/home/components/product-grid.tsx",
  "src/features/shop/home/components/product-card.tsx",
  "src/features/shop/home/components/product-card-image.tsx",
  "src/features/shop/home/components/rent-view.tsx",
];

const hookFiles = [
  "src/features/shop/home/hooks/use-home-catalog.ts",
  "src/features/shop/home/hooks/use-home-filters.ts",
  "src/features/shop/home/hooks/use-home-navigation.ts",
  "src/features/shop/home/hooks/use-rent-messenger.ts",
];

const supportFiles = [
  "src/features/shop/home/home-view.tsx",
  "src/features/shop/home/home-types.ts",
  "src/features/shop/home/home-helpers.ts",
];

const requiredFiles = [...componentFiles, ...hookFiles, ...supportFiles];

function absolute(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  return readFileSync(absolute(relativePath), "utf8");
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function checkMaxLines(files, max, failures) {
  for (const file of files) {
    if (!existsSync(absolute(file))) {
      continue;
    }
    const count = lineCount(read(file));
    if (count > max) {
      failures.push(`${file}: ${count} lines exceeds ${max}.`);
    }
  }
}

const failures = [];
const missingFiles = requiredFiles.filter((file) => !existsSync(absolute(file)));

if (missingFiles.length > 0) {
  failures.push(
    `Missing homepage decomposition files:\n${missingFiles
      .map((file) => `- ${file}`)
      .join("\n")}`
  );
}

const pagePath = "src/app/page.tsx";
if (!existsSync(absolute(pagePath))) {
  failures.push("Missing public homepage route.");
} else {
  const page = read(pagePath);
  if (!page.includes("HomeView")) {
    failures.push("Public homepage route must render HomeView.");
  }
  if (lineCount(page) > 20) {
    failures.push(`Public homepage route must be at most 20 lines.`);
  }
}

if (missingFiles.length === 0) {
  const view = read("src/features/shop/home/home-view.tsx");
  const catalog = read("src/features/shop/home/hooks/use-home-catalog.ts");
  const filters = read("src/features/shop/home/hooks/use-home-filters.ts");
  const navigation = read("src/features/shop/home/hooks/use-home-navigation.ts");
  const messenger = read("src/features/shop/home/hooks/use-rent-messenger.ts");
  const image = read("src/features/shop/home/components/product-card-image.tsx");
  const helpers = read("src/features/shop/home/home-helpers.ts");

  for (const hookName of [
    "useHomeCatalog",
    "useHomeFilters",
    "useHomeNavigation",
    "useRentMessenger",
  ]) {
    if (!view.includes(hookName)) {
      failures.push(`HomeView must use ${hookName}.`);
    }
  }

  for (const componentName of [
    "HomeNavigation",
    "HomeFilterToolbar",
    "DetailedFilterPanel",
    "ProductGrid",
    "RentView",
  ]) {
    if (!view.includes(componentName)) {
      failures.push(`HomeView must render ${componentName}.`);
    }
  }

  if (!catalog.includes("fetch('/api/shop/bootstrap'") &&
      !catalog.includes('fetch("/api/shop/bootstrap"')) {
    failures.push("Catalog hook must keep /api/shop/bootstrap loading.");
  }
  if (!catalog.includes("CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL")) {
    failures.push("Catalog hook must keep catalog freshness.");
  }
  if (!filters.includes("draftFilters") || !filters.includes("appliedFilters")) {
    failures.push("Filter hook must keep separate draft and applied filters.");
  }
  if (!filters.includes("sanitizeAttributeValues")) {
    failures.push("Filter hook must sanitize category attribute values.");
  }
  for (const hash of ["#rent", "#bicycles", "#components"]) {
    if (!navigation.includes(hash)) {
      failures.push(`Navigation hook must keep ${hash}.`);
    }
  }
  if (!messenger.includes("buildRentMessage") || !messenger.includes("buildMessengerUrl")) {
    failures.push("Rental hook must keep Messenger message and URL behavior.");
  }
  if (!image.includes("getFallbackImage") || !image.includes("onError")) {
    failures.push("ProductCardImage must keep category fallback behavior.");
  }
  for (const helperName of [
    "parsePrice",
    "buildMessengerUrl",
    "buildRentMessage",
    "sanitizeAttributeValues",
    "filterProducts",
    "countActiveFilters",
  ]) {
    if (!helpers.includes(`export function ${helperName}`)) {
      failures.push(`Homepage helpers must export ${helperName}.`);
    }
  }
}

checkMaxLines(
  [...componentFiles, "src/features/shop/home/home-view.tsx"],
  300,
  failures
);
checkMaxLines(hookFiles, 350, failures);
checkMaxLines(
  [
    "src/features/shop/home/home-types.ts",
    "src/features/shop/home/home-helpers.ts",
  ],
  200,
  failures
);

for (const hookFile of hookFiles) {
  if (!existsSync(absolute(hookFile))) {
    continue;
  }
  const source = read(hookFile);
  for (const otherHook of hookFiles) {
    if (hookFile === otherHook) {
      continue;
    }
    const basename = path.basename(otherHook, path.extname(otherHook));
    if (source.includes(basename)) {
      failures.push(`${hookFile} must not import or call ${basename}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("Homepage decomposition static checks passed.");
