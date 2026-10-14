from fastapi import APIRouter, Depends, HTTPException, Response

from .. import queries
from ..db import Db
from ..deps import current_user
from ..schemas import EmailIn, LoginIn, RegisterIn, ResetPasswordIn, VerifyCodeIn
from ..supa import admin_client, public_client

router = APIRouter(prefix="/auth", tags=["auth"])


def session_for(db, email: str, password: str) -> dict:
    try:
        res = public_client().auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        raise HTTPException(401, "Incorrect email or password")

    user = queries.profile(db, res.user.id)
    if not user:
        raise HTTPException(401, "Account not found")
    return {"access_token": res.session.access_token, "user": user}


@router.post("/login")
def login(db: Db, body: LoginIn):
    return session_for(db, body.email.strip(), body.password)


@router.post("/register")
def register(db: Db, body: RegisterIn):
    email = body.email.strip().lower()
    if db.execute('select 1 from "user" where lower(email) = %s', (email,)).fetchone():
        raise HTTPException(400, "An account with this email already exists")

    try:
        # created as already confirmed so they can log in right away
        res = admin_client().auth.admin.create_user(
            {"email": email, "password": body.password, "email_confirm": True}
        )
    except Exception as e:
        raise HTTPException(400, str(e) or "Could not create account")

    try:
        customer_role = db.execute("select user_role_id from user_role where user_role = 'customer'").fetchone()
        db.execute(
            """
            insert into "user" (user_id, user_role_id, full_name, birthdate, email, mobile_no)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (res.user.id, customer_role["user_role_id"], body.full_name.strip(), body.birthdate, email, body.mobile_no),
        )
        db.commit()
    except Exception:
        # don't leave a login with no profile behind
        db.rollback()
        admin_client().auth.admin.delete_user(res.user.id)
        raise
    return session_for(db, email, body.password)


@router.post("/logout", status_code=204)
def logout():
    # tokens are dropped on the frontend
    return Response(status_code=204)


@router.get("/me")
def me(user=Depends(current_user)):
    return user


# Forgot password: Supabase emails a 6 digit code (the "Reset Password" email template must show {{ .Token }}).
# verify-code checks it and gives back a short-lived reset_token used to set the new password.


@router.post("/forgot-password", status_code=204)
def forgot_password(db: Db, body: EmailIn):
    email = body.email.strip().lower()
    if not db.execute('select 1 from "user" where lower(email) = %s', (email,)).fetchone():
        raise HTTPException(404, "No account found with that email")
    try:
        public_client().auth.reset_password_for_email(email)
    except Exception:
        raise HTTPException(429, "Please wait a minute before asking for another code")
    return Response(status_code=204)


@router.post("/verify-code")
def verify_code(body: VerifyCodeIn):
    try:
        res = public_client().auth.verify_otp(
            {"email": body.email.strip().lower(), "token": body.code.strip(), "type": "recovery"}
        )
    except Exception:
        raise HTTPException(400, "Invalid or expired code")
    return {"reset_token": res.session.access_token}


@router.post("/reset-password", status_code=204)
def reset_password(body: ResetPasswordIn):
    try:
        res = admin_client().auth.get_user(body.reset_token)
        admin_client().auth.admin.update_user_by_id(res.user.id, {"password": body.new_password})
    except Exception:
        raise HTTPException(400, "This reset link has expired, please request a new code")
    return Response(status_code=204)
