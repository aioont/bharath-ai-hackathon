from __future__ import annotations
import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ── crypto ────────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# ── DB helpers ────────────────────────────────────────────────────────────────
def _get_conn():
    import psycopg2
    import psycopg2.extras
    return psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)


def _ensure_users_table():
    ddl = """
    CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verification_code TEXT,
        verification_code_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        state TEXT,
        district TEXT,
        farming_type TEXT,
        language TEXT
    );
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(ddl)
            conn.commit()
        logger.info("users table ready")
    except Exception as e:
        logger.warning(f"users table setup failed: {e}")


try:
    _ensure_users_table()
except Exception:
    pass


# ── pydantic models ───────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_verified: bool
    created_at: str
    state: Optional[str] = None
    district: Optional[str] = None
    farming_type: Optional[str] = None
    language: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    farming_type: Optional[str] = None
    language: Optional[str] = None


# ── JWT helpers ───────────────────────────────────────────────────────────────
def _create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_current_user_id(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """Return user_id from Bearer token, or None if no token provided."""
    if creds is None:
        return None
    payload = _decode_token(creds.credentials)
    return payload.get("sub")


def require_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """Return user_id or raise 401."""
    user_id = get_current_user_id(creds)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


# ── Resend email ──────────────────────────────────────────────────────────────
async def _send_verification_email(to_email: str, full_name: str, code: str):
    """Send a 6-digit verification code via Resend."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email send (code printed to log)")
        logger.warning(f"[DEV] *** Verification code for {to_email}: {code} ***")
        print(f"\n[DEV] Email: {to_email}  |  Verification code: {code}\n")
        return

    name = full_name or to_email.split("@")[0]
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px">
      <h2 style="color:#166534">🌾 AgriSaarthi</h2>
      <p>Hello <strong>{name}</strong>,</p>
      <p>Your email verification code is:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                  background:#fff;padding:20px;border-radius:8px;border:2px dashed #16a34a;
                  margin:24px 0;color:#166534">{code}</div>
      <p>This code expires in <strong>15 minutes</strong>.</p>
      <p style="color:#6b7280;font-size:12px">If you did not request this, please ignore this email.</p>
    </div>
    """

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": "AgriSaarthi <send@makeasite.in>",
                "to": [to_email],
                "subject": f"Your verification code: {code}",
                "html": html_body,
            },
        )
        if resp.status_code not in (200, 201):
            logger.error(f"Resend error: {resp.status_code} {resp.text}")
        else:
            logger.info(f"Verification email sent to {to_email}")


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
async def signup(body: SignupRequest):
    """Register a new user and send a verification email."""
    email = body.email.lower().strip()

    # bcrypt silently truncates at 72 bytes — enforce the limit explicitly
    if len(body.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be 72 characters or fewer.",
        )
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                existing = cur.fetchone()

                if existing:
                    # If already registered but not verified, resend code
                    cur.execute("SELECT is_verified FROM users WHERE email = %s", (email,))
                    row = cur.fetchone()
                    if row and row[0]:
                        raise HTTPException(status_code=409, detail="Email already registered. Please log in.")
                    # Resend verification code
                    code = _generate_code()
                    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
                    cur.execute(
                        "UPDATE users SET verification_code=%s, verification_code_expires_at=%s WHERE email=%s",
                        (code, expires, email)
                    )
                    conn.commit()
                    await _send_verification_email(email, body.full_name or "", code)
                    return {"message": "Verification code resent. Please check your email."}

                password_hash = pwd_context.hash(body.password)
                code = _generate_code()
                expires = datetime.now(timezone.utc) + timedelta(minutes=15)

                cur.execute(
                    """INSERT INTO users (email, password_hash, full_name, verification_code, verification_code_expires_at)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (email, password_hash, body.full_name, code, expires)
                )
            conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Could not create account. Please try again.")

    await _send_verification_email(email, body.full_name or "", code)
    return {"message": "Account created! Check your email for a 6-digit verification code."}


