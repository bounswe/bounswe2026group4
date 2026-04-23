from django.contrib import admin

from .models import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Admin view for Tag — supports search and filtering by predefined status."""

    list_display = ['name', 'is_predefined', 'story_count']
    list_filter = ['is_predefined']
    search_fields = ['name']
