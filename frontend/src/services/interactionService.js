import api from "./api";

/**
 * Fetch all comments for a story.
 * The backend returns oldest-first; callers are responsible for reversing if needed.
 * @returns {Promise<Array>} Array of comment objects
 */
export async function getComments(storyId) {
  const response = await api.get(`/stories/${storyId}/comments/`, {
    params: { page_size: 100 },
  });
  return response.data.results;
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
