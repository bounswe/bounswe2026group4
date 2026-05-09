import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../api";
import {
  listReports,
  resolveReport,
  removeStory,
  removeComment,
  banUser,
  deleteTag,
  resolveReportWithAction,
} from "../adminService";

describe("adminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listReports", () => {
    it("calls the moderation reports endpoint with status and pagination", async () => {
      api.get.mockResolvedValue({ data: { count: 0, results: [] } });
      await listReports({ status: "pending", page: 2, pageSize: 10 });
      expect(api.get).toHaveBeenCalledWith("/moderation/reports/", {
        params: { status: "pending", page: 2, page_size: 10 },
      });
    });

    it("omits status when not provided", async () => {
      api.get.mockResolvedValue({ data: { count: 0, results: [] } });
      await listReports();
      expect(api.get).toHaveBeenCalledWith("/moderation/reports/", {
        params: { page: 1, page_size: 20 },
      });
    });
  });

  it("resolveReport PATCHes with note", async () => {
    api.patch.mockResolvedValue({ data: { id: 1 } });
    await resolveReport(1, "ok");
    expect(api.patch).toHaveBeenCalledWith("/moderation/reports/1/resolve/", {
      resolution_note: "ok",
    });
  });

  it("removeStory DELETEs with reason in body", async () => {
    api.delete.mockResolvedValue({});
    await removeStory(7, "spam");
    expect(api.delete).toHaveBeenCalledWith("/moderation/stories/7/", {
      data: { moderation_reason: "spam" },
    });
  });

  it("removeComment DELETEs the comment", async () => {
    api.delete.mockResolvedValue({});
    await removeComment(3);
    expect(api.delete).toHaveBeenCalledWith("/moderation/comments/3/");
  });

  it("banUser PATCHes the ban endpoint", async () => {
    api.patch.mockResolvedValue({ data: { id: 5, is_active: false } });
    const r = await banUser(5);
    expect(api.patch).toHaveBeenCalledWith("/moderation/users/5/ban/");
    expect(r).toEqual({ id: 5, is_active: false });
  });

  it("deleteTag DELETEs the tag", async () => {
    api.delete.mockResolvedValue({});
    await deleteTag(9);
    expect(api.delete).toHaveBeenCalledWith("/moderation/tags/9/");
  });

  describe("resolveReportWithAction", () => {
    const baseReport = { id: 1, target_type: "story", target_id: 10 };

    it("no_action only resolves the report", async () => {
      api.patch.mockResolvedValue({ data: {} });
      await resolveReportWithAction({ report: baseReport, action: "no_action", note: "n" });
      expect(api.delete).not.toHaveBeenCalled();
      expect(api.patch).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledWith("/moderation/reports/1/resolve/", { resolution_note: "n" });
    });

    it("remove_content removes the story then resolves", async () => {
      api.delete.mockResolvedValue({});
      api.patch.mockResolvedValue({ data: {} });
      await resolveReportWithAction({ report: baseReport, action: "remove_content", note: "bad" });
      expect(api.delete).toHaveBeenCalledWith("/moderation/stories/10/", {
        data: { moderation_reason: "bad" },
      });
      expect(api.patch).toHaveBeenCalledWith("/moderation/reports/1/resolve/", { resolution_note: "bad" });
    });

    it("remove_content on a comment deletes the comment and skips resolve (CASCADE deletes the report)", async () => {
      api.delete.mockResolvedValue({});
      api.patch.mockResolvedValue({ data: {} });
      await resolveReportWithAction({
        report: { id: 2, target_type: "comment", target_id: 33 },
        action: "remove_content",
        note: "n",
      });
      expect(api.delete).toHaveBeenCalledWith("/moderation/comments/33/");
      expect(api.patch).not.toHaveBeenCalled();
    });

    it("ban_user calls the ban endpoint with the supplied target user id", async () => {
      api.patch.mockResolvedValue({ data: {} });
      await resolveReportWithAction({
        report: baseReport,
        action: "ban_user",
        note: "abuse",
        targetUserId: 99,
      });
      expect(api.patch).toHaveBeenNthCalledWith(1, "/moderation/users/99/ban/");
      expect(api.patch).toHaveBeenNthCalledWith(2, "/moderation/reports/1/resolve/", {
        resolution_note: "abuse",
      });
    });
  });
});
