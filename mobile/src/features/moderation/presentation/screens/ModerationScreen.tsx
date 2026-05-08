import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';
import { EmptyState, ErrorState, Loader, SkeletonCard } from '../../../../shared';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { useAuth } from '../../../auth';
import { useToast } from '../../../../shared/hooks/useToast';
import {
  AdminPage,
  AdminReport,
  AdminReportAction,
  AdminReportStatus,
  AdminStory,
  AdminTag,
  adminService,
} from '../../application/services';

type AdminTab = 'reports' | 'stories' | 'tags';
type AdminService = typeof adminService;
type AdminListItem = AdminReport | AdminStory | AdminTag;

interface ListState<T> {
  items: T[];
  page: number;
  totalCount: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error?: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void>;
}

interface ModerationScreenProps {
  service?: AdminService;
  onOpenStory?: (storyId: string) => void;
  onOpenComment?: (storyId: string, commentId: string) => void;
}

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'reports', label: 'Reports' },
  { key: 'stories', label: 'Stories' },
  { key: 'tags', label: 'Tags' },
];

const reportStatuses: Array<AdminReportStatus | 'all'> = ['all', 'pending', 'resolved'];

function createListState<T>(): ListState<T> {
  return {
    items: [],
    page: 1,
    totalCount: 0,
    hasNextPage: false,
    isLoading: true,
    isRefreshing: false,
    isLoadingMore: false,
  };
}

