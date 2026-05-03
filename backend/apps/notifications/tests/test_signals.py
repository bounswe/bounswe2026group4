from decimal import Decimal

import pytest

from apps.gamification.models import Badge, UserBadge
from apps.interactions.models import Comment, Like
from apps.notifications.models import Notification, NotificationType
from apps.reports.models import Report, ReportReason, ReportStatus
from apps.stories.models import Story
from apps.users.models import Follow, User


def _make_user(email, username):
    return User.objects.create_user(email=email, username=username, password='Password1', is_active=True)


def _make_story(user, status=Story.STATUS_PUBLISHED):
    return Story.objects.create(
        user=user, title='My Story', narrative='N',
        status=status,
        location_lat=Decimal('0'), location_lng=Decimal('0'),
        location_name='P', time_type=Story.TIME_EXACT, year=2000,
    )


def _make_badge(name='First Story'):
    badge, _ = Badge.objects.get_or_create(
        name=name,
        defaults={'description': 'desc', 'criteria_type': 'stories_published', 'criteria_threshold': 1},
    )
    return badge


@pytest.mark.django_db
class TestNewCommentSignal:
    def setup_method(self):
        self.author = _make_user('author@example.com', 'author')
        self.commenter = _make_user('commenter@example.com', 'commenter')
        self.story = _make_story(self.author)

    def test_new_comment_creates_notification_for_story_author(self):
        Comment.objects.create(story=self.story, author=self.commenter, text='Nice!')
        notif = Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.NEW_COMMENT,
        )
        assert notif.count() == 1
        assert self.commenter.username in notif.first().message

    def test_new_comment_sets_actor_and_story_references(self):
        comment = Comment.objects.create(story=self.story, author=self.commenter, text='Nice!')
        notif = Notification.objects.get(recipient=self.author, notification_type=NotificationType.NEW_COMMENT)
        assert notif.actor == self.commenter
        assert notif.story == self.story
        assert notif.comment == comment

    def test_author_commenting_on_own_story_does_not_notify(self):
        Comment.objects.create(story=self.story, author=self.author, text='Self-comment')
        assert Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.NEW_COMMENT,
        ).count() == 0

    def test_private_username_commenter_shows_someone_and_no_actor(self):
        self.commenter.is_username_public = False
        self.commenter.save()
        Comment.objects.create(story=self.story, author=self.commenter, text='Hi')
        notif = Notification.objects.get(
            recipient=self.author, notification_type=NotificationType.NEW_COMMENT,
        )
        assert 'Someone' in notif.message
        assert self.commenter.username not in notif.message
        assert notif.actor is None


@pytest.mark.django_db
class TestNewLikeSignal:
    def setup_method(self):
        self.author = _make_user('author@example.com', 'author')
        self.liker = _make_user('liker@example.com', 'liker')
        self.story = _make_story(self.author)

    def test_new_like_creates_notification_for_story_author(self):
        Like.objects.create(user=self.liker, story=self.story)
        notif = Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.NEW_LIKE,
        )
        assert notif.count() == 1
        assert self.liker.username in notif.first().message

    def test_new_like_sets_actor_and_story_references(self):
        Like.objects.create(user=self.liker, story=self.story)
        notif = Notification.objects.get(recipient=self.author, notification_type=NotificationType.NEW_LIKE)
        assert notif.actor == self.liker
        assert notif.story == self.story

    def test_author_liking_own_story_does_not_notify(self):
        Like.objects.create(user=self.author, story=self.story)
        assert Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.NEW_LIKE,
        ).count() == 0

    def test_private_username_liker_shows_someone_and_no_actor(self):
        self.liker.is_username_public = False
        self.liker.save()
        Like.objects.create(user=self.liker, story=self.story)
        notif = Notification.objects.get(
            recipient=self.author, notification_type=NotificationType.NEW_LIKE,
        )
        assert 'Someone' in notif.message
        assert self.liker.username not in notif.message
        assert notif.actor is None


@pytest.mark.django_db
class TestNewFollowerSignal:
    def setup_method(self):
        self.follower = _make_user('follower@example.com', 'follower')
        self.followed = _make_user('followed@example.com', 'followed')

    def test_new_follow_creates_notification_for_followed_user(self):
        Follow.objects.create(follower=self.follower, followed=self.followed)
        notif = Notification.objects.filter(
            recipient=self.followed, notification_type=NotificationType.NEW_FOLLOWER,
        )
        assert notif.count() == 1
        assert self.follower.username in notif.first().message

    def test_new_follow_sets_actor(self):
        Follow.objects.create(follower=self.follower, followed=self.followed)
        notif = Notification.objects.get(recipient=self.followed, notification_type=NotificationType.NEW_FOLLOWER)
        assert notif.actor == self.follower

    def test_private_username_follower_shows_someone_and_no_actor(self):
        self.follower.is_username_public = False
        self.follower.save()
        Follow.objects.create(follower=self.follower, followed=self.followed)
        notif = Notification.objects.get(recipient=self.followed, notification_type=NotificationType.NEW_FOLLOWER)
        assert 'Someone' in notif.message
        assert self.follower.username not in notif.message
        assert notif.actor is None


