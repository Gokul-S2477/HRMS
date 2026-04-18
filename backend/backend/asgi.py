"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

django_asgi_application = get_asgi_application()

from chatbox.realtime import chat_websocket_application


async def application(scope, receive, send):
    if scope.get("type") == "websocket":
        await chat_websocket_application(scope, receive, send)
        return
    await django_asgi_application(scope, receive, send)
