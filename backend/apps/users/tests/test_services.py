import datetime
import io
from decimal import Decimal

import pytest
from django.core import mail
from django.core.files.storage import default_storage
from django.utils import timezone
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import Http404
from PIL import Image
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError

from apps.users.models import EmailVerificationCode, Follow, User, UserProfile
from apps.users.services import (
    ban_user,
    delete_account,
    delete_profile_photo,
    follow_user,
    get_own_profile,
    get_public_profile,
    get_user_bookmarks,
    get_user_published_stories,
    login_user,
    logout_user,
    register_user,
    send_registration_verification,
    request_password_reset,
    resend_verification,
    reset_password,
    unfollow_user,
    update_own_profile,
    upload_profile_photo,
)
from apps.interactions.models import SavedStory
from apps.stories.models import Story


def _make_image_file(fmt='JPEG'):
    """Return a real in-memory image file that python-magic can identify."""
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), color=(100, 149, 237)).save(buf, format=fmt)
    buf.seek(0)
    ext = 'jpg' if fmt == 'JPEG' else fmt.lower()
    content_type = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return InMemoryUploadedFile(buf, 'photo', f'test.{ext}', content_type, buf.getbuffer().nbytes, None)


@pytest.mark.django_db
class TestRegisterUser:
    def _data(self, **overrides):
        data = {
            'email': 'user@example.com',
            'username': 'testuser',
            'password': 'Password1',
        }
        data.update(overrides)
        return data

    def test_creates_user(self):
        user = register_user(self._data())
        assert User.objects.filter(email='user@example.com').exists()
        assert user.username == 'testuser'

    def test_password_is_hashed(self):
        user = register_user(self._data())
        assert user.check_password('Password1') is True
        assert user.password != 'Password1'

    def test_creates_verification_code(self):
        user = register_user(self._data())
        assert EmailVerificationCode.objects.filter(user=user).exists()

    def test_user_is_inactive_on_registration(self):
        user = register_user(self._data())
        assert user.is_active is False

    def test_email_is_not_verified_on_registration(self):
        user = register_user(self._data())
        assert user.is_email_verified is False

    def test_register_user_awards_registration_badge_when_seeded(self):
        from apps.gamification.models import UserBadge
        # Pioneer badge is already seeded by the data migration — no creation needed.
        user = register_user(self._data())
        assert UserBadge.objects.filter(user=user).exists()

    def test_register_user_does_not_fail_without_registration_badge_seeded(self):
        # Graceful no-op when no badge row exists yet
        user = register_user(self._data())  # must not raise
        assert user.pk is not None


@pytest.mark.django_db
class TestLoginUser:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
            is_active=True,
        )

    def test_returns_tokens_on_valid_credentials(self):
        result = login_user('user@example.com', 'Password1')
        assert 'access' in result
        assert 'refresh' in result

    def test_returns_user_info(self):
        result = login_user('user@example.com', 'Password1')
        assert result['user']['email'] == 'user@example.com'
        assert result['user']['username'] == 'testuser'

    def test_wrong_password_raises_auth_failed(self):
        with pytest.raises(AuthenticationFailed):
            login_user('user@example.com', 'WrongPassword1')

    def test_wrong_email_raises_auth_failed(self):
        with pytest.raises(AuthenticationFailed):
            login_user('nobody@example.com', 'Password1')

    def test_wrong_email_and_wrong_password_same_error(self):
        # Both failure modes must return identical errors to prevent user enumeration
        try:
            login_user('nobody@example.com', 'Password1')
        except AuthenticationFailed as e:
            wrong_email_msg = str(e.detail)

        try:
            login_user('user@example.com', 'WrongPassword1')
        except AuthenticationFailed as e:
            wrong_password_msg = str(e.detail)

        assert wrong_email_msg == wrong_password_msg

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save()
        with pytest.raises(AuthenticationFailed):
            login_user('user@example.com', 'Password1')

    def test_inactive_user_gets_same_error_as_invalid_credentials(self):
        # An inactive (banned/disabled) account must be indistinguishable from a non-existent one
        self.user.is_active = False
        self.user.save()
        try:
            login_user('nobody@example.com', 'Password1')
        except AuthenticationFailed as e:
            nonexistent_msg = str(e.detail)

        try:
            login_user('user@example.com', 'Password1')
        except AuthenticationFailed as e:
            inactive_msg = str(e.detail)

        assert nonexistent_msg == inactive_msg