@pytest.mark.django_db
class TestBadgeEarnedSignal:
    def setup_method(self):
        self.user = _make_user('user@example.com', 'user')
        self.badge = _make_badge()

    def test_badge_earned_creates_notification(self):
        UserBadge.objects.create(user=self.user, badge=self.badge)
        notif = Notification.objects.filter(
            recipient=self.user, notification_type=NotificationType.BADGE_EARNED,
        )
        assert notif.count() == 1
        assert self.badge.name in notif.first().message

    def test_badge_earned_has_no_actor(self):
        UserBadge.objects.create(user=self.user, badge=self.badge)
        notif = Notification.objects.get(recipient=self.user, notification_type=NotificationType.BADGE_EARNED)
        assert notif.actor is None


@pytest.mark.django_db
class TestNewStoryPublishedSignal:
    def setup_method(self):
        self.author = _make_user('author@example.com', 'author')
        self.follower1 = _make_user('f1@example.com', 'follower1')
        self.follower2 = _make_user('f2@example.com', 'follower2')

    def test_new_published_story_notifies_all_followers(self):
        Follow.objects.create(follower=self.follower1, followed=self.author)
        Follow.objects.create(follower=self.follower2, followed=self.author)
        # Creating the story fires the signal
        story = _make_story(self.author)
        # Each follower gets exactly one notification (the follow creation also fired,
        # so filter by notification type to be precise)
        for follower in [self.follower1, self.follower2]:
            notifs = Notification.objects.filter(
                recipient=follower, notification_type=NotificationType.NEW_STORY_PUBLISHED,
            )
            assert notifs.count() == 1
            assert self.author.username in notifs.first().message
            assert notifs.first().story == story

    def test_new_published_story_no_notification_when_no_followers(self):
        _make_story(self.author)
        assert Notification.objects.filter(
            notification_type=NotificationType.NEW_STORY_PUBLISHED,
        ).count() == 0

    def test_draft_story_does_not_notify_followers(self):
        Follow.objects.create(follower=self.follower1, followed=self.author)
        _make_story(self.author, status=Story.STATUS_DRAFT)
        assert Notification.objects.filter(
            recipient=self.follower1, notification_type=NotificationType.NEW_STORY_PUBLISHED,
        ).count() == 0

    def test_private_username_author_shows_someone_and_no_actor(self):
        self.author.is_username_public = False
        self.author.save()
        Follow.objects.create(follower=self.follower1, followed=self.author)
        _make_story(self.author)
        notif = Notification.objects.get(
            recipient=self.follower1, notification_type=NotificationType.NEW_STORY_PUBLISHED,
        )
        assert 'Someone' in notif.message
        assert self.author.username not in notif.message
        assert notif.actor is None


@pytest.mark.django_db
class TestStoryRemovedSignal:
    def setup_method(self):
        self.author = _make_user('author@example.com', 'author')
        self.story = _make_story(self.author)

    def test_story_removed_creates_notification_for_author(self):
        self.story.status = Story.STATUS_REMOVED
        self.story.save()
        notif = Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.STORY_REMOVED,
        )
        assert notif.count() == 1
        assert self.story.title in notif.first().message

    def test_story_removed_sets_story_reference(self):
        self.story.status = Story.STATUS_REMOVED
        self.story.save()
        notif = Notification.objects.get(
            recipient=self.author, notification_type=NotificationType.STORY_REMOVED,
        )
        assert notif.story == self.story

    def test_saving_already_removed_story_does_not_duplicate_notification(self):
        self.story.status = Story.STATUS_REMOVED
        self.story.save()
        # Second save — status stays removed
        self.story.moderation_reason = 'updated reason'
        self.story.save()
        assert Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.STORY_REMOVED,
        ).count() == 1

    def test_status_change_not_to_removed_does_not_notify(self):
        draft_story = _make_story(self.author, status=Story.STATUS_DRAFT)
        draft_story.status = Story.STATUS_PUBLISHED
        draft_story.save()
        assert Notification.objects.filter(
            recipient=self.author, notification_type=NotificationType.STORY_REMOVED,
        ).count() == 0


@pytest.mark.django_db
class TestReportResolvedSignal:
    def setup_method(self):
        self.reporter = _make_user('reporter@example.com', 'reporter')
        self.author = _make_user('author@example.com', 'author')
        self.story = _make_story(self.author)
        self.report = Report.objects.create(
            reporter=self.reporter,
            story=self.story,
            reason=ReportReason.SPAM,
        )

    def test_report_resolved_creates_notification_for_reporter(self):
        self.report.status = ReportStatus.RESOLVED
        self.report.save()
        notif = Notification.objects.filter(
            recipient=self.reporter, notification_type=NotificationType.REPORT_RESOLVED,
        )
        assert notif.count() == 1
        assert 'resolved' in notif.first().message

    def test_report_dismissed_creates_notification_for_reporter(self):
        self.report.status = ReportStatus.DISMISSED
        self.report.save()
        notif = Notification.objects.filter(
            recipient=self.reporter, notification_type=NotificationType.REPORT_RESOLVED,
        )
        assert notif.count() == 1
        assert 'dismissed' in notif.first().message

    def test_saving_already_resolved_report_does_not_duplicate_notification(self):
        self.report.status = ReportStatus.RESOLVED
        self.report.save()
        self.report.resolution_outcome = 'Story removed.'
        self.report.save()
        assert Notification.objects.filter(
            recipient=self.reporter, notification_type=NotificationType.REPORT_RESOLVED,
        ).count() == 1

    def test_pending_report_update_does_not_notify(self):
        self.report.description = 'updated description'
        self.report.save()
        assert Notification.objects.filter(
            recipient=self.reporter, notification_type=NotificationType.REPORT_RESOLVED,
        ).count() == 0
