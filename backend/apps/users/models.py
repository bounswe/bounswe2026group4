import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class RoleChoices(models.TextChoices):
    # Guest (unauthenticated) is not stored — it is the absence of a User row.
    REGISTERED_USER = 'registered_user', 'Registered User'
    ADMIN = 'admin', 'Admin'


class UserManager(BaseUserManager):
    def create_user(self, email, username, password, **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        if not username:
            raise ValueError('Username is required.')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)  # hashes the password — never store plaintext
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password, **extra_fields):
        extra_fields.setdefault('role', RoleChoices.ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_email_verified', True)
        return self.create_user(email, username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.REGISTERED_USER,
    )
    # Whether the username is shown on stories (req. 1.2.2.3)
    is_username_public = models.BooleanField(default=True)
    # Cached total points; updated atomically alongside PointTransaction inserts (req. 1.7.1.4)
    total_points = models.IntegerField(default=0)
    # TODO: set default=False once email verification infra is ready (req. 1.2.1.2)
    is_active = models.BooleanField(default=True)
    # Tracks 6-digit email verification separately from is_active to distinguish "unverified" vs "banned"
    is_email_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    # Global mute: when True, no notifications are created for this user regardless of per-type preferences
    notifications_muted = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = 'email'  # login by email, not username
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    """
    Optional profile data kept separate from the auth-critical User row.
    All fields are optional; privacy flags control public visibility (req. 1.2.2).
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=255, blank=True)
    birth_date = models.DateField(blank=True, null=True)
    bio = models.TextField(blank=True)
    # Per-field visibility toggles (req. 1.2.2.2)
    is_name_public = models.BooleanField(default=True)
    is_location_public = models.BooleanField(default=True)
    is_birth_date_public = models.BooleanField(default=True)
    is_photo_public = models.BooleanField(default=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f'Profile({self.user.username})'


def _verification_code_expiry():
    # Module-level function instead of lambda so Django migrations can serialize it
    return timezone.now() + timedelta(hours=24)


class EmailVerificationCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_codes')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_verification_code_expiry)
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'email_verification_codes'

    def is_expired(self):
        return timezone.now() > self.expires_at

    @staticmethod
    def generate_code():
        return str(secrets.randbelow(900000) + 100000)

    def __str__(self):
        return f'{self.user.email} — {self.code}'


class Follow(models.Model):
    """
    Directed follow edge in the social graph (issue #399).

    follower: the user who chose to follow
    followed: the user being followed

    UniqueConstraint prevents duplicate follows at the DB level.
    on_delete=CASCADE on both sides: deleting either user removes all their
    follow edges cleanly without orphaned rows.
    """

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following',
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'follows'
        constraints = [
            models.UniqueConstraint(fields=['follower', 'followed'], name='unique_follow'),
        ]
        indexes = [
            models.Index(fields=['followed', 'created_at'], name='follow_followed_date_idx'),
            models.Index(fields=['follower', 'created_at'], name='follow_follower_date_idx'),
        ]

    def __str__(self):
        return f'Follow({self.follower_id} → {self.followed_id})'
