from rest_framework.pagination import PageNumberPagination


class StoryPagination(PageNumberPagination):
    """
    Standard pagination for story list endpoints.

    Clients request pages via ?page=N. Page size can be overridden per-request
    up to max_page_size so that map and timeline views can fetch more items in
    a single request without hitting the default limit.
    """

    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100
