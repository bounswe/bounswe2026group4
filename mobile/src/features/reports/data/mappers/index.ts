import { ReportEntity, ReportReason, ReportTargetType } from '../../domain/entities';

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
}

function isReportReason(value: unknown): value is ReportReason {
  return (
    value === 'spam' ||
    value === 'false_content' ||
    value === 'harassment' ||
    value === 'privacy_violation' ||
    value === 'explicit_media' ||
    value === 'other'
  );
}

function isReportTargetType(value: unknown): value is ReportTargetType {
  return value === 'story' || value === 'comment';
}

export function mapReport(value: unknown): ReportEntity {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid report payload.');
  }

  const report = value as Record<string, unknown>;
  const id = asString(report.id);
  const targetType = isReportTargetType(report.target_type) ? report.target_type : undefined;
  const targetId = asString(report.target_id);
  const reason = isReportReason(report.reason) ? report.reason : undefined;

  if (!id || !targetType || !targetId || !reason) {
    throw new Error('Invalid report payload.');
  }

  return {
    id,
    targetType,
    targetId,
    reason,
    status: asString(report.status) || undefined,
    createdAt: asString(report.created_at) || undefined,
  };
}
