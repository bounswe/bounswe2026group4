from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/', include('apps.users.urls', namespace='users')),
    path('users/', include('apps.users.profile_urls')),
    path('', include('apps.interactions.urls', namespace='interactions')),
    path('', include('apps.notifications.urls', namespace='notifications')),
    path('', include('apps.gamification.urls', namespace='gamification')),
    path('', include('apps.media.urls', namespace='media')),
    path('stories/', include('apps.stories.urls', namespace='stories')),
    path('tags/', include('apps.tags.urls', namespace='tags')),
    path('moderation/', include([
        path('', include('apps.stories.admin_urls')),
        path('', include('apps.interactions.admin_urls')),
        path('', include('apps.reports.admin_urls')),
    ])),
]

if settings.DEBUG and 'debug_toolbar' in settings.INSTALLED_APPS:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns

if settings.DEBUG:                                                                                        
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)