import os
import json
from datetime import datetime, timedelta
from typing import Optional, List
import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel
import pathlib
import uuid

# Path for storing user credentials
USERS_DATA_FILE = pathlib.Path(os.path.join(os.path.dirname(__file__), "..", "data", "users.json"))
# Path for storing refresh tokens
REFRESH_TOKENS_FILE = pathlib.Path(os.path.join(os.path.dirname(__file__), "..", "data", "refresh_tokens.json"))

# Create data directory if it doesn't exist
os.makedirs(USERS_DATA_FILE.parent, exist_ok=True)

# JWT Settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a-very-secure-secret-key-that-should-be-changed")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15 minutes is standard for access tokens
REFRESH_TOKEN_EXPIRE_DAYS = 7     # 7 days is standard for refresh tokens

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

# Models
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    token_type: Optional[str] = None

class User(BaseModel):
    username: str
    disabled: Optional[bool] = None
    is_admin: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class RefreshToken(BaseModel):
    token_id: str
    username: str
    expires_at: datetime
    revoked: bool = False

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_users() -> List[UserInDB]:
    """Get all users from the users file"""
    if not USERS_DATA_FILE.exists():
        return []
    
    try:
        with open(USERS_DATA_FILE, "r") as f:
            users_data = json.load(f)
            return [UserInDB(**user) for user in users_data]
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def get_user(username: str) -> Optional[UserInDB]:
    """Get a specific user by username"""
    try:
        users = get_users()
        for user in users:
            if user.username == username:
                return user
        return None
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

def save_users(users: List[dict]):
    """Save users list to the file"""
    with open(USERS_DATA_FILE, "w") as f:
        json.dump(users, f)

def create_user(username: str, password: str, is_admin: bool = False):
    """Create a new user and add to the users file"""
    # Get existing users
    users = get_users()
    user_dicts = [user.dict() for user in users]
    
    # Check if username already exists
    if any(user.username == username for user in users):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create new user
    user_data = {
        "username": username,
        "hashed_password": get_password_hash(password),
        "disabled": False,
        "is_admin": is_admin
    }
    
    # If this is the first user, make them an admin
    if not users:
        user_data["is_admin"] = True
    
    # Add to list and save
    user_dicts.append(user_data)
    save_users(user_dicts)
    
    return UserInDB(**user_data)

def reset_password(username: str, current_password: str, new_password: str):
    """Reset a user's password"""
    # Authenticate current credentials
    user = authenticate_user(username, current_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password",
        )
    
    # Get all users
    users = get_users()
    user_dicts = [user.dict() for user in users]
    
    # Update password for the matching user
    for user_dict in user_dicts:
        if user_dict["username"] == username:
            user_dict["hashed_password"] = get_password_hash(new_password)
            break
    
    # Save updated users
    save_users(user_dicts)
    return True

