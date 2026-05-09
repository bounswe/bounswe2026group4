import api from "./api";

const PAGE_SIZE = 20;

/** GET /moderation/reports/?status=&page= — paginated, IsAdminUser. */
export async function listReports({ status, page = 1, pageSize = PAGE_SIZE } = {}) {
  const params = { page, page_size: pageSize };
  if (status) params.status = status;
  const response = await api.get("/moderation/reports/", { params });
  return response.data; // { count, next, previous, results }
}

/** PATCH /moderation/reports/<id>/resolve/ — resolution_note string. */
export async function resolveReport(reportId, resolutionNote = "") {
  const response = await api.patch(`/moderation/reports/${reportId}/resolve/`, {
    resolution_note: resolutionNote,
  });
  return response.data;
}

/** DELETE /moderation/stories/<id>/ — body { moderation_reason }. */
export async function removeStory(storyId, moderationReason) {
  await api.delete(`/moderation/stories/${storyId}/`, {
    data: { moderation_reason: moderationReason },
  });
}

/** DELETE /moderation/comments/<id>/ — hard-delete a comment. */
export async function removeComment(commentId) {
  await api.delete(`/moderation/comments/${commentId}/`);
}

/** PATCH /moderation/users/<id>/ban/ — disables a user account. */
export async function banUser(userId) {
  const response = await api.patch(`/moderation/users/${userId}/ban/`);
  return response.data; // { id, email, username, role, is_active }
}

/** DELETE /moderation/tags/<id>/ — remove tag and all associations. */
export async function deleteTag(tagId) {
  await api.delete(`/moderation/tags/${tagId}/`);
}

/**
 * Resolve a report and optionally apply a side action.
 *
 * Outcomes:
 *  - "no_action": just record the note + mark resolved.
 *  - "remove_content": delete story/comment, then resolve.
 *  - "ban_user": ban the targetUserId (caller-supplied), then resolve.
 */
export async function resolveReportWithAction({ report, action, note, targetUserId }) {
  if (action === "remove_content") {
    if (report.target_type === "story") {
      await removeStory(report.target_id, note || "Removed via admin moderation.");
    } else if (report.target_type === "comment") {
      // Report.comment FK is ON DELETE CASCADE in the backend, so deleting
      // the comment also removes the report row. A follow-up resolve PATCH
      // would 404 — skip it.
      await removeComment(report.target_id);
      return null;
    }
  } else if (action === "ban_user" && targetUserId) {
    await banUser(targetUserId);
  }
  return resolveReport(report.id, note);
}
