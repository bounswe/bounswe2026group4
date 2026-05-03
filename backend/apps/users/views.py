from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.stories.serializers import StoryFeedSerializer
from apps.stories.services import annotate_user_interactions
from apps.users.serializers import (
    CurrentUserSerializer,
    DeleteAccountSerializer,
    FollowedUserSerializer,
    FollowUserSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfilePhotoSerializer,
    PublicUserProfileSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UpdateCurrentUserSerializer,
    UserResponseSerializer,
    VerifyEmailSerializer,
)
from apps.users.services import (
    delete_account,
    delete_profile_photo,
    follow_user,
    get_followers,
    get_following,
    get_own_profile,
    get_public_profile,
    get_user_bookmarks,
    login_user,
    logout_user,
    register_user,
    request_password_reset,
    resend_verification,
    reset_password,
    unfollow_user,
    update_own_profile,
    upload_profile_photo,
    verify_email,
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


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify_email'

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verify_email(
            serializer.validated_data['email'],
            serializer.validated_data['code'],
        )
        return Response({'message': 'Email verified successfully.'}, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    """POST /auth/resend-verification/ — send a new verification code to an unverified account."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify_email'

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resend_verification(serializer.validated_data['email'])
        return Response(
            {'message': 'If that email is pending verification, a new code has been sent.'},
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

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
    permission_classes = [IsRegisteredUser]

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


class FollowerListView(APIView):
    """GET /users/<id>/followers/ — paginated list of users who follow the given user."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        qs = get_followers(user_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = FollowedUserSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class FollowingListView(APIView):
    """GET /users/<id>/following/ — paginated list of users the given user follows."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        qs = get_following(user_id)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = FollowedUserSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class UserBookmarksView(APIView):
    """GET /users/<user_id>/bookmarks/ — owner's saved stories, paginated, newest bookmark first."""

    permission_classes = [IsRegisteredUser]

    def get(self, request, user_id):
        qs = annotate_user_interactions(get_user_bookmarks(user_id, request.user), request.user)
        paginator = StoryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = StoryFeedSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class PasswordResetRequestView(APIView):
    """POST /auth/password-reset/ — request a password reset email."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data['email'])
        return Response(
            {'message': 'If that email is registered, a reset link has been sent.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """POST /auth/password-reset/confirm/ — set a new password using a reset token."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_password(
            str(serializer.validated_data['token']),
            serializer.validated_data['new_password'],
        )
        return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)
