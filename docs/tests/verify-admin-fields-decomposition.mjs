import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "src/features/fields/admin/field-settings-types.ts",
  "src/features/fields/admin/field-settings-helpers.ts",
  "src/features/fields/admin/field-option-drafts.tsx",
  "src/features/fields/admin/add-field-modal.tsx",
  "src/features/fields/admin/edit-custom-field-modal.tsx",
  "src/features/fields/admin/edit-core-field-modal.tsx",
  "src/features/fields/admin/field-card.tsx",
  "src/features/fields/admin/field-card-grid.tsx",
  "src/features/fields/admin/field-settings-toolbar.tsx",
  "src/features/fields/admin/use-field-settings-controller.ts",
  "src/features/fields/admin/field-settings-view.tsx",
];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

const failures = [];
const missingFiles = requiredFiles.filter((file) => !existsSync(path.join(repoRoot, file)));

if (missingFiles.length > 0) {
  failures.push(
    `Missing admin fields decomposition files:\n${missingFiles
      .map((file) => `- ${file}`)
      .join("\n")}`
  );
}

const pagePath = "src/app/admin/fields/page.tsx";
if (!existsSync(path.join(repoRoot, pagePath))) {
  failures.push("Missing admin fields page.");
} else {
  const page = read(pagePath);
  if (!page.includes("FieldSettingsView")) {
    failures.push("Admin fields page must render FieldSettingsView.");
  }
  if (lineCount(page) > 25) {
    failures.push(`Admin fields page must be thin, found ${lineCount(page)} lines.`);
  }
}

if (missingFiles.length === 0) {
  const view = read("src/features/fields/admin/field-settings-view.tsx");
  const controller = read("src/features/fields/admin/use-field-settings-controller.ts");
  const helpers = read("src/features/fields/admin/field-settings-helpers.ts");
  const types = read("src/features/fields/admin/field-settings-types.ts");
  const grid = read("src/features/fields/admin/field-card-grid.tsx");
  const card = read("src/features/fields/admin/field-card.tsx");
  const toolbar = read("src/features/fields/admin/field-settings-toolbar.tsx");

  if (!view.includes("useFieldSettingsController")) {
    failures.push("FieldSettingsView must use useFieldSettingsController().");
  }
  if (!view.includes("FieldSettingsToolbar")) {
    failures.push("FieldSettingsView must render FieldSettingsToolbar.");
  }
  if (!view.includes("FieldCardGrid")) {
    failures.push("FieldSettingsView must render FieldCardGrid.");
  }
  if (!view.includes("AddFieldModal")) {
    failures.push("FieldSettingsView must render AddFieldModal.");
  }
  if (!view.includes("EditCustomFieldModal")) {
    failures.push("FieldSettingsView must render EditCustomFieldModal.");
  }
  if (!view.includes("EditCoreFieldModal")) {
    failures.push("FieldSettingsView must render EditCoreFieldModal.");
  }

  if (!controller.includes("export function useFieldSettingsController")) {
    failures.push("Controller file must export useFieldSettingsController().");
  }
  if (!controller.includes("useFieldData('all')")) {
    failures.push("Controller must keep loading all fields.");
  }
  if (!controller.includes("publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL)")) {
    failures.push("Controller must keep catalog invalidation.");
  }
  if (!controller.includes("publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI)")) {
    failures.push("Controller must keep reports invalidation.");
  }

  for (const helperName of [
    "parseActionError",
    "normalizeOptionLabels",
    "normalizeCoreOptionLabels",
    "canEditCoreOptions",
  ]) {
    if (!helpers.includes(`export function ${helperName}`)) {
      failures.push(`Helpers must export ${helperName}.`);
    }
  }

  for (const typeName of ["Category", "VisibilityFilter", "CoreFieldEditor"]) {
    if (!types.includes(`export type ${typeName}`)) {
      failures.push(`Types file must export ${typeName}.`);
    }
  }

  if (!grid.includes("FieldCard")) {
    failures.push("FieldCardGrid must render FieldCard.");
  }
  if (!card.includes("GripVertical") || !card.includes("Trash2") || !card.includes("Pencil")) {
    failures.push("FieldCard must keep reorder, delete, and edit controls.");
  }
  if (!toolbar.includes("visibilityFilter") || !toolbar.includes("query")) {
    failures.push("FieldSettingsToolbar must own query and visibility controls.");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("Admin fields decomposition static checks passed.");
