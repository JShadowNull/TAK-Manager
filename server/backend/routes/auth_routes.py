from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import List

from backend.config.auth import (
    authenticate_user, 
    create_access_token,
    create_refresh_token,
    validate_refresh_token, 
    revoke_refresh_token,
    create_user,
    reset_password,
    remove_user,
    get_users,
    update_user_admin_status,
    admin_reset_user_password,
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
    is_admin: bool = False

class UsersList(BaseModel):
    users: List[str]

class UserDetails(BaseModel):
    username: str
    is_admin: bool

class UserDetailsList(BaseModel):
    users: List[UserDetails]

class RefreshRequest(BaseModel):
    refresh_token: str

class ResetPasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

class AddUserRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    confirm_password: str
    is_admin: bool = False

class RemoveUserRequest(BaseModel):
    username: str
    admin_password: str

class UpdateAdminStatusRequest(BaseModel):
    username: str
    admin_password: str
    is_admin: bool

class AdminResetPasswordRequest(BaseModel):
    username: str
    admin_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

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
            detail="A user already exists. Only one user is allowed during initial setup.",
        )
    
    user = create_user(signup_data.username, signup_data.password, is_admin=True)
    
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
    return {"username": current_user.username, "is_admin": current_user.is_admin}

@auth.get("/check-user-exists")
async def check_user_exists():
    return {"exists": user_exists()}

@auth.post("/reset-password")
async def handle_reset_password(
    reset_data: ResetPasswordRequest,
    current_user: User = Depends(get_current_active_user)
):
    # Validate that new password and confirm password match
    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
        )
    
    # Reset the password
    success = reset_password(
        current_user.username,
        reset_data.current_password,
        reset_data.new_password
    )
    
    return {"success": success}

@auth.post("/add-user")
async def handle_add_user(
    add_user_data: AddUserRequest,
    current_user: User = Depends(get_current_active_user)
):
    # Check if user has admin permissions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can add users",
        )
    
    # Validate that password and confirm password match
    if add_user_data.password != add_user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )
    
    # Create the new user
    try:
        new_user = create_user(
            add_user_data.username,
            add_user_data.password,
            is_admin=add_user_data.is_admin
        )
        return {"success": True, "username": new_user.username}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@auth.post("/remove-user")
async def handle_remove_user(
    remove_data: RemoveUserRequest,
    current_user: User = Depends(get_current_active_user)
):
    # Check if user has admin permissions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can remove users",
        )
    
    # Remove the user
    try:
        success = remove_user(
            current_user.username,
            remove_data.admin_password,
            remove_data.username
        )
        return {"success": success}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove user: {str(e)}"
        )

@auth.get("/users", response_model=UserDetailsList)
async def get_all_users(current_user: User = Depends(get_current_active_user)):
    """Get a list of all usernames in the system with their admin status"""
    # Check if user has admin permissions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view all users",
        )
    
    users = get_users()
    return {"users": [{"username": user.username, "is_admin": user.is_admin} for user in users]}

@auth.post("/update-admin-status")
async def handle_update_admin_status(
    update_status_data: UpdateAdminStatusRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Update a user's admin status"""
    # Check if user has admin permissions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update admin status",
        )
    
    # Update admin status
    try:
        success = update_user_admin_status(
            current_user.username,
            update_status_data.admin_password,
            update_status_data.username,
            update_status_data.is_admin
        )
        return {"success": success}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update admin status: {str(e)}"
        )

@auth.post("/admin-reset-password")
async def handle_admin_reset_password(
    reset_data: AdminResetPasswordRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Reset another user's password (admin operation)"""
    # Check if user has admin permissions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can reset other users' passwords",
        )
    
    # Validate that new password and confirm password match
    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
        )
    
    # Reset the password
    try:
        success = admin_reset_user_password(
            current_user.username,
            reset_data.admin_password,
            reset_data.username,
            reset_data.new_password
        )
        return {"success": success}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        ) 