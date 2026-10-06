import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_auth_register_and_login():
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Register a new user
        reg_payload = {
            "full_name": "Test User",
            "email": unique_email,
            "password": "SecurePassword123!"
        }
        res_reg = await ac.post("/api/auth/register", json=reg_payload)
        assert res_reg.status_code == 201, res_reg.text
        tokens = res_reg.json()
        assert "access_token" in tokens
        access_token = tokens["access_token"]

        # Fetch profile with token
        res_me = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert res_me.status_code == 200
        profile = res_me.json()
        assert profile["email"] == unique_email
        assert profile["full_name"] == "Test User"

        # Login with valid credentials
        login_payload = {
            "email": unique_email,
            "password": "SecurePassword123!"
        }
        res_login = await ac.post("/api/auth/login", json=login_payload)
        assert res_login.status_code == 200
        assert "access_token" in res_login.json()

        # Login with invalid password
        bad_login = {
            "email": unique_email,
            "password": "WrongPassword!"
        }
        res_bad = await ac.post("/api/auth/login", json=bad_login)
        assert res_bad.status_code == 401
