import type { ReportDateRangeInput } from "@/features/reports/domain/report-date-range";
import type { OperationalReportDTO } from "@/features/reports/dto/report-dto";

export interface ReportRepository {
  getOperationalReport(
    dateRange?: ReportDateRangeInput,
    nowIso?: string
  ): Promise<OperationalReportDTO>;
}
