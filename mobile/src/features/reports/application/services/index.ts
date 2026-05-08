import { ReportRepositoryImpl } from '../../data/repositories';
import { ReportContentInput, ReportEntity } from '../../domain/entities';

const repository = new ReportRepositoryImpl();

export const reportService = {
  async reportContent(input: ReportContentInput): Promise<ReportEntity> {
    return repository.reportContent(input);
  },
};

export const reportsService = reportService;
