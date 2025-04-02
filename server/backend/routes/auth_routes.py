from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from backend.config.auth import (
    authenticate_user, 
    create_access_token,
    create_refresh_token,
    validate_refresh_token, 
    revoke_refresh_token,
    create_user,
    get_current_active_user,
    user_exists,
    User,
    Token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

auth = APIRouter()

class SignupRequest(BaseModel):
    username: str
    password: str

class UserInfo(BaseModel):
    username: str

class RefreshRequest(BaseModel):
    refresh_token: str

@auth.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Create refresh token
    refresh_token = create_refresh_token(user.username)
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@auth.post("/refresh", response_model=Token)
async def refresh_access_token(refresh_request: RefreshRequest):
    username = validate_refresh_token(refresh_request.refresh_token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token or refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username}, expires_delta=access_token_expires
    )
    
    # Create new refresh token
    new_refresh_token = create_refresh_token(username)
    
    # Revoke old refresh token for security
    revoke_refresh_token(refresh_request.refresh_token)
    
    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}

@auth.post("/logout")
async def logout(refresh_token: str = Body(..., embed=True)):
    success = revoke_refresh_token(refresh_token)
    return {"success": success}

@auth.post("/signup", response_model=Token)
async def signup(signup_data: SignupRequest):
    if user_exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user already exists. Only one user is allowed.",
        )
    
    user = create_user(signup_data.username, signup_data.password)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Create refresh token
    refresh_token = create_refresh_token(user.username)
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@auth.get("/me", response_model=UserInfo)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return {"username": current_user.username}

@auth.get("/check-user-exists")
async def check_user_exists():
    return {"exists": user_exists()} 