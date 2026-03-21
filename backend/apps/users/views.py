from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserResponseSerializer,
)
from apps.users.services import login_user, logout_user, register_user


class RegisterView(APIView):
    # Guests must be able to register — no authentication required (req. 1.1.1.7)
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


class LoginView(APIView):
    permission_classes = [AllowAny]

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
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        logout_user(serializer.validated_data['refresh'])
        return Response(status=status.HTTP_204_NO_CONTENT)
