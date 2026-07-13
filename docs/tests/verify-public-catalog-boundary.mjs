import { failIfAny, pathExists, readText } from "./structure-test-helpers.mjs";

const failures = [];

function requireFile(relativePath, message) {
  if (!pathExists(relativePath)) {
    failures.push(`${relativePath}: ${message}`);
    return null;
  }
  return readText(relativePath);
}

const publicDto = requireFile(
  "src/features/catalog/dto/public-product-dto.ts",
  "a dedicated customer DTO is required"
);
if (publicDto) {
  if (!/export\s+type\s+PublicProductDTO/.test(publicDto)) {
    failures.push("PublicProductDTO must be explicitly exported.");
  }
  if (!/\brating\??\s*:/.test(publicDto)) {
    failures.push("PublicProductDTO must support administrator-controlled rating visibility.");
  }
  for (const forbidden of [
    "discountReason",
    "reservedForAt",
    "sellerComment",
    "auditNote",
    "actorUserId",
  ]) {
    if (publicDto.includes(forbidden)) {
      failures.push(`PublicProductDTO must not declare staff-only ${forbidden}.`);
    }
  }
}

const publicMapper = requireFile(
  "src/app/api/shop/public-product-mapper.ts",
  "an explicit server-side public mapper is required"
);
if (publicMapper) {
  if (!/PublicProductDTO/.test(publicMapper)) {
    failures.push("The public mapper must return PublicProductDTO.");
  }
  if (/\.\.\.\s*product\b/.test(publicMapper)) {
    failures.push("The public mapper must not spread the internal product object.");
  }
  if (!/isPublic|coreVisibility|publicLayout/.test(publicMapper)) {
    failures.push("The public mapper must apply persisted visibility rules.");
  }
}

const bootstrap = requireFile(
  "src/app/api/shop/bootstrap/route.ts",
  "the authenticated customer bootstrap route is required"
);
if (bootstrap) {
  if (!/getRequestAuth|requireAuthenticated/.test(bootstrap) || !/status:\s*401/.test(bootstrap)) {
    failures.push("Shop bootstrap must reject missing or invalid authentication with 401.");
  }
  if (!/PublicProductDTO|publicProduct|listPublic/.test(bootstrap)) {
    failures.push("Shop bootstrap must use the explicit public product path.");
  }
}

const detail = requireFile(
  "src/app/api/shop/products/[id]/route.ts",
  "a dedicated authenticated customer detail route is required"
);
if (detail) {
  if (!/getRequestAuth|requireAuthenticated/.test(detail) || !/status:\s*401/.test(detail)) {
    failures.push("Customer product detail must reject anonymous requests with 401.");
  }
  if (!/PublicProductDTO|publicProduct|getPublic/.test(detail)) {
    failures.push("Customer product detail must use the explicit public product path.");
  }
}

for (const catalogRoute of ["src/app/api/catalog/route.ts", "src/app/api/catalog/[id]/route.ts"]) {
  const source = requireFile(catalogRoute, "the staff catalog route is required");
  if (source && !/requireStaff|getRequestStaffRole|requireCatalogStaff/.test(source)) {
    failures.push(`${catalogRoute}: full ProductDTO reads must require verified staff.`);
  }
}

const fieldLayout = requireFile(
  "src/features/fields/field-layout.ts",
  "the configurable core-field layout is required"
);
if (fieldLayout && !/\|\s*["']rating["']|key:\s*["']rating["']/.test(fieldLayout)) {
  failures.push("Core field layout must include administrator-controlled rating visibility.");
}

failIfAny(failures, "Public catalog boundary checks passed.");
