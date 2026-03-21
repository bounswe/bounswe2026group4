from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Normalizes all DRF error responses to a consistent envelope:
      { "success": false, "message": "<human-readable>", "errors": { ... } }

    This ensures the frontend always receives the same shape regardless of
    whether the error is a validation error, auth failure, or permission denial.
    """
    response = exception_handler(exc, context)

    if response is None:
        # Non-DRF exceptions (e.g. unhandled 500s) are not touched here
        return None

    original_data = response.data
    errors = {}
    message = 'An error occurred.'

    if isinstance(original_data, dict):
        if 'detail' in original_data:
            # Auth/permission errors from DRF come as {"detail": "..."}
            message = str(original_data['detail'])
        else:
            # Serializer validation errors: {"field": ["msg1", "msg2"], ...}
            errors = original_data
            # Surface the first error message as the top-level message
            first_field = next(iter(errors))
            first_error = errors[first_field]
            if isinstance(first_error, list) and first_error:
                message = str(first_error[0])
            else:
                message = str(first_error)
    elif isinstance(original_data, list):
        # Non-field errors arrive as a flat list
        errors = {'non_field_errors': original_data}
        message = str(original_data[0]) if original_data else 'Error.'

    response.data = {
        'success': False,
        'message': message,
        'errors': errors,
    }

    return response
