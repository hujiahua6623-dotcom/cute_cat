from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from cute_cat.config import Settings, get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_session_factory_override: async_sessionmaker[AsyncSession] | None = None


def reset_engine() -> None:
    """Clear cached engine (tests or config reload)."""
    global _engine, _session_factory, _session_factory_override
    _engine = None
    _session_factory = None
    _session_factory_override = None


def set_session_factory_override(factory: async_sessionmaker[AsyncSession] | None) -> None:
    """Test hook: force all code paths (including WebSocket) to use this factory."""
    global _session_factory_override
    _session_factory_override = factory


def _ensure_engine(settings: Settings) -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return _engine


def session_factory(settings: Settings) -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory_override is not None:
        return _session_factory_override
    if _session_factory is None:
        engine = _ensure_engine(settings)
        _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    settings = get_settings()
    factory = session_factory(settings)
    async with factory() as session:
        yield session
