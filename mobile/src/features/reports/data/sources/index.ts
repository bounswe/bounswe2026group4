import { apiClient } from '../../../../core/api/client';
import { ReportContentInput } from '../../domain/entities';

function getTargetIdPayload(targetId: string) {
  const parsed = Number(targetId);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : targetId;
}

export const reportsRemoteSource = {
  async reportContent(input: ReportContentInput) {
    return apiClient.post('/reports/', {
      target_type: input.targetType,
      target_id: getTargetIdPayload(input.targetId),
      reason: input.reason,
      description: input.description?.trim() ?? '',
    });
  },
};

export const reportsLocalSource = {};
