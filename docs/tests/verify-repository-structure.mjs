import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

function hasImport(text, pattern) {
  return pattern.test(text);
}

for (const file of listFiles("src/features", [".ts", ".tsx"]).filter((item) => /repositories\/.+-repository\.ts$/.test(item))) {
  const text = readText(file);
  if (hasImport(text, /from\s+["']react["']|from\s+["']next\//)) {
    failures.push(`${file}: repository interfaces must not import React or Next`);
  }
}

const adapterFiles = [
  ...listFiles("src/features", [".ts", ".tsx"]).filter((item) => /adapters\/api\/.+\.ts$/.test(item)),
  ...listFiles("src/features", [".ts", ".tsx"]).filter((item) => /adapters\/supabase\/.+\.ts$/.test(item)),
];

for (const file of adapterFiles) {
  const text = readText(file);
  if (hasImport(text, /from\s+["']@\/server\//)) {
    failures.push(`${file}: client adapters must not import src/server`);
  }
  if (hasImport(text, /getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/)) {
    failures.push(`${file}: client adapters must not import Supabase admin clients`);
  }
}

for (const file of listFiles("src/features", [".ts", ".tsx"]).filter((item) => /repositories\/use-.+\.(ts|tsx)$/.test(item))) {
  const text = readText(file);
  if (hasImport(text, /mockRuntimeStore/)) {
    failures.push(`${file}: repository hooks must not import mockRuntimeStore`);
  }
}

failIfAny(failures, "Repository structure checks passed.");
