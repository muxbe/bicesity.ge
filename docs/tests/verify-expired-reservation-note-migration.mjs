import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260617101214_preserve_expired_reservation_notes.sql"
);
const failures = [];

if (!existsSync(migrationPath)) {
  failures.push("Missing expired reservation note preservation migration.");
} else {
  const sql = readFileSync(migrationPath, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();
  const expiredBranch = normalized.match(/elsif new\.status = 'expired' then(?<body>.*?)end if;/)?.groups
    ?.body;

  if (!normalized.includes("create or replace function public.enforce_reservation_state()")) {
    failures.push("Migration must replace public.enforce_reservation_state().");
  }

  if (!expiredBranch) {
    failures.push("Migration must define explicit expired reservation trigger behavior.");
  } else {
    if (expiredBranch.includes("new.cancellation_note := null")) {
      failures.push("Expired reservation trigger branch must not clear cancellation_note.");
    }
    if (expiredBranch.includes("new.cancellation_reason_code := null")) {
      failures.push("Expired reservation trigger branch must not clear cancellation_reason_code.");
    }
    if (!expiredBranch.includes("new.cancellation_reason_code := coalesce")) {
      failures.push("Expired reservation trigger branch must preserve or set cancellation_reason_code.");
    }
    if (!expiredBranch.includes("'expired'::public.reservation_cancel_reason")) {
      failures.push("Expired reservation trigger branch must default cancellation_reason_code to expired.");
    }
  }

  if (!normalized.includes("pg_get_constraintdef")) {
    failures.push("Migration must dynamically replace the old unnamed reservation terminal-state check.");
  }

  if (!normalized.includes("reservations_terminal_state_check")) {
    failures.push("Migration must add a named reservations_terminal_state_check constraint.");
  }

  if (!normalized.includes("status = 'expired'") || !normalized.includes("cancellation_reason_code = 'expired'")) {
    failures.push("New terminal-state check must allow expired reservations with reason expired.");
  }

  if (!normalized.includes("update public.reservations") || !normalized.includes("where status = 'expired'")) {
    failures.push("Migration must backfill existing expired reservations.");
  }

  if (!normalized.includes("notify pgrst, 'reload schema'")) {
    failures.push("Migration must notify PostgREST to reload schema.");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Expired reservation note migration static checks passed.");
