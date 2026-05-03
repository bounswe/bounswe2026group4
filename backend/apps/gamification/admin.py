from django.contrib import admin

from apps.gamification.models import Badge, PointTransaction, UserBadge


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ('name', 'criteria_type', 'criteria_threshold')
    list_filter = ('criteria_type',)
    search_fields = ('name',)
    ordering = ('criteria_type', 'criteria_threshold')


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ('user', 'badge', 'awarded_at')
    list_filter = ('badge',)
    search_fields = ('user__email', 'user__username', 'badge__name')
    ordering = ('-awarded_at',)
    raw_id_fields = ('user',)


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'event_type', 'amount', 'story', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('user__email', 'user__username')
    ordering = ('-created_at',)
    raw_id_fields = ('user', 'story')
