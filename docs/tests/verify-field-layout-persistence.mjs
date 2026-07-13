import { Buffer } from "node:buffer";
import ts from "typescript";
import { failIfAny, pathExists, readText } from "./structure-test-helpers.mjs";

const failures = [];

function expectText(file, pattern, message) {
  if (!pathExists(file)) {
    failures.push(`${file}: missing`);
    return "";
  }
  const text = readText(file);
  if (!pattern.test(text)) {
    failures.push(`${file}: ${message}`);
  }
  return text;
}

const layoutSource = expectText(
  "src/features/fields/field-layout.ts",
  /export\s+function\s+normalizeFieldLayoutConfig/,
  "must export the server-safe normalizer"
);
if (/export\s+function\s+saveFieldLayoutConfig/.test(layoutSource)) {
  failures.push("field-layout.ts: localStorage must not remain a save authority");
}
if (!/loadLegacyFieldLayoutConfig/.test(layoutSource) || !/clearLegacyFieldLayoutConfig/.test(layoutSource)) {
  failures.push("field-layout.ts: localStorage may only remain as a clearable legacy import source");
}
if (!/key:\s*["']rating["'][\s\S]*?defaultPublic:\s*false/.test(layoutSource)) {
  failures.push("field-layout.ts: rating must be configurable and internal by default");
}

if (layoutSource) {
  const compiled = ts.transpileModule(layoutSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const layout = await import(dataUrl);
  const normalized = layout.normalizeFieldLayoutConfig({
    version: 99,
    configured: true,
    order: {
      Bicycle: ["core:name", "core:name", "core:unknown", "custom:valid_id", "bad:id"],
      Unknown: ["core:serial"],
    },
    coreVisibility: {
      Bicycle: { rating: true, serial: "yes", unknown: true },
    },
    coreLabels: {
      Bicycle: { name: " x ".repeat(100), unknown: "leak" },
    },
    coreOptions: {
      drive_type: [
        { label: "Manual", value: "Manual" },
        { label: "Duplicate", value: "manual" },
        { label: "", value: "bad" },
      ],
      unknown: [{ label: "Bad", value: "Bad" }],
    },
  });

  if (normalized.version !== 1 || normalized.configured !== true) {
    failures.push("normalizeFieldLayoutConfig must force version 1 and preserve only boolean configured");
  }
  if (normalized.coreVisibility.Bicycle.rating !== true) {
    failures.push("normalizeFieldLayoutConfig must preserve valid rating visibility");
  }
  if (normalized.coreVisibility.Bicycle.serial !== false) {
    failures.push("normalizeFieldLayoutConfig must reject non-boolean visibility");
  }
  if (normalized.order.Bicycle.join(",") !== "core:name,custom:valid_id") {
    failures.push("normalizeFieldLayoutConfig must deduplicate and reject unknown order IDs");
  }
  if (normalized.coreLabels.Bicycle.name.length > 120) {
    failures.push("normalizeFieldLayoutConfig must cap labels at 120 characters");
  }
  if (normalized.coreOptions.drive_type.length !== 1 || normalized.coreOptions.unknown) {
    failures.push("normalizeFieldLayoutConfig must deduplicate options and reject unknown keys");
  }
}

expectText(
  "supabase/migrations/20260713000100_add_field_layout_to_app_settings.sql",
  /field_layout_config\s+jsonb\s+not\s+null[\s\S]*?'configured',\s*false[\s\S]*?'rating',\s*false/,
  "migration must add versioned conservative field layout JSON"
);

const service = expectText(
  "src/app/api/fields/field-layout-service.ts",
  /readFieldLayoutState[\s\S]*writeFieldLayout/,
  "must expose shared read/write service methods"
);
if (!/configured:\s*true/.test(service)) {
  failures.push("field-layout-service.ts: persisted administrator review must set configured=true");
}

const route = expectText(
  "src/app/api/fields/layout/route.ts",
  /export\s+async\s+function\s+GET[\s\S]*export\s+async\s+function\s+PATCH/,
  "must expose staff GET and admin PATCH"
);
if (!/role\s*!==\s*["']admin["']/.test(route) || /\bdetails\s*:/.test(route)) {
  failures.push("field layout route must enforce admin writes and return no raw details");
}
if ((route.match(/getRequestAuth\s*\(/g) ?? []).length !== 1) {
  failures.push("field layout route must resolve authentication only once per request");
}

for (const file of [
  "src/features/fields/repositories/field-repository.ts",
  "src/features/fields/adapters/supabase/field-repository.supabase.ts",
  "src/features/fields/adapters/mock/field-repository.mock.ts",
]) {
  expectText(file, /getFieldLayout[\s\S]*updateFieldLayout/, "must implement shared layout reads and writes");
}

const controller = expectText(
  "src/features/fields/admin/use-field-settings-controller.ts",
  /getFieldLayout[\s\S]*updateFieldLayout/,
  "must load and persist the shared layout"
);
if (/saveFieldLayoutConfig|setLayoutVersion/.test(controller)) {
  failures.push("field settings controller must not save authoritative layout to localStorage");
}
if (!/previousConfig[\s\S]*setFieldLayoutConfig\(previousConfig\)/.test(controller)) {
  failures.push("field settings controller must roll optimistic layout state back after failure");
}

expectText(
  "src/app/shop/[id]/page.tsx",
  /useFieldLayout\(\{\s*enabled:\s*isStaff\s*\}\)/,
  "customer detail must not add a separate field-layout request"
);

expectText(
  "src/features/fields/admin/field-layout-review-banner.tsx",
  /layoutImportPreview[\s\S]*onImportLegacy[\s\S]*onUseDefaults/,
  "must show an explicit legacy import/default review"
);
expectText(
  "src/app/api/settings/settings-service.ts",
  /SHOP_CONFIGURATION_SELECT[\s\S]*field_layout_config[\s\S]*readShopConfiguration/,
  "must read settings and layout through one normal query"
);

failIfAny(failures, "Shared field layout persistence checks passed.");
