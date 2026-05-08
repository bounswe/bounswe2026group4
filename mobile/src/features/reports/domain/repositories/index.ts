import { ReportContentInput, ReportEntity } from '../entities';

export interface ReportRepository {
  reportContent(input: ReportContentInput): Promise<ReportEntity>;
}
