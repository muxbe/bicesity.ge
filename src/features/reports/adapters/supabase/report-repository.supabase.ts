import { AdapterError } from "@/features/shared/domain/errors";
import { getAuthHeaders } from "@/lib/auth/request-headers";
import type { ReportDateRangeInput } from "@/features/reports/domain/report-date-range";
import type { OperationalReportDTO } from "@/features/reports/dto/report-dto";
import type { ReportRepository } from "@/features/reports/repositories/report-repository";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

function reportErrorMessage(payload: ApiResponse<unknown> | null, fallback: string) {
  const message = payload?.error ?? fallback;
  const details = payload?.details;
  if (
    details &&
    typeof details === "object" &&
    "message" in details &&
    typeof details.message === "string"
  ) {
    return `${message} ${details.message}`;
  }
  return message;
}

export function createSupabaseReportRepository(): ReportRepository {
  return {
    async getOperationalReport(
      dateRange?: ReportDateRangeInput,
      nowIso?: string
    ): Promise<OperationalReportDTO> {
      const searchParams = new URLSearchParams();
      if (dateRange?.startDate) {
        searchParams.set("startDate", dateRange.startDate);
      }
      if (dateRange?.endDate) {
        searchParams.set("endDate", dateRange.endDate);
      }
      if (nowIso) {
        searchParams.set("nowIso", nowIso);
      }
      const response = await fetch(
        `/api/reports${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
        {
          method: "GET",
          headers: await getAuthHeaders("admin"),
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | ApiResponse<OperationalReportDTO>
        | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(
          reportErrorMessage(payload, "Failed to load report."),
          payload?.details
        );
      }

      return payload.data;
    },
  };
}
