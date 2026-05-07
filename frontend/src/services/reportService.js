import api from "./api";

export async function reportContent({ targetType, targetId, reason, description = "" }) {
  const response = await api.post("/reports/", {
    target_type: targetType,
    target_id: targetId,
    reason,
    description,
  });
  return response.data;
}
