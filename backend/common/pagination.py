from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10 # Default number of items per page
    page_size_query_param = 'page_size' # Allows the frontend to request more (e.g., ?page_size=50)
    max_page_size = 100 # Security limit so the frontend can't request 1,000,000 items at once