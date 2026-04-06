import { apiClient } from '../../../../core/api/client';
import { UpdateProfileInput } from '../../domain/entities';

interface CurrentUserProfilePayload {
  success?: boolean;
  data?: unknown;
}

function unwrapCurrentUser(payload: CurrentUserProfilePayload | null) {
  if (!payload?.data || typeof payload.data !== 'object') {
    throw new Error('Profile response did not include user data.');
  }

  return payload.data as Record<string, unknown>;
}

function normalizePatchPayload(input: UpdateProfileInput) {
  return {
    username: input.username.trim(),
    is_username_public: input.isUsernamePublic,
    profile: {
      bio: input.bio.trim(),
      location: input.location.trim(),
      birth_date: input.birthDate.trim() || null,
      is_location_public: input.isLocationPublic,
      is_birth_date_public: input.isBirthDatePublic,
      is_photo_public: input.isPhotoPublic,
    },
  };
}

export const profileRemoteSource = {
  async getCurrentProfile() {
    const response = await apiClient.get<CurrentUserProfilePayload>('/users/me/');
    return unwrapCurrentUser(response);
  },

  async getPublicProfile(userId: string) {
    const response = await apiClient.get<Record<string, unknown>>(`/users/${userId}/`);

    if (!response || typeof response !== 'object') {
      throw new Error('Public profile response did not include profile data.');
    }

    return response;
  },

  async updateCurrentProfile(input: UpdateProfileInput) {
    const response = await apiClient.patch<CurrentUserProfilePayload>(
      '/users/me/',
      normalizePatchPayload(input),
    );

    return unwrapCurrentUser(response);
  },
};

export const profileLocalSource = {};
