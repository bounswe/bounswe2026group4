import api from "./api";

/** GET /users/<id>/ — public profile, visibility-filtered by server */
export async function getPublicProfile(userId) {
  const response = await api.get(`/users/${userId}/`);
  return response.data;
}

/** Alias kept for callers that use the old name */
export const getProfile = getPublicProfile;

/** GET /users/me/ — authenticated user's own full profile (includes privacy flags) */
export async function getOwnProfile() {
  const response = await api.get("/users/me/");
  return response.data.data;
}

/**
 * PATCH /users/me/ — update username, visibility, and nested profile fields.
 *
 * @param {object} userFields  Top-level user fields: { username, is_username_public }
 * @param {object} profileFields  Profile sub-fields: { location, bio, birth_date,
 *   is_location_public, is_birth_date_public, is_photo_public, is_name_public,
 *   first_name, last_name }
 */
export async function updateProfile(userFields = {}, profileFields = {}) {
  const body = { ...userFields };
  if (Object.keys(profileFields).length > 0) {
    body.profile = profileFields;
  }
  const response = await api.patch("/users/me/", body);
  return response.data;
}

/** POST /users/me/photo/ — upload profile photo as multipart/form-data */
export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const response = await api.post("/users/me/photo/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

/** DELETE /users/me/photo/ — remove profile photo */
export async function removeProfilePhoto() {
  await api.delete("/users/me/photo/");
}

/**
 * Convenience wrapper used by ProfileCompletionPage: patch profile fields then
 * optionally upload a photo in a single call.
 */
export async function updateCurrentUser({ profile = {}, userFields = {}, profilePhoto }) {
  const response = await api.patch("/users/me/", { ...userFields, profile });
  if (profilePhoto) {
    await uploadProfilePhoto(profilePhoto);
  }
  return response.data;
}

/**
 * GET /users/<id>/badges/ — public list of badges awarded to a user.
 *
 * The backend paginates the response (StoryPagination, default 10 per page),
 * so we walk `next` until exhausted. Per-user badge counts are bounded
 * (max ~10–20 in the current catalog), so loading all in one render is fine.
 */
export async function getUserBadges(userId) {
  const allResults = [];
  // First page asks for a large page so the typical user finishes in one round-trip.
  let response = await api.get(`/users/${userId}/badges/`, {
    params: { page_size: 100 },
  });
  while (response) {
    const { results = [], next = null } = response.data ?? {};
    allResults.push(...results);
    response = next ? await api.get(next) : null;
  }
  return allResults;
}