@router.post("/verify")
async def verify_email(body: VerifyRequest):
    """Verify the email with the 6-digit code."""
    email = body.email.lower().strip()
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                user = cur.fetchone()

                if not user:
                    raise HTTPException(status_code=404, detail="User not found.")

                if user["is_verified"]:
                    raise HTTPException(status_code=400, detail="Email already verified.")

                if not user["verification_code"] or user["verification_code"] != body.code:
                    raise HTTPException(status_code=400, detail="Invalid verification code.")

                expires = user["verification_code_expires_at"]
                if expires and expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

                cur.execute(
                    "UPDATE users SET is_verified=TRUE, verification_code=NULL, verification_code_expires_at=NULL WHERE email=%s RETURNING *",
                    (email,)
                )
                updated = cur.fetchone()
            conn.commit()

        token = _create_access_token(str(updated["id"]), updated["email"])
        return AuthResponse(
            access_token=token,
            user={
                "id": str(updated["id"]),
                "email": updated["email"],
                "full_name": updated["full_name"],
                "is_verified": True,
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed.")


@router.post("/login")
async def login(body: LoginRequest):
    """Login with email and password, returns a JWT."""
    email = body.email.lower().strip()

    # bcrypt 72-byte guard — avoids passlib raising an error during verify()
    if len(body.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                user = cur.fetchone()
    except Exception as e:
        logger.error(f"Login DB error: {e}")
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user["is_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in.")

    token = _create_access_token(str(user["id"]), user["email"])
    return AuthResponse(
        access_token=token,
        user={
            "id": str(user["id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "is_verified": True,
        }
    )


@router.get("/me", response_model=UserOut)
async def get_me(user_id: str = Depends(require_current_user)):
    """Get the current authenticated user's profile."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
    except Exception as e:
        logger.error(f"Get me DB error: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch user.")

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserOut(
        id=str(user["id"]),
        state=user.get("state"),
        district=user.get("district"),
        farming_type=user.get("farming_type"),
        language=user.get("language"),
    )


@router.put("/profile", response_model=UserOut)
async def update_profile(body: ProfileUpdate, user_id: str = Depends(require_current_user)):
    """Update the current user's profile."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Build dynamic update query
                updates = []
                params = []
                if body.full_name is not None:
                    updates.append("full_name = %s")
                    params.append(body.full_name)
                if body.state is not None:
                    updates.append("state = %s")
                    params.append(body.state)
                if body.district is not None:
                    updates.append("district = %s")
                    params.append(body.district)
                if body.farming_type is not None:
                    updates.append("farming_type = %s")
                    params.append(body.farming_type)
                if body.language is not None:
                    updates.append("language = %s")
                    params.append(body.language)
                
                if updates:
                    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING *"
                    params.append(user_id)
                    cur.execute(query, tuple(params))
                    user = cur.fetchone()
                else:
                    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                    user = cur.fetchone()

            conn.commit()
    except Exception as e:
        logger.error(f"Update profile DB error: {e}")
        raise HTTPException(status_code=500, detail="Could not update profile.")

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserOut(
        id=str(user["id"]),
        email=user["email"],
        full_name=user["full_name"],
        is_verified=user["is_verified"],
        created_at=user["created_at"].isoformat() if hasattr(user["created_at"], "isoformat") else str(user["created_at"]),
        state=user.get("state"),
        district=user.get("district"),
        farming_type=user.get("farming_type"),
        language=user.get("language"),
    )


@router.post("/resend-verification")
async def resend_verification(body: dict):
    """Resend a verification code to the given email."""
    email = str(body.get("email", "")).lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                user = cur.fetchone()
                if not user:
                    raise HTTPException(status_code=404, detail="Email not registered.")
                if user["is_verified"]:
                    raise HTTPException(status_code=400, detail="Email is already verified.")
                code = _generate_code()
                expires = datetime.now(timezone.utc) + timedelta(minutes=15)
                cur.execute(
                    "UPDATE users SET verification_code=%s, verification_code_expires_at=%s WHERE email=%s",
                    (code, expires, email)
                )
            conn.commit()
        await _send_verification_email(email, user.get("full_name") or "", code)
        return {"message": "Verification code sent to your email."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend verification error: {e}")
        raise HTTPException(status_code=500, detail="Could not resend code.")
