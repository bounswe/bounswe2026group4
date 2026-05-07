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
  const payload: Record<string, unknown> = {};
  const profile: Record<string, unknown> = {};

  if (input.username !== undefined) {
    payload.username = input.username.trim();
  }

  if (input.isUsernamePublic !== undefined) {
    payload.is_username_public = input.isUsernamePublic;
  }

  if (input.firstName !== undefined) {
    profile.first_name = input.firstName.trim();
  }

  if (input.lastName !== undefined) {
    profile.last_name = input.lastName.trim();
  }

  if (input.bio !== undefined) {
    profile.bio = input.bio.trim();
  }

  if (input.location !== undefined) {
    profile.location = input.location.trim();
  }

  if (input.birthDate !== undefined) {
    profile.birth_date = input.birthDate?.trim() ? input.birthDate.trim() : null;
  }

  if (input.isNamePublic !== undefined) {
    profile.is_name_public = input.isNamePublic;
  }

  if (input.isLocationPublic !== undefined) {
    profile.is_location_public = input.isLocationPublic;
  }

  if (input.isBirthDatePublic !== undefined) {
    profile.is_birth_date_public = input.isBirthDatePublic;
  }

  if (input.isPhotoPublic !== undefined) {
    profile.is_photo_public = input.isPhotoPublic;
  }

  if (Object.keys(profile).length > 0) {
    payload.profile = profile;
  }

  return payload;
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

  async followUser(userId: string) {
    await apiClient.post(`/users/${userId}/follow/`);
  },

  async unfollowUser(userId: string) {
    await apiClient.delete<void>(`/users/${userId}/follow/`);
  },

  async getFollowers(userId: string, page = 1) {
    return (await apiClient.get<Record<string, unknown>>(
      `/users/${userId}/followers/${buildQueryString({ page, page_size: 20 })}`,
    )) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  },

  async getFollowing(userId: string, page = 1) {
    return (await apiClient.get<Record<string, unknown>>(
      `/users/${userId}/following/${buildQueryString({ page, page_size: 20 })}`,
    )) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  },

  async getSavedStories(userId: string, page = 1) {
    return (await apiClient.get<Record<string, unknown>>(
      `/users/${userId}/bookmarks/${buildQueryString({ page, page_size: 10 })}`,
    )) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  },

  async getUserStories(userId: string, page = 1) {
    return (await apiClient.get<Record<string, unknown>>(
      `/users/${userId}/stories/${buildQueryString({ page, page_size: 10 })}`,
    )) ?? {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  },
};

export const profileLocalSource = {};

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : '';
}
