from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stories.serializers import StoryFeedSerializer
from apps.stories.views import annotate_user_interactions
from apps.users.serializers import (
    CurrentUserSerializer,
    DeleteAccountSerializer,
    FollowUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    ProfilePhotoSerializer,
    PublicUserProfileSerializer,
    RegisterSerializer,
    UpdateCurrentUserSerializer,
    UserResponseSerializer,
)
from apps.users.services import (
    delete_account,
    delete_profile_photo,
    follow_user,
    get_own_profile,
    get_public_profile,
    get_user_bookmarks,
    login_user,
    logout_user,
    register_user,
    unfollow_user,
    update_own_profile,
    upload_profile_photo,
)
from common.pagination import StoryPagination
from common.permissions import IsRegisteredUser


class RegisterView(APIView):
    # Anyone can register — no prior authentication required
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = register_user(serializer.validated_data)
        return Response(
            {
                'message': 'Registration successful. Please verify your email.',
                'user': UserResponseSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = login_user(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        return Response(result, status=status.HTTP_200_OK)


class LogoutView(APIView):
    # Must be authenticated so anonymous requests cannot abuse the blacklist endpoint
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        logout_user(serializer.validated_data['refresh'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    """GET and PATCH /users/me/ — authenticated user's own full profile."""

    permission_classes = [IsRegisteredUser]

    def get(self, request):
        user = get_own_profile(request.user)
        serializer = CurrentUserSerializer(user, context={'request': request})
        return Response({'success': True, 'data': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UpdateCurrentUserSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user_fields, profile_fields = serializer.split_validated_data()
        user = update_own_profile(request.user, user_fields, profile_fields)
        return Response(
            {'success': True, 'data': CurrentUserSerializer(user, context={'request': request}).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        """Hard-deletes (default) or soft-deletes the authenticated user's account."""
        serializer = DeleteAccountSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        delete_account(
            user=request.user,
            hard_delete=serializer.validated_data['hard_delete'],
            refresh_token=serializer.validated_data.get('refresh', ''),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfilePhotoView(APIView):
    """POST /users/me/photo/ — upload a profile photo; DELETE — remove it."""

    permission_classes = [IsRegisteredUser]

    def post(self, request):
        serializer = ProfilePhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = upload_profile_photo(request.user, serializer.validated_data['photo'])
        return Response(
            {'success': True, 'photo_url': request.build_absolute_uri(profile.profile_photo.url)},
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        delete_profile_photo(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPublicProfileView(APIView):
    """GET /users/<user_id>/ — public profile for any user, no authentication required."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_public_profile(user_id)
        return Response(
            PublicUserProfileSerializer(user, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


class FollowView(APIView):
    """POST /users/<id>/follow/ — follow a user; DELETE — unfollow."""

    permission_classes = [IsRegisteredUser]

    def post(self, request, user_id):
        follow, created = follow_user(request.user, user_id)
        serializer = FollowUserSerializer(follow)
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({'success': True, 'data': serializer.data}, status=http_status)

    def delete(self, request, user_id):
        unfollow_user(request.user, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserBookmarksView(APIView):
    """GET /users/<user_id>/bookmarks/ — owner's saved stories, paginated, newest bookmark first."""

    permission_classes = [IsRegisteredUser]

    def get(self, request, user_id):
        qs = annotate_user_interactions(get_user_bookmarks(user_id, request.user), request.user)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)