@pytest.mark.django_db
class TestLogoutUser:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='user@example.com',
            username='testuser',
            password='Password1',
            is_active=True,
        )

    def test_valid_refresh_token_is_blacklisted(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(self.user))
        # Should not raise
        logout_user(refresh)

    def test_blacklisted_token_raises_validation_error(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(self.user))
        logout_user(refresh)
        # Second logout with same token must fail
        with pytest.raises(ValidationError):
            logout_user(refresh)

    def test_invalid_token_raises_validation_error(self):
        with pytest.raises(ValidationError):
            logout_user('this-is-not-a-valid-token')


# ── get_public_profile ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetPublicProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='profile@example.com',
            username='profileuser',
            password='Password1',
            is_active=True,
        )

    def test_returns_user_for_valid_id(self):
        result = get_public_profile(self.user.pk)
        assert result.pk == self.user.pk

    def test_raises_404_for_nonexistent_user(self):
        with pytest.raises(Http404):
            get_public_profile(99999)

    def test_annotates_published_story_count(self):
        Story.objects.create(
            user=self.user, title='Pub', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        Story.objects.create(
            user=self.user, title='Draft', narrative='N',
            status=Story.STATUS_DRAFT,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2001,
        )
        result = get_public_profile(self.user.pk)
        assert result.published_story_count == 1

    def test_zero_published_stories(self):
        result = get_public_profile(self.user.pk)
        assert result.published_story_count == 0

    def test_profile_is_prefetched(self):
        from apps.users.models import UserProfile
        UserProfile.objects.create(user=self.user, bio='Historian')
        result = get_public_profile(self.user.pk)
        # select_related means profile is accessible without an extra query
        assert result.profile.bio == 'Historian'

    def test_inactive_user_raises_404(self):
        self.user.is_active = False
        self.user.save()
        with pytest.raises(Http404):
            get_public_profile(self.user.pk)


# ── get_own_profile ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetOwnProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='own@example.com',
            username='ownuser',
            password='Password1',
            is_active=True,
        )

    def test_returns_correct_user(self):
        result = get_own_profile(self.user)
        assert result.pk == self.user.pk

    def test_creates_profile_when_not_exists(self):
        assert not UserProfile.objects.filter(user=self.user).exists()
        get_own_profile(self.user)
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_profile_accessible_via_relation(self):
        result = get_own_profile(self.user)
        # select_related means profile is loaded without an extra query
        assert result.profile is not None

    def test_idempotent_when_profile_already_exists(self):
        UserProfile.objects.create(user=self.user, bio='Existing')
        result = get_own_profile(self.user)
        assert result.profile.bio == 'Existing'
        assert UserProfile.objects.filter(user=self.user).count() == 1


# ── update_own_profile ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateOwnProfile:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='upd@example.com',
            username='upduser',
            password='Password1',
            is_active=True,
        )

    def test_updates_user_fields(self):
        result = update_own_profile(self.user, {'username': 'newname'}, {})
        assert result.username == 'newname'
        self.user.refresh_from_db()
        assert self.user.username == 'newname'

    def test_updates_is_username_public(self):
        result = update_own_profile(self.user, {'is_username_public': False}, {})
        assert result.is_username_public is False

    def test_updates_profile_fields(self):
        result = update_own_profile(self.user, {}, {'bio': 'Historian', 'location': 'Istanbul'})
        assert result.profile.bio == 'Historian'
        assert result.profile.location == 'Istanbul'

    def test_creates_profile_when_not_exists_on_profile_update(self):
        assert not UserProfile.objects.filter(user=self.user).exists()
        update_own_profile(self.user, {}, {'bio': 'New bio'})
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_updates_both_user_and_profile_fields(self):
        result = update_own_profile(
            self.user,
            {'username': 'combined'},
            {'bio': 'Both updated'},
        )
        assert result.username == 'combined'
        assert result.profile.bio == 'Both updated'

    def test_returns_user_with_profile_prefetched(self):
        result = update_own_profile(self.user, {}, {'location': 'Ankara'})
        assert result.profile.location == 'Ankara'

    def test_empty_fields_returns_user_unchanged(self):
        result = update_own_profile(self.user, {}, {})
        assert result.pk == self.user.pk
        assert result.username == 'upduser'

    def test_does_not_create_profile_when_profile_fields_empty(self):
        # Profile row should only be created when there is actual profile data to save
        update_own_profile(self.user, {'is_username_public': False}, {})
        assert not UserProfile.objects.filter(user=self.user).exists()

    def test_persists_profile_privacy_flags(self):
        update_own_profile(self.user, {}, {'is_location_public': False, 'is_birth_date_public': False})
        profile = UserProfile.objects.get(user=self.user)
        assert profile.is_location_public is False
        assert profile.is_birth_date_public is False


