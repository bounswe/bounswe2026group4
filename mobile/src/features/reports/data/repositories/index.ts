import { mapReport } from '../mappers';
import { reportsRemoteSource } from '../sources';
import { ReportContentInput, ReportEntity } from '../../domain/entities';
import { ReportRepository } from '../../domain/repositories';

export class ReportRepositoryImpl implements ReportRepository {
  async reportContent(input: ReportContentInput): Promise<ReportEntity> {
    return mapReport(await reportsRemoteSource.reportContent(input));
  }
}
