import { ReportReason } from './ReportReason';

export type ReportTargetType = 'story' | 'comment';

export interface ReportEntity {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status?: string;
  createdAt?: string;
}

export interface ReportContentInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export * from './ReportReason';
