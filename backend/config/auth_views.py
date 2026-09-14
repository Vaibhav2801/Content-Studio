from __future__ import annotations

import json
from json import JSONDecodeError

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.debug import sensitive_post_parameters

from prospecting.models import Workspace, WorkspaceMembership


def _payload(request):
    if len(request.body) > 16384:
        return None
    try:
        value = json.loads(request.body)
    except (JSONDecodeError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _session_data(user):
    if not user.is_authenticated:
        return {"authenticated": False, "user": None, "workspace": None}
    membership = (
        WorkspaceMembership.objects.select_related("workspace")
        .filter(user=user, is_active=True)
        .first()
    )
    if membership is None:
        membership = (
            WorkspaceMembership.objects.select_related("workspace")
            .filter(user=user)
            .first()
        )
    return {
        "authenticated": True,
        "user": {
            "id": str(user.pk),
            "email": user.email,
            "name": user.get_full_name() or user.email,
        },
        "workspace": {"id": str(membership.workspace_id), "name": membership.workspace.name} if membership else None,
    }


def _ensure_workspace(user, name):
    if WorkspaceMembership.objects.filter(user=user).exists():
        return
    workspace = Workspace.objects.create(name=name[:255] or "My workspace")
    WorkspaceMembership.objects.create(
        workspace=workspace, user=user, role=WorkspaceMembership.OWNER, is_active=True,
    )


@require_GET
@never_cache
@ensure_csrf_cookie
def session_view(request):
    return JsonResponse({**_session_data(request.user), "csrf_token": get_token(request)})


@require_POST
@never_cache
@csrf_protect
@sensitive_post_parameters("password")
def signup_view(request):
    data = _payload(request)
    if data is None:
        return JsonResponse({"detail": "Send a valid JSON request."}, status=400)
    name = data.get("name") if isinstance(data.get("name"), str) else ""
    name = name.strip()
    email = data.get("email") if isinstance(data.get("email"), str) else ""
    email = email.strip().lower()
    password = data.get("password", "")
    workspace_name = data.get("workspace_name") if isinstance(data.get("workspace_name"), str) else ""
    workspace_name = workspace_name.strip()
    if not name or len(name) > 150:
        return JsonResponse({"name": ["Enter your name (up to 150 characters)."]}, status=400)
    if not email or len(email) > 150:
        return JsonResponse({"email": ["Enter an email address of up to 150 characters."]}, status=400)
    try:
        from django.core.validators import validate_email
        validate_email(email)
    except ValidationError:
        return JsonResponse({"email": ["Enter a valid email address."]}, status=400)
    if not isinstance(password, str) or len(password) > 1024:
        return JsonResponse({"password": ["Enter a valid password."]}, status=400)
    if len(workspace_name) > 255:
        return JsonResponse({"workspace_name": ["Use up to 255 characters."]}, status=400)
    User = get_user_model()
    if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username=email).exists():
        return JsonResponse({"email": ["An account with this email already exists."]}, status=400)
    user = User(username=email, email=email)
    parts = name.split(None, 1)
    user.first_name = parts[0][:150]
    user.last_name = parts[1][:150] if len(parts) > 1 else ""
    try:
        validate_password(password, user=user)
    except ValidationError as error:
        return JsonResponse({"password": error.messages}, status=400)
    try:
        with transaction.atomic():
            user.set_password(password)
            user.save()
            _ensure_workspace(user, workspace_name or f"{user.first_name}'s workspace")
    except IntegrityError:
        return JsonResponse({"email": ["An account with this email already exists."]}, status=400)
    login(request, user)
    return JsonResponse({**_session_data(user), "csrf_token": get_token(request)}, status=201)


@require_POST
@never_cache
@csrf_protect
@sensitive_post_parameters("password")
def signin_view(request):
    data = _payload(request)
    if data is None:
        return JsonResponse({"detail": "Send a valid JSON request."}, status=400)
    email = data.get("email") if isinstance(data.get("email"), str) else ""
    email = email.strip().lower()
    password = data.get("password", "")
    if not email or not isinstance(password, str) or not password:
        return JsonResponse({"detail": "Enter your email and password."}, status=400)
    User = get_user_model()
    candidate = User.objects.filter(email__iexact=email).first()
    user = authenticate(request, username=candidate.get_username() if candidate else email, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid email or password."}, status=401)
    with transaction.atomic():
        _ensure_workspace(user, f"{user.first_name or 'My'} workspace")
    login(request, user)
    return JsonResponse({**_session_data(user), "csrf_token": get_token(request)})


@require_POST
@never_cache
@csrf_protect
def signout_view(request):
    logout(request)
    return JsonResponse({**_session_data(request.user), "csrf_token": get_token(request)})
