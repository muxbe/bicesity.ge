import type { ReservationSource } from "@/features/reservations/dto/reservation-dto";

type ParsedReservationCommentContext = {
  sellerComment: string;
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: ReservationSource | null;
};

const reservationSources = new Set<ReservationSource>([
  "manual",
  "messenger",
  "phone",
  "walk_in",
  "other",
]);

function normalizeReservationSource(value: string): ReservationSource | null {
  const source = value.trim().toLowerCase().replace(/[\s-]+/g, "_") as ReservationSource;
  return reservationSources.has(source) ? source : null;
}

export function parseReservationCommentContext(
  rawComment: string | null | undefined
): ParsedReservationCommentContext {
  const comment = rawComment ?? "";
  if (!comment.trim()) {
    return {
      sellerComment: "",
      customerName: "",
      customerPhone: "",
      messengerProfileUrl: "",
      reservationSource: null,
    };
  }

  const visibleCommentLines: string[] = [];
  let isReadingContext = false;
  let customerName = "";
  let customerPhone = "";
  let messengerProfileUrl = "";
  let reservationSource: ReservationSource | null = null;

  for (const line of comment.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!isReadingContext && /^customer details:$/i.test(trimmedLine)) {
      isReadingContext = true;
      continue;
    }

    if (!isReadingContext) {
      visibleCommentLines.push(line);
      continue;
    }

    const contextMatch = trimmedLine.match(/^(customer|phone|messenger|source):\s*(.*)$/i);
    if (!contextMatch) {
      if (trimmedLine) {
        visibleCommentLines.push(line);
      }
      continue;
    }

    const [, key, rawValue] = contextMatch;
    const value = rawValue.trim();
    if (!value) {
      continue;
    }

    switch (key.toLowerCase()) {
      case "customer":
        customerName ||= value;
        break;
      case "phone":
        customerPhone ||= value;
        break;
      case "messenger":
        messengerProfileUrl ||= value;
        break;
      case "source":
        reservationSource ||= normalizeReservationSource(value);
        break;
      default:
        break;
    }
  }

  return {
    sellerComment: visibleCommentLines.join("\n").trim(),
    customerName,
    customerPhone,
    messengerProfileUrl,
    reservationSource,
  };
}
