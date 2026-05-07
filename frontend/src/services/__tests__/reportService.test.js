import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api", () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from "../api";
import { reportContent } from "../reportService";

describe("reportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reportContent", () => {
    it("POSTs to /reports/ with snake_case body and returns response data", async () => {
      const body = { id: 7, status: "pending" };
      api.post.mockResolvedValue({ data: body });

      const result = await reportContent({
        targetType: "story",
        targetId: 42,
        reason: "spam",
        description: "looks fake",
      });

      expect(api.post).toHaveBeenCalledWith("/reports/", {
        target_type: "story",
        target_id: 42,
        reason: "spam",
        description: "looks fake",
      });
      expect(result).toEqual(body);
    });

    it("defaults description to empty string when omitted", async () => {
      api.post.mockResolvedValue({ data: {} });

      await reportContent({
        targetType: "comment",
        targetId: 11,
        reason: "harassment",
      });

      expect(api.post).toHaveBeenCalledWith("/reports/", {
        target_type: "comment",
        target_id: 11,
        reason: "harassment",
        description: "",
      });
    });

    it("propagates API errors", async () => {
      api.post.mockRejectedValue(new Error("Network error"));

      await expect(
        reportContent({ targetType: "story", targetId: 1, reason: "spam" })
      ).rejects.toThrow("Network error");
    });
  });
});
