import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings

def get_sanitized_db_url(url: str) -> str:
    if not url:
        return url
    # SQLAlchemy requires postgresql:// instead of postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    parsed = urllib.parse.urlparse(url)
    if parsed.query:
        query_params = urllib.parse.parse_qs(parsed.query)
        # Remove pgbouncer or other non-libpq query params that crash psycopg2
        query_params.pop("pgbouncer", None)
        new_query = urllib.parse.urlencode({k: v[0] for k, v in query_params.items()})
        parsed = parsed._replace(query=new_query)
        url = urllib.parse.urlunparse(parsed)
        
    return url

db_url = get_sanitized_db_url(settings.DATABASE_URL)

engine = create_engine(
    db_url,
    pool_size=10,
    max_overflow=20,
    pool_recycle=180,
    pool_pre_ping=True,
    pool_timeout=30
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