def remove_user(admin_username: str, admin_password: str, username_to_remove: str):
    """Remove a user (admin operation)"""
    # Authenticate admin
    admin_user = authenticate_user(admin_username, admin_password)
    if not admin_user or not admin_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    
    # Don't allow removing the current admin user
    if admin_username == username_to_remove:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own account",
        )
    
    # Get all users
    users = get_users()
    user_dicts = [user.dict() for user in users]
    
    # Check if user to remove exists
    if not any(user.username == username_to_remove for user in users):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Filter out the user to remove
    updated_users = [user for user in user_dicts if user["username"] != username_to_remove]
    
    # Save updated users
    save_users(updated_users)
    return True

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(username: str):
    token_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Store refresh token in file
    refresh_tokens = []
    if REFRESH_TOKENS_FILE.exists():
        try:
            with open(REFRESH_TOKENS_FILE, "r") as f:
                refresh_tokens = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            refresh_tokens = []
    
    # Clean up expired tokens
    current_time = datetime.utcnow()
    refresh_tokens = [
        token for token in refresh_tokens 
        if datetime.fromisoformat(token["expires_at"]) > current_time and not token.get("revoked", False)
    ]
    
    # Add new token
    refresh_tokens.append({
        "token_id": token_id,
        "username": username,
        "expires_at": expires_at.isoformat(),
        "revoked": False
    })
    
    with open(REFRESH_TOKENS_FILE, "w") as f:
        json.dump(refresh_tokens, f)
    
    # Create JWT with token_id
    to_encode = {
        "sub": username,
        "jti": token_id,
        "type": "refresh",
        "exp": expires_at
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def validate_refresh_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        token_id = payload.get("jti")
        token_type = payload.get("type")
        
        if not username or not token_id or token_type != "refresh":
            return None
            
        # Check if token exists and is not revoked
        if not REFRESH_TOKENS_FILE.exists():
            return None
            
        with open(REFRESH_TOKENS_FILE, "r") as f:
            refresh_tokens = json.load(f)
            
        for stored_token in refresh_tokens:
            if (stored_token["token_id"] == token_id and 
                stored_token["username"] == username and 
                not stored_token.get("revoked", False) and 
                datetime.fromisoformat(stored_token["expires_at"]) > datetime.utcnow()):
                return username
                
        return None
    except jwt.PyJWTError:
        return None

def revoke_refresh_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_id = payload.get("jti")
        
        if not token_id:
            return False
            
        if not REFRESH_TOKENS_FILE.exists():
            return False
            
        with open(REFRESH_TOKENS_FILE, "r") as f:
            refresh_tokens = json.load(f)
            
        for stored_token in refresh_tokens:
            if stored_token["token_id"] == token_id:
                stored_token["revoked"] = True
                
        with open(REFRESH_TOKENS_FILE, "w") as f:
            json.dump(refresh_tokens, f)
            
        return True
    except jwt.PyJWTError:
        return False

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None:
            raise credentials_exception
        if token_type != "access":
            raise credentials_exception
            
        token_data = TokenData(username=username, token_type=token_type)
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = get_user(token_data.username)
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def user_exists():
    """Check if any user exists in the system"""
    # Check for users in the new format
    users = get_users()
    if len(users) > 0:
        return True
    
    # Check for legacy user data
    old_user_file = pathlib.Path(os.path.join(os.path.dirname(__file__), "..", "data", "user.json"))
    if old_user_file.exists():
        # If old user file exists but hasn't been migrated yet
        migrate_old_user_data()
        return True
        
    return False

# Migrate old user data if needed
def migrate_old_user_data():
    """Migrate data from the old user.json file to the new users.json format"""
    old_user_file = pathlib.Path(os.path.join(os.path.dirname(__file__), "..", "data", "user.json"))
    if old_user_file.exists() and not USERS_DATA_FILE.exists():
        try:
            with open(old_user_file, "r") as f:
                user_data = json.load(f)
                # Add is_admin flag
                user_data["is_admin"] = True
                # Save to new format
                save_users([user_data])
            print(f"Migrated user data from {old_user_file} to {USERS_DATA_FILE}")
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error migrating user data: {e}")
            pass

# Force migration if necessary
def ensure_admin_privileges():
    """Make sure that the first user in the system has admin privileges"""
    users = get_users()
    if users:
        # Ensure the first user has admin privileges
        user_dicts = [user.dict() for user in users]
        if not user_dicts[0].get("is_admin"):
            user_dicts[0]["is_admin"] = True
            save_users(user_dicts)
            print(f"Updated first user to have admin privileges")

# Run migrations on import
migrate_old_user_data()
ensure_admin_privileges()

def update_user_admin_status(admin_username: str, admin_password: str, target_username: str, is_admin: bool):
    """Update a user's admin status (admin operation)"""
    # Authenticate admin
    admin_user = authenticate_user(admin_username, admin_password)
    if not admin_user or not admin_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    
    # Get all users
    users = get_users()
    user_dicts = [user.dict() for user in users]
    
    # Find the target user
    target_user_found = False
    for user_dict in user_dicts:
        if user_dict["username"] == target_username:
            # Don't allow removing admin from the last admin
            if not is_admin and user_dict.get("is_admin", False):
                # Check if this is the last admin
                admin_count = sum(1 for u in user_dicts if u.get("is_admin", False))
                if admin_count <= 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot remove admin privileges from the last admin user",
                    )
            
            # Update admin status
            user_dict["is_admin"] = is_admin
            target_user_found = True
            break
    
    if not target_user_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Save updated users
    save_users(user_dicts)
    return True

def admin_reset_user_password(admin_username: str, admin_password: str, target_username: str, new_password: str):
    """Reset another user's password (admin operation)"""
    # Authenticate admin
    admin_user = authenticate_user(admin_username, admin_password)
    if not admin_user or not admin_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )
    
    # Get all users
    users = get_users()
    user_dicts = [user.dict() for user in users]
    
    # Find the target user
    target_user_found = False
    for user_dict in user_dicts:
        if user_dict["username"] == target_username:
            user_dict["hashed_password"] = get_password_hash(new_password)
            target_user_found = True
            break
    
    if not target_user_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Save updated users
    save_users(user_dicts)
    return True 