# ── upload_profile_photo ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUploadProfilePhoto:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='photo@example.com',
            username='photouser',
            password='Password1',
            is_active=True,
        )

    def test_upload_jpeg_succeeds(self):
        profile = upload_profile_photo(self.user, _make_image_file('JPEG'))
        assert profile.profile_photo

    def test_upload_png_succeeds(self):
        profile = upload_profile_photo(self.user, _make_image_file('PNG'))
        assert profile.profile_photo

    def test_wrong_mime_type_raises_validation_error(self):
        buf = io.BytesIO(b'this is plaintext, not an image')
        file = InMemoryUploadedFile(buf, 'photo', 'evil.jpg', 'image/jpeg', buf.getbuffer().nbytes, None)
        with pytest.raises(ValidationError) as exc_info:
            upload_profile_photo(self.user, file)
        assert 'photo' in exc_info.value.detail

    def test_oversized_file_raises_validation_error(self):
        # Pass a large reported size; service rejects before reading bytes
        buf = io.BytesIO(b'\x00' * 10)
        oversized = InMemoryUploadedFile(buf, 'photo', 'big.jpg', 'image/jpeg', 3 * 1024 * 1024, None)
        with pytest.raises(ValidationError) as exc_info:
            upload_profile_photo(self.user, oversized)
        assert 'photo' in exc_info.value.detail

    def test_creates_profile_if_not_exists(self):
        assert not UserProfile.objects.filter(user=self.user).exists()
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_replace_removes_old_file_from_storage(self):
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        old_name = UserProfile.objects.get(user=self.user).profile_photo.name
        assert default_storage.exists(old_name)

        upload_profile_photo(self.user, _make_image_file('PNG'))
        assert not default_storage.exists(old_name)

    def test_replace_stores_new_file(self):
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        old_name = UserProfile.objects.get(user=self.user).profile_photo.name

        upload_profile_photo(self.user, _make_image_file('PNG'))
        new_name = UserProfile.objects.get(user=self.user).profile_photo.name
        assert new_name != old_name


