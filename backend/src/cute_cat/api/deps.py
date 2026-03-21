from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.config import Settings, get_settings
from cute_cat.persistence.database import get_session
from cute_cat.persistence.models import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_session)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    user = await session.get(User, sub)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
