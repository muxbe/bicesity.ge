import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

function assertNoImport(files, forbiddenPattern, message) {
  for (const file of files) {
    const text = readText(file);
    if (forbiddenPattern.test(text)) {
      failures.push(`${file}: ${message}`);
    }
  }
}

const componentUiFiles = listFiles("src/components/ui", [".ts", ".tsx"]);
assertNoImport(
  componentUiFiles,
  /from\s+["']@\/features\/|from\s+["']@\/app\/api\/|from\s+["']@\/server\/|from\s+["']@\/lib\/supabase\//,
  "shared UI must not import feature, API, server, or Supabase modules"
);

const featureFiles = listFiles("src/features", [".ts", ".tsx"]);
assertNoImport(
  featureFiles,
  /from\s+["']@\/server\//,
  "feature code must not import server-only modules"
);

const serverFiles = listFiles("src/server", [".ts", ".tsx"]);
assertNoImport(
  serverFiles,
  /^["']use client["'];?/m,
  "server modules must not be client components"
);

failIfAny(failures, "Structure boundary checks passed.");
