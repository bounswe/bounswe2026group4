import api from "./api";

/**
 * Fetch all comments for a story, following pagination until exhausted.
 * The backend returns oldest-first; callers are responsible for reversing if needed.
 * @returns {Promise<Array>} Array of comment objects
 */
export async function getComments(storyId) {
  const allResults = [];
  // Start with the relative path; subsequent pages use the absolute `next` URL from the response.
  let nextUrl = `/stories/${storyId}/comments/`;
  let isFirstPage = true;

  while (nextUrl) {
    const response = isFirstPage
      ? await api.get(nextUrl, { params: { page_size: 100 } })
      : await api.get(nextUrl);
    isFirstPage = false;

    const data = response.data;
    // Defensive: handle both paginated ({ results: [...] }) and flat-array responses.
    const results = data.results ?? data;
    if (Array.isArray(results)) {
      allResults.push(...results);
    }
    nextUrl = data.next ?? null;
  }

  return allResults;
}

/**
 * Post a new comment on a story.
 * @returns {Promise<Object>} The created comment object
 */
export async function addComment(storyId, text) {
  const response = await api.post(`/stories/${storyId}/comments/`, { text });
  return response.data.comment;
}

/**
 * Delete a comment by id.
 * Note: intentionally uses /comments/{id}/ (not /stories/{storyId}/comments/{id}/)
 * — this matches the backend URL structure for comment deletion.
 */
export async function deleteComment(commentId) {
  await api.delete(`/comments/${commentId}/`);
}

/**
 * Like a story. Throws if the user has already liked it.
 */
export async function likeStory(storyId) {
  const response = await api.post(`/stories/${storyId}/like/`);
  return response.data;
}

/**
 * Remove the current user's like from a story.
 */
export async function unlikeStory(storyId) {
  await api.delete(`/stories/${storyId}/like/`);
}