export function ModerationScreen({ service = adminService, onOpenStory, onOpenComment }: ModerationScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [reportStatus, setReportStatus] = useState<AdminReportStatus | 'all'>('pending');
  const [storyQuery, setStoryQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [reports, setReports] = useState<ListState<AdminReport>>(() => createListState());
  const [stories, setStories] = useState<ListState<AdminStory>>(() => createListState());
  const [tags, setTags] = useState<ListState<AdminTag>>(() => createListState());
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadReports = useCallback(
    async (page = 1, mode: LoadMode = 'initial') => {
      await loadList(setReports, () => service.getReports({ page, status: reportStatus }), page, mode);
    },
    [reportStatus, service],
  );

  const loadStories = useCallback(
    async (page = 1, mode: LoadMode = 'initial') => {
      await loadList(setStories, () => service.getStories({ page, query: storyQuery }), page, mode);
    },
    [service, storyQuery],
  );

  const loadTags = useCallback(
    async (page = 1, mode: LoadMode = 'initial') => {
      await loadList(setTags, () => service.getTags({ page, query: tagQuery }), page, mode);
    },
    [service, tagQuery],
  );

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    if (activeTab === 'reports') {
      void loadReports();
    } else if (activeTab === 'stories') {
      void loadStories();
    } else {
      void loadTags();
    }
  }, [activeTab, isAdmin, loadReports, loadStories, loadTags]);

  const reloadActiveTab = useCallback(async () => {
    if (activeTab === 'reports') {
      await loadReports(1, 'refresh');
    } else if (activeTab === 'stories') {
      await loadStories(1, 'refresh');
    } else {
      await loadTags(1, 'refresh');
    }
  }, [activeTab, loadReports, loadStories, loadTags]);

  const runConfirmedAction = useCallback(
    (state: ConfirmState) => {
      setConfirmState(state);
    },
    [],
  );

  const resolveReport = useCallback(
    async (report: AdminReport, action: AdminReportAction) => {
      setPendingActionId(`${report.id}:${action}`);
      try {
        const updatedReport = await service.resolveReport(report.id, action);
        setReports((current) => ({
          ...current,
          items: current.items.map((item) => (item.id === report.id ? updatedReport : item)),
        }));
        toast.success('Report resolved.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to resolve report.');
      } finally {
        setPendingActionId(null);
      }
    },
    [service, toast],
  );

  const confirmStoryRemoval = useCallback(
    (story: AdminStory) => {
      runConfirmedAction({
        title: 'Remove story?',
        message: `"${story.title}" will be removed from public views.`,
        confirmLabel: 'Remove story',
        destructive: true,
        reasonLabel: 'Removal reason',
        reasonPlaceholder: 'Explain why this story is being removed',
        onConfirm: async (reason) => {
          if (!reason.trim()) {
            throw new Error('A removal reason is required.');
          }

          setPendingActionId(story.id);
          await service.removeStory(story.id, reason.trim());
          setStories((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== story.id),
            totalCount: Math.max(current.totalCount - 1, 0),
          }));
          toast.success('Story removed.');
          setPendingActionId(null);
        },
      });
    },
    [runConfirmedAction, service, toast],
  );

  const confirmTagRemoval = useCallback(
    (tag: AdminTag) => {
      runConfirmedAction({
        title: 'Remove tag?',
        message: `${tag.name} will be removed from associated stories.`,
        confirmLabel: 'Remove tag',
        destructive: true,
        onConfirm: async () => {
          setPendingActionId(tag.id);
          await service.removeTag(tag.id);
          setTags((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== tag.id),
            totalCount: Math.max(current.totalCount - 1, 0),
          }));
          toast.success('Tag removed.');
          setPendingActionId(null);
        },
      });
    },
    [runConfirmedAction, service, toast],
  );

  const activeState = useMemo(() => {
    if (activeTab === 'reports') {
      return reports;
    }

    if (activeTab === 'stories') {
      return stories;
    }

    return tags;
  }, [activeTab, reports, stories, tags]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.background }}>
        <ErrorState
          title="Not authorized"
          message="Only admins can access moderation tools."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
          Admin moderation
        </Text>
        <Text style={{ color: colors.muted }}>
          Review reports, moderate stories, and clean up tags.
        </Text>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            padding: 3,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.infoSurface,
          }}
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label} tab`}
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderRadius: 9,
                  backgroundColor: selected ? colors.primary : 'transparent',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: selected ? colors.background : colors.text,
                    fontSize: typography.caption,
                    fontWeight: '800',
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {renderControls({
          activeTab,
          reportStatus,
          setReportStatus,
          storyQuery,
          setStoryQuery,
          tagQuery,
          setTagQuery,
          reloadActiveTab,
        })}
      </View>
      <View style={{ flex: 1, paddingTop: spacing.md }}>
        {renderContent({
          activeTab,
          activeState,
          reports,
          stories,
          tags,
          pendingActionId,
          onRetry: reloadActiveTab,
          onLoadMore: () => {
            if (activeTab === 'reports') {
              void loadReports(reports.page + 1, 'append');
            } else if (activeTab === 'stories') {
              void loadStories(stories.page + 1, 'append');
            } else {
              void loadTags(tags.page + 1, 'append');
            }
          },
          onRefresh: reloadActiveTab,
          onResolveReport: resolveReport,
          onRemoveStory: confirmStoryRemoval,
          onRemoveTag: confirmTagRemoval,
          onOpenStory,
          onOpenComment,
        })}
      </View>
      <ConfirmActionDialog
        state={confirmState}
        onClose={() => {
          setConfirmState(null);
          setPendingActionId(null);
        }}
      />
    </View>
  );
}

type LoadMode = 'initial' | 'refresh' | 'append';

async function loadList<T>(
  setState: React.Dispatch<React.SetStateAction<ListState<T>>>,
  fetchPage: () => Promise<AdminPage<T>>,
  page: number,
  mode: LoadMode,
) {
  setState((current) => ({
    ...current,
    isLoading: mode === 'initial',
    isRefreshing: mode === 'refresh',
    isLoadingMore: mode === 'append',
    error: undefined,
  }));

  try {
    const response = await fetchPage();

    setState((current) => ({
      items: mode === 'append' ? [...current.items, ...response.items] : response.items,
      page: response.page,
      totalCount: response.totalCount,
      hasNextPage: response.hasNextPage,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: undefined,
    }));
  } catch (error) {
    setState((current) => ({
      ...current,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: error instanceof Error ? error.message : 'Unable to load moderation data.',
    }));
  }
}

function renderControls({
  activeTab,
  reportStatus,
  setReportStatus,
  storyQuery,
  setStoryQuery,
  tagQuery,
  setTagQuery,
  reloadActiveTab,
}: {
  activeTab: AdminTab;
  reportStatus: AdminReportStatus | 'all';
  setReportStatus: (value: AdminReportStatus | 'all') => void;
  storyQuery: string;
  setStoryQuery: (value: string) => void;
  tagQuery: string;
  setTagQuery: (value: string) => void;
  reloadActiveTab: () => Promise<void>;
}) {
  if (activeTab === 'reports') {
    return (
      <FilterPills
        label="Report status"
        options={reportStatuses.map((status) => ({ value: status, label: titleCase(status) }))}
        value={reportStatus}
        onChange={setReportStatus}
      />
    );
  }

  const query = activeTab === 'stories' ? storyQuery : tagQuery;
  const setQuery = activeTab === 'stories' ? setStoryQuery : setTagQuery;
  const label = activeTab === 'stories' ? 'Search stories' : 'Search tags';

  return (
    <Input
      value={query}
      onChangeText={setQuery}
      placeholder={label}
      accessibilityLabel={label}
      returnKeyType="search"
      onSubmitEditing={() => {
        void reloadActiveTab();
      }}
      trailingActionLabel="Search"
      trailingActionAccessibilityLabel={`Apply ${label.toLowerCase()}`}
      onTrailingActionPress={() => {
        void reloadActiveTab();
      }}
    />
  );
}

function renderContent({
  activeTab,
  activeState,
  reports,
  stories,
  tags,
  pendingActionId,
  onRetry,
  onLoadMore,
  onRefresh,
  onResolveReport,
  onRemoveStory,
  onRemoveTag,
  onOpenStory,
  onOpenComment,
}: {
  activeTab: AdminTab;
  activeState: ListState<unknown>;
  reports: ListState<AdminReport>;
  stories: ListState<AdminStory>;
  tags: ListState<AdminTag>;
  pendingActionId: string | null;
  onRetry: () => Promise<void>;
  onLoadMore: () => void;
  onRefresh: () => Promise<void>;
  onResolveReport: (report: AdminReport, action: AdminReportAction) => Promise<void>;
  onRemoveStory: (story: AdminStory) => void;
  onRemoveTag: (tag: AdminTag) => void;
  onOpenStory?: (storyId: string) => void;
  onOpenComment?: (storyId: string, commentId: string) => void;
}) {
  if (activeState.isLoading && !activeState.items.length) {
    return (
      <View accessibilityLabel="Loading admin data" style={{ paddingHorizontal: 16, gap: 12 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} showMedia={false} />
        ))}
      </View>
    );
  }

  if (activeState.error && !activeState.items.length) {
    return (
      <ErrorState
        title="Moderation unavailable"
        message={activeState.error}
        retryLabel="Try again"
        onRetry={() => {
          void onRetry();
        }}
      />
    );
  }

  if (!activeState.items.length) {
    return (
      <EmptyState
        title={`No ${activeTab} found`}
        message="There is nothing to review here right now."
        actionLabel="Refresh"
        onAction={() => {
          void onRefresh();
        }}
      />
    );
  }

  const data: AdminListItem[] =
    activeTab === 'reports'
      ? reports.items
      : activeTab === 'stories'
        ? stories.items
        : tags.items;

  return (
    <FlatList<AdminListItem>
      testID={`admin-${activeTab}-list`}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={activeState.isRefreshing}
      onRefresh={() => {
        void onRefresh();
      }}
      renderItem={({ item }) => {
        if (activeTab === 'reports') {
          return (
            <ReportRow
              report={item as AdminReport}
              pendingActionId={pendingActionId}
              onResolve={onResolveReport}
              onOpenStory={onOpenStory}
              onOpenComment={onOpenComment}
            />
          );
        }

        if (activeTab === 'stories') {
          return (
            <StoryRow
              story={item as AdminStory}
              isPending={pendingActionId === item.id}
              onRemove={onRemoveStory}
              onOpenStory={onOpenStory}
            />
          );
        }

        return (
          <TagRow
            tag={item as AdminTag}
            isPending={pendingActionId === item.id}
            onRemove={onRemoveTag}
          />
        );
      }}
      ListHeaderComponent={<ListSummary count={activeState.totalCount} label={activeTab} />}
      ListFooterComponent={
        activeState.isLoadingMore ? (
          <Loader message="Loading more..." size="small" />
        ) : activeState.hasNextPage ? (
          <View style={{ paddingTop: 16 }}>
            <Button variant="outline" onPress={onLoadMore} accessibilityLabel={`Load more ${activeTab}`}>
              Load more
            </Button>
          </View>
        ) : null
      }
    />
  );
}

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : colors.background,
            }}
          >
            <Text style={{ color: selected ? colors.background : colors.text, fontSize: typography.caption, fontWeight: '700' }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ListSummary({ count, label }: { count: number; label: string }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Text style={{ color: colors.muted, fontSize: typography.caption, marginBottom: spacing.sm }}>
      {count} {label}
    </Text>
  );
}

function RowFrame({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, spacing } = useAppTheme();
  const content = (
    <View
      style={{
        padding: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        backgroundColor: colors.surface,
      }}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}

function ReportRow({
  report,
  pendingActionId,
  onResolve,
  onOpenStory,
  onOpenComment,
}: {
  report: AdminReport;
  pendingActionId: string | null;
  onResolve: (report: AdminReport, action: AdminReportAction) => Promise<void>;
  onOpenStory?: (storyId: string) => void;
  onOpenComment?: (storyId: string, commentId: string) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();
  const isResolved = report.status !== 'pending';
  const canOpenStory = report.targetType === 'story' && Boolean(onOpenStory);
  const canOpenComment = report.targetType === 'comment' && Boolean(report.targetStoryId) && Boolean(onOpenComment);

  return (
    <RowFrame
      onPress={
        canOpenComment
          ? () => onOpenComment?.(report.targetStoryId!, report.targetId)
          : canOpenStory
            ? () => onOpenStory?.(report.targetId)
            : undefined
      }
      accessibilityLabel={
        canOpenComment
          ? `Open reported comment ${report.targetId}`
          : canOpenStory
            ? `Open reported story ${report.targetId}`
            : undefined
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={{ flex: 1, color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
          {report.targetType} #{report.targetId}
        </Text>
        <StatusBadge label={report.status} tone={isResolved ? 'success' : 'danger'} />
      </View>
      <Text style={{ color: colors.muted }}>Reporter: {report.reporter.username}</Text>
      <Text style={{ color: colors.text }}>Reason: {titleCase(report.reason)}</Text>
      <Text style={{ color: colors.muted }}>Date: {formatDate(report.createdAt)}</Text>
      {report.description ? <Text style={{ color: colors.text }}>{report.description}</Text> : null}
      {canOpenComment || canOpenStory ? (
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          {canOpenComment ? 'Tap to open comment' : 'Tap to open story'}
        </Text>
      ) : null}
      {!isResolved ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            variant="outline"
            disabled={Boolean(pendingActionId)}
            onPress={() => void onResolve(report, 'no_action')}
            accessibilityLabel={`Resolve report ${report.id} with no action`}
          >
            No action
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(pendingActionId)}
            onPress={() => void onResolve(report, 'remove_content')}
            accessibilityLabel={`Resolve report ${report.id} and remove content`}
          >
            Remove
          </Button>
          <Button
            disabled={Boolean(pendingActionId)}
            onPress={() => void onResolve(report, 'ban_user')}
            accessibilityLabel={`Resolve report ${report.id} and ban user`}
          >
            Ban user
          </Button>
        </View>
      ) : null}
    </RowFrame>
  );
}

function StoryRow({
  story,
  isPending,
  onRemove,
  onOpenStory,
}: {
  story: AdminStory;
  isPending: boolean;
  onRemove: (story: AdminStory) => void;
  onOpenStory?: (storyId: string) => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <RowFrame
      onPress={onOpenStory ? () => onOpenStory(story.id) : undefined}
      accessibilityLabel={`Open story ${story.title}`}
    >
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{story.title}</Text>
      <Text style={{ color: colors.muted }}>{story.contributorName ?? 'Anonymous'} - {story.locationName ?? 'Unknown place'}</Text>
      <Text style={{ color: colors.muted }}>Status: {story.status ?? 'unknown'} - {formatDate(story.submittedAt)}</Text>
      {onOpenStory ? <Text style={{ color: colors.primary, fontWeight: '700' }}>Tap to open story</Text> : null}
      <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
        <Button
          variant="outline"
          disabled={isPending}
          onPress={() => onRemove(story)}
          accessibilityLabel={`Remove story ${story.title}`}
        >
          Remove
        </Button>
      </View>
    </RowFrame>
  );
}

function TagRow({ tag, isPending, onRemove }: { tag: AdminTag; isPending: boolean; onRemove: (tag: AdminTag) => void }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <RowFrame>
      <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>{tag.name}</Text>
      <Text style={{ color: colors.muted }}>{tag.storyCount} stories</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
        <Button
          variant="outline"
          disabled={isPending}
          onPress={() => onRemove(tag)}
          accessibilityLabel={`Remove tag ${tag.name}`}
        >
          Remove
        </Button>
      </View>
    </RowFrame>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'danger' }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 999,
        backgroundColor: tone === 'success' ? colors.successSurface : colors.dangerSurface,
      }}
    >
      <Text style={{ color: tone === 'success' ? colors.success : colors.danger, fontSize: typography.caption, fontWeight: '800' }}>
        {titleCase(label)}
      </Text>
    </View>
  );
}

function ConfirmActionDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (state) {
      setReason('');
      setIsSubmitting(false);
    }
  }, [state]);

  if (!state) {
    return null;
  }

  const confirm = async () => {
    setIsSubmitting(true);
    try {
      await state.onConfirm(reason);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
          backgroundColor: 'rgba(0,0,0,0.28)',
        }}
      >
        <View
          accessibilityRole="alert"
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
            {state.title}
          </Text>
          <Text style={{ color: colors.muted }}>{state.message}</Text>
          {state.reasonLabel ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{state.reasonLabel}</Text>
              <Input
                value={reason}
                onChangeText={setReason}
                placeholder={state.reasonPlaceholder}
                accessibilityLabel={state.reasonLabel}
                multiline
                numberOfLines={3}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
            <Button variant="ghost" disabled={isSubmitting} onPress={onClose}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} onPress={() => void confirm()}>
              {state.confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}
