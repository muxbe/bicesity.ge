import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

for (const file of listFiles("src/server", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/^["']use client["'];?/m.test(text)) {
    failures.push(`${file}: server modules must not be client components`);
  }
}

for (const file of listFiles("src/features", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/.test(text)) {
    failures.push(`${file}: feature code must not import Supabase admin clients`);
  }
}

for (const file of listFiles("src/components", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/.test(text)) {
    failures.push(`${file}: component code must not import Supabase admin clients`);
  }
}

failIfAny(failures, "Backend service boundary checks passed.");