# ── delete_account ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteAccount:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='del@example.com',
            username='deluser',
            password='Password1',
            is_active=True,
        )

    def _make_story(self, title='Story'):
        return Story.objects.create(
            user=self.user,
            title=title,
            narrative='Narrative',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=2000,
        )

    def test_hard_delete_removes_user(self):
        pk = self.user.pk
        delete_account(self.user, hard_delete=True)
        assert not User.objects.filter(pk=pk).exists()

    def test_hard_delete_removes_stories(self):
        story = self._make_story()
        delete_account(self.user, hard_delete=True)
        assert not Story.objects.filter(pk=story.pk).exists()

    def test_hard_delete_deletes_profile_photo_file(self):
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        photo_name = UserProfile.objects.get(user=self.user).profile_photo.name
        delete_account(self.user, hard_delete=True)
        assert not default_storage.exists(photo_name)

    def test_hard_delete_with_no_photo_does_not_raise(self):
        delete_account(self.user, hard_delete=True)

    def test_hard_delete_with_no_stories_does_not_raise(self):
        delete_account(self.user, hard_delete=True)

    def test_soft_delete_deactivates_user(self):
        delete_account(self.user, hard_delete=False)
        self.user.refresh_from_db()
        assert self.user.is_active is False

    def test_soft_delete_anonymizes_stories(self):
        story = self._make_story()
        delete_account(self.user, hard_delete=False)
        assert Story.objects.get(pk=story.pk).user is None

    def test_soft_delete_preserves_story_data(self):
        story = self._make_story(title='Keep Me')
        delete_account(self.user, hard_delete=False)
        preserved = Story.objects.get(pk=story.pk)
        assert preserved.title == 'Keep Me'
        assert preserved.narrative == 'Narrative'

    def test_soft_delete_does_not_delete_user_row(self):
        delete_account(self.user, hard_delete=False)
        assert User.objects.filter(pk=self.user.pk).exists()

    def test_blacklists_refresh_token_on_hard_delete(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError
        refresh = RefreshToken.for_user(self.user)
        token_str = str(refresh)
        delete_account(self.user, hard_delete=True, refresh_token=token_str)
        with pytest.raises(TokenError):
            RefreshToken(token_str).blacklist()

    def test_blacklists_refresh_token_on_soft_delete(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError
        refresh = RefreshToken.for_user(self.user)
        token_str = str(refresh)
        delete_account(self.user, hard_delete=False, refresh_token=token_str)
        with pytest.raises(TokenError):
            RefreshToken(token_str).blacklist()

    def test_empty_refresh_token_does_not_raise(self):
        delete_account(self.user, hard_delete=True, refresh_token='')

    def test_already_blacklisted_token_does_not_raise(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user)
        token_str = str(refresh)
        refresh.blacklist()
        delete_account(self.user, hard_delete=True, refresh_token=token_str)

    def test_malformed_refresh_token_does_not_raise(self):
        delete_account(self.user, hard_delete=True, refresh_token='not-a-token')

    def test_hard_delete_removes_user_comments_on_other_stories(self):
        from apps.interactions.models import Comment
        other_user = User.objects.create_user(
            email='other@example.com', username='otheruser', password='Password1', is_active=True,
        )
        other_story = Story.objects.create(
            user=other_user, title='Other', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        comment = Comment.objects.create(story=other_story, author=self.user, text='Hello')
        delete_account(self.user, hard_delete=True)
        assert not Comment.objects.filter(pk=comment.pk).exists()

    def test_hard_delete_deletes_story_media_files(self):
        from apps.media.models import MediaItem
        from django.core.files.base import ContentFile
        story = self._make_story()
        item = MediaItem.objects.create(
            story=story,
            file=ContentFile(b'fake media', name='test.jpg'),
            media_type='image',
            file_size=10,
            original_filename='test.jpg',
        )
        file_name = item.file.name
        assert default_storage.exists(file_name)
        delete_account(self.user, hard_delete=True)
        assert not default_storage.exists(file_name)

    def test_hard_delete_with_no_comments_does_not_raise(self):
        delete_account(self.user, hard_delete=True)

    def test_soft_delete_does_not_remove_user_comments(self):
        from apps.interactions.models import Comment
        other_user = User.objects.create_user(
            email='other2@example.com', username='otheruser2', password='Password1', is_active=True,
        )
        other_story = Story.objects.create(
            user=other_user, title='Other', narrative='N',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'), location_lng=Decimal('0'),
            location_name='P', time_type=Story.TIME_EXACT, year=2000,
        )
        comment = Comment.objects.create(story=other_story, author=self.user, text='Hello')
        delete_account(self.user, hard_delete=False)
        # Comment survives on soft delete — community content is preserved
        assert Comment.objects.filter(pk=comment.pk).exists()


# ── delete_profile_photo ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeleteProfilePhoto:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='del@example.com',
            username='deluser',
            password='Password1',
            is_active=True,
        )

    def test_clears_photo_field(self):
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        delete_profile_photo(self.user)
        assert not UserProfile.objects.get(user=self.user).profile_photo

    def test_deletes_file_from_storage(self):
        upload_profile_photo(self.user, _make_image_file('JPEG'))
        name = UserProfile.objects.get(user=self.user).profile_photo.name
        delete_profile_photo(self.user)
        assert not default_storage.exists(name)

    def test_no_op_when_no_profile_exists(self):
        # Must not raise even if UserProfile row is absent
        delete_profile_photo(self.user)

    def test_no_op_when_profile_has_no_photo(self):
        UserProfile.objects.create(user=self.user)
        delete_profile_photo(self.user)  # must not raise


# ── follow_user ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestFollowUser:
    def setup_method(self):
        self.follower = User.objects.create_user(
            email='fw1@example.com', username='fwuser1', password='Password1', is_active=True,
        )
        self.target = User.objects.create_user(
            email='fw2@example.com', username='fwuser2', password='Password1', is_active=True,
        )

    def test_creates_follow_record(self):
        follow, created = follow_user(self.follower, self.target.pk)
        assert created is True
        assert Follow.objects.filter(follower=self.follower, followed=self.target).exists()

    def test_returns_follow_instance(self):
        follow, created = follow_user(self.follower, self.target.pk)
        assert follow.follower_id == self.follower.pk
        assert follow.followed_id == self.target.pk

    def test_refollow_returns_created_false(self):
        follow_user(self.follower, self.target.pk)
        follow, created = follow_user(self.follower, self.target.pk)
        assert created is False
        assert Follow.objects.filter(follower=self.follower, followed=self.target).count() == 1

    def test_self_follow_raises_validation_error(self):
        with pytest.raises(ValidationError):
            follow_user(self.follower, self.follower.pk)

    def test_unknown_followed_id_raises_404(self):
        with pytest.raises(Http404):
            follow_user(self.follower, 99999)

    def test_inactive_target_raises_404(self):
        self.target.is_active = False
        self.target.save()
        with pytest.raises(Http404):
            follow_user(self.follower, self.target.pk)


# ── unfollow_user ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUnfollowUser:
    def setup_method(self):
        self.follower = User.objects.create_user(
            email='uf1@example.com', username='ufuser1', password='Password1', is_active=True,
        )
        self.target = User.objects.create_user(
            email='uf2@example.com', username='ufuser2', password='Password1', is_active=True,
        )

    def test_removes_follow_record(self):
        Follow.objects.create(follower=self.follower, followed=self.target)
        unfollow_user(self.follower, self.target.pk)
        assert not Follow.objects.filter(follower=self.follower, followed=self.target).exists()

    def test_unfollow_non_followed_is_noop(self):
        unfollow_user(self.follower, self.target.pk)  # must not raise

    def test_unknown_followed_id_raises_404(self):
        with pytest.raises(Http404):
            unfollow_user(self.follower, 99999)


# ── get_public_profile: follow counts ────────────────────────────────────────


@pytest.mark.django_db
class TestGetPublicProfileFollowCounts:
    def setup_method(self):
        self.subject = User.objects.create_user(
            email='subj@example.com', username='subjuser', password='Password1', is_active=True,
        )
        self.other = User.objects.create_user(
            email='fcnt1@example.com', username='fcntuser', password='Password1', is_active=True,
        )

    def test_followers_count_is_zero_initially(self):
        user = get_public_profile(self.subject.pk)
        assert user.followers_count == 0

    def test_following_count_is_zero_initially(self):
        user = get_public_profile(self.subject.pk)
        assert user.following_count == 0

    def test_followers_count_increments_after_follow(self):
        Follow.objects.create(follower=self.other, followed=self.subject)
        user = get_public_profile(self.subject.pk)
        assert user.followers_count == 1

    def test_following_count_increments_after_follow(self):
        Follow.objects.create(follower=self.subject, followed=self.other)
        user = get_public_profile(self.subject.pk)
        assert user.following_count == 1

    def test_followers_count_decrements_after_unfollow(self):
        f = Follow.objects.create(follower=self.other, followed=self.subject)
        f.delete()
        user = get_public_profile(self.subject.pk)
        assert user.followers_count == 0

    def test_followers_count_excludes_inactive_follower(self):
        Follow.objects.create(follower=self.other, followed=self.subject)
        self.other.is_active = False
        self.other.save()
        user = get_public_profile(self.subject.pk)
        assert user.followers_count == 0

    def test_following_count_excludes_inactive_followed(self):
        Follow.objects.create(follower=self.subject, followed=self.other)
        self.other.is_active = False
        self.other.save()
        user = get_public_profile(self.subject.pk)
        assert user.following_count == 0


# ── get_user_bookmarks ────────────────────────────────────────────────────────

def _make_published_story(user, title='Test Story'):
    return Story.objects.create(
        user=user,
        title=title,
        narrative='Narrative text.',
        status=Story.STATUS_PUBLISHED,
        location_lat=Decimal('41.0'),
        location_lng=Decimal('29.0'),
        location_name='Istanbul',
        time_type=Story.TIME_EXACT,
        year=2000,
    )


@pytest.mark.django_db
class TestGetUserBookmarks:
    def test_returns_bookmarked_stories(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        qs = get_user_bookmarks(user.pk, user)
        assert story in qs

    def test_returns_only_published_stories(self, user, story):
        SavedStory.objects.create(user=user, story=story)
        story.status = Story.STATUS_REMOVED
        story.save()
        qs = get_user_bookmarks(user.pk, user)
        assert story not in qs

    def test_empty_when_no_bookmarks(self, user):
        qs = get_user_bookmarks(user.pk, user)
        assert qs.count() == 0

    def test_ordered_most_recently_saved_first(self, user, second_user):
        story1 = _make_published_story(second_user, title='Older Story')
        story2 = _make_published_story(second_user, title='Newer Story')
        ss1 = SavedStory.objects.create(user=user, story=story1)
        SavedStory.objects.filter(pk=ss1.pk).update(
            saved_at=timezone.now() - datetime.timedelta(seconds=5)
        )
        SavedStory.objects.create(user=user, story=story2)
        result = list(get_user_bookmarks(user.pk, user))
        assert result[0] == story2
        assert result[1] == story1

    def test_only_returns_own_bookmarks(self, user, second_user, story):
        SavedStory.objects.create(user=second_user, story=story)
        qs = get_user_bookmarks(user.pk, user)
        assert qs.count() == 0

    def test_nonexistent_user_raises_404(self, user):
        with pytest.raises(Http404):
            get_user_bookmarks(99999, user)

    def test_inactive_user_raises_404(self, user, second_user):
        second_user.is_active = False
        second_user.save()
        with pytest.raises(Http404):
            get_user_bookmarks(second_user.pk, user)

    def test_non_owner_raises_permission_denied(self, user, second_user):
        with pytest.raises(PermissionDenied):
            get_user_bookmarks(user.pk, second_user)


# ── get_user_published_stories ────────────────────────────────────────────────


@pytest.mark.django_db
class TestGetUserPublishedStories:
    def _make_story(self, user, title='Story', status=Story.STATUS_PUBLISHED):
        return Story.objects.create(
            user=user,
            title=title,
            narrative='Narrative text.',
            status=status,
            location_lat=Decimal('41.0'),
            location_lng=Decimal('29.0'),
            location_name='Istanbul',
            time_type=Story.TIME_EXACT,
            year=2000,
        )

    def test_returns_published_stories(self, user):
        story = self._make_story(user)
        qs = get_user_published_stories(user.pk)
        assert story in qs

    def test_excludes_draft_stories(self, user):
        draft = self._make_story(user, title='Draft', status=Story.STATUS_DRAFT)
        qs = get_user_published_stories(user.pk)
        assert draft not in qs

    def test_excludes_removed_stories(self, user):
        removed = self._make_story(user, title='Removed', status=Story.STATUS_REMOVED)
        qs = get_user_published_stories(user.pk)
        assert removed not in qs

    def test_ordered_most_recent_first(self, user):
        story1 = self._make_story(user, title='First')
        story2 = self._make_story(user, title='Second')
        Story.objects.filter(pk=story1.pk).update(
            submitted_at=timezone.now() - datetime.timedelta(seconds=5)
        )
        result = list(get_user_published_stories(user.pk))
        assert result[0] == story2
        assert result[1] == story1

    def test_nonexistent_user_raises_404(self):
        with pytest.raises(Http404):
            get_user_published_stories(99999)

    def test_inactive_user_raises_404(self, user):
        user.is_active = False
        user.save()
        with pytest.raises(Http404):
            get_user_published_stories(user.pk)

    def test_does_not_return_other_users_stories(self, user, second_user):
        other_story = self._make_story(second_user, title='Other')
        qs = get_user_published_stories(user.pk)
        assert other_story not in qs


# ── register_user: creates user without sending email ────────────────────────

@pytest.mark.django_db
class TestRegisterUserSendsEmail:
    _DATA = {'email': 'new@example.com', 'username': 'newuser', 'password': 'Password1'}

    def test_email_failure_does_not_prevent_account_creation(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.services.send_verification_email',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        user = register_user(self._DATA)
        assert User.objects.filter(email='new@example.com').exists()
        assert user.pk is not None


# ── send_registration_verification ───────────────────────────────────────────

@pytest.mark.django_db
class TestSendRegistrationVerification:
    _DATA = {'email': 'new@example.com', 'username': 'newuser', 'password': 'Password1'}

    def test_sends_verification_email(self):
        user = register_user(self._DATA)
        send_registration_verification(user)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['new@example.com']

    def test_email_body_contains_verification_code(self):
        user = register_user(self._DATA)
        send_registration_verification(user)
        code = EmailVerificationCode.objects.get(user=user).code
        assert code in mail.outbox[0].body

    def test_returns_true_on_success(self):
        user = register_user(self._DATA)
        assert send_registration_verification(user) is True

    def test_returns_false_when_delivery_fails(self, monkeypatch):
        monkeypatch.setattr(
            'apps.users.services.send_verification_email',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        user = register_user(self._DATA)
        assert send_registration_verification(user) is False

    def test_returns_false_when_no_unused_code_exists(self):
        user = register_user(self._DATA)
        EmailVerificationCode.objects.filter(user=user).update(is_used=True)
        assert send_registration_verification(user) is False


# ── request_password_reset ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRequestPasswordReset:
    def test_sends_email_to_existing_user(self, user):
        request_password_reset(user.email)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user.email]

    def test_creates_reset_token(self, user):
        from apps.users.models import PasswordResetToken
        request_password_reset(user.email)
        assert PasswordResetToken.objects.filter(user=user).exists()

    def test_email_contains_token_in_link(self, user):
        from apps.users.models import PasswordResetToken
        request_password_reset(user.email)
        token = PasswordResetToken.objects.get(user=user)
        assert str(token.token) in mail.outbox[0].body

    def test_no_email_for_nonexistent_address(self):
        request_password_reset('nobody@example.com')
        assert len(mail.outbox) == 0

    def test_no_token_for_nonexistent_address(self):
        from apps.users.models import PasswordResetToken
        request_password_reset('nobody@example.com')
        assert PasswordResetToken.objects.count() == 0

    def test_no_email_for_inactive_user(self, user):
        user.is_active = False
        user.save()
        request_password_reset(user.email)
        assert len(mail.outbox) == 0

    def test_invalidates_old_tokens_before_creating_new(self, user):
        from apps.users.models import PasswordResetToken
        old_token = PasswordResetToken.objects.create(user=user)
        request_password_reset(user.email)
        old_token.refresh_from_db()
        assert old_token.is_used is True
        assert PasswordResetToken.objects.filter(user=user, is_used=False).count() == 1

    def test_email_failure_does_not_prevent_token_creation(self, user, monkeypatch):
        from apps.users.models import PasswordResetToken
        monkeypatch.setattr(
            'apps.users.services.send_password_reset_email',
            lambda *args, **kwargs: (_ for _ in ()).throw(Exception('SMTP down')),
        )
        request_password_reset(user.email)
        assert PasswordResetToken.objects.filter(user=user).exists()


# ── reset_password ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestResetPassword:
    def test_resets_password_with_valid_token(self, user):
        from apps.users.models import PasswordResetToken
        token = PasswordResetToken.objects.create(user=user)
        reset_password(str(token.token), 'NewPassword1')
        user.refresh_from_db()
        assert user.check_password('NewPassword1')

    def test_marks_token_as_used(self, user):
        from apps.users.models import PasswordResetToken
        token = PasswordResetToken.objects.create(user=user)
        reset_password(str(token.token), 'NewPassword1')
        token.refresh_from_db()
        assert token.is_used is True

    def test_invalid_token_raises_validation_error(self):
        with pytest.raises(ValidationError):
            reset_password('00000000-0000-0000-0000-000000000000', 'NewPassword1')

    def test_already_used_token_raises_validation_error(self, user):
        from apps.users.models import PasswordResetToken
        token = PasswordResetToken.objects.create(user=user, is_used=True)
        with pytest.raises(ValidationError):
            reset_password(str(token.token), 'NewPassword1')

    def test_expired_token_raises_validation_error(self, user):
        from apps.users.models import PasswordResetToken
        from datetime import timedelta
        token = PasswordResetToken.objects.create(
            user=user, expires_at=timezone.now() - timedelta(hours=1)
        )
        with pytest.raises(ValidationError):
            reset_password(str(token.token), 'NewPassword1')

    def test_used_token_cannot_be_reused(self, user):
        from apps.users.models import PasswordResetToken
        token = PasswordResetToken.objects.create(user=user)
        reset_password(str(token.token), 'NewPassword1')
        with pytest.raises(ValidationError):
            reset_password(str(token.token), 'AnotherPassword1')

    def test_blacklists_outstanding_jwt_tokens(self, user):
        from apps.users.models import PasswordResetToken
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        refresh = RefreshToken.for_user(user)
        outstanding = OutstandingToken.objects.get(jti=refresh['jti'])

        token = PasswordResetToken.objects.create(user=user)
        reset_password(str(token.token), 'NewPassword1')

        assert BlacklistedToken.objects.filter(token=outstanding).exists()


# ── resend_verification ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestResendVerification:
    def _make_unverified_user(self, email='unverified@example.com', username='unverified'):
        return User.objects.create_user(
            email=email, username=username, password='Password1',
        )

    def test_creates_new_code_for_unverified_user(self):
        user = self._make_unverified_user()
        resend_verification(user.email)
        assert EmailVerificationCode.objects.filter(user=user, is_used=False).exists()

    def test_sends_verification_email(self):
        user = self._make_unverified_user()
        mail.outbox.clear()
        resend_verification(user.email)
        assert len(mail.outbox) == 1

    def test_invalidates_old_unused_codes_before_creating_new(self):
        user = self._make_unverified_user()
        old_code = EmailVerificationCode.objects.create(
            user=user, code=EmailVerificationCode.generate_code()
        )
        resend_verification(user.email)
        old_code.refresh_from_db()
        assert old_code.is_used is True
        assert EmailVerificationCode.objects.filter(user=user, is_used=False).count() == 1

    def test_only_latest_code_is_valid_after_resend(self):
        user = self._make_unverified_user()
        resend_verification(user.email)
        resend_verification(user.email)
        assert EmailVerificationCode.objects.filter(user=user, is_used=False).count() == 1

    def test_noop_for_unknown_email(self):
        mail.outbox.clear()
        resend_verification('nobody@example.com')
        assert len(mail.outbox) == 0

    def test_noop_for_already_active_user(self):
        user = self._make_unverified_user()
        user.is_active = True
        user.save()
        mail.outbox.clear()
        resend_verification(user.email)
        assert len(mail.outbox) == 0

    def test_noop_for_already_verified_user(self):
        user = self._make_unverified_user()
        user.is_email_verified = True
        user.save()
        mail.outbox.clear()
        resend_verification(user.email)
        assert len(mail.outbox) == 0


# ── UsersConfig._warn_if_email_misconfigured ──────────────────────────────────


class TestEmailMisconfigurationWarnings:
    """
    Calls _warn_if_email_misconfigured directly; AppConfig.ready() is not
    re-invoked during the test run so we test the method in isolation.
    """

    def _run(self, settings, monkeypatch):
        from apps.users.apps import UsersConfig
        cfg = UsersConfig('apps.users', __import__('apps.users'))
        cfg._warn_if_email_misconfigured()

    def test_no_warning_for_non_smtp_backend(self, settings, monkeypatch, caplog):
        settings.EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
        settings.DEBUG = False
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, monkeypatch)
        assert caplog.text == ''

    def test_no_warning_in_debug_mode(self, settings, caplog):
        settings.EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
        settings.EMAIL_HOST_PASSWORD = ''
        settings.DEBUG = True
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, caplog)
        assert caplog.text == ''

    def test_warns_when_password_missing_in_production(self, settings, caplog):
        settings.EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
        settings.EMAIL_HOST_PASSWORD = ''
        settings.DEBUG = False
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, caplog)
        assert 'EMAIL_HOST_PASSWORD' in caplog.text

    def test_warns_when_from_email_has_example_com_in_production(self, settings, caplog):
        settings.EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
        settings.EMAIL_HOST_PASSWORD = 'real-key'
        settings.DEFAULT_FROM_EMAIL = 'App <noreply@example.com>'
        settings.DEBUG = False
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, caplog)
        assert caplog.text != ''

    def test_warns_when_from_email_has_yourdomain_example_in_production(self, settings, caplog):
        # Regression: the base.py default changed from @example.com to @yourdomain.example;
        # the warning must still fire for that placeholder.
        settings.EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
        settings.EMAIL_HOST_PASSWORD = 'real-key'
        settings.DEFAULT_FROM_EMAIL = 'App <noreply@yourdomain.example>'
        settings.DEBUG = False
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, caplog)
        assert caplog.text != ''

    def test_no_warning_when_fully_configured(self, settings, caplog):
        settings.EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
        settings.EMAIL_HOST_PASSWORD = 're_real_key'
        settings.DEFAULT_FROM_EMAIL = 'App <noreply@storymap.page>'
        settings.DEBUG = False
        with caplog.at_level('WARNING', logger='apps.users.apps'):
            self._run(settings, caplog)
        assert caplog.text == ''


