import { apiClient } from '../../../../core/api/client';
import { ProfilePhotoUploadInput, UpdateProfileInput } from '../../domain/entities';

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

  async uploadProfilePhoto(input: ProfilePhotoUploadInput) {
    const formData = new FormData();

    formData.append('photo', {
      uri: input.uri,
      name: input.fileName,
      type: input.mimeType,
    } as unknown as Blob);

    const response = await apiClient.post<Record<string, unknown>>('/users/me/photo/', formData);

    if (!response || typeof response !== 'object') {
      throw new Error('Profile photo upload did not return a response.');
    }

    return response;
  },

  async removeProfilePhoto() {
    await apiClient.delete<void>('/users/me/photo/');
  },

  async deleteAccount(password: string, hardDelete = true) {
    await apiClient.delete<void>('/users/me/', {
      data: {
        password,
        hard_delete: hardDelete,
      },
    });
  },
};

export const profileLocalSource = {};
