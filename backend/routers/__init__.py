# Backend Routers Module
# This file exports all routers for the FamFocus Hub application

from .auth import router as auth_router
from .chores import router as chores_router
from .achievements import router as achievements_router
from .goals import router as goals_router
from .family import router as family_router

__all__ = [
    'auth_router',
    'chores_router', 
    'achievements_router',
    'goals_router',
    'family_router',
]