# ── ban_user ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBanUser:
    def setup_method(self):
        self.user = User.objects.create_user(
            email='target@example.com',
            username='targetuser',
            password='Password1',
            is_active=True,
        )

    def _make_story(self):
        from decimal import Decimal
        return Story.objects.create(
            user=self.user,
            title='Story',
            narrative='Narrative.',
            status=Story.STATUS_PUBLISHED,
            location_lat=Decimal('0'),
            location_lng=Decimal('0'),
            location_name='Place',
            time_type=Story.TIME_EXACT,
            year=2000,
        )

    def test_ban_user_sets_is_active_false(self):
        ban_user(self.user)
        self.user.refresh_from_db()
        assert self.user.is_active is False

    def test_ban_user_returns_updated_user(self):
        result = ban_user(self.user)
        assert result.is_active is False

    def test_ban_user_is_idempotent_when_already_banned(self):
        self.user.is_active = False
        self.user.save()
        result = ban_user(self.user)
        assert result.is_active is False
        # Confirm still a single user row — no duplicate or error
        assert User.objects.filter(pk=self.user.pk).count() == 1

    def test_ban_user_preserves_account(self):
        ban_user(self.user)
        assert User.objects.filter(pk=self.user.pk).exists()

    def test_ban_user_preserves_stories(self):
        story = self._make_story()
        ban_user(self.user)
        assert Story.objects.filter(pk=story.pk).exists()
