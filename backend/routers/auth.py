
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from fastapi.security import (
    OAuth2PasswordBearer,
    OAuth2PasswordRequestForm,
)

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

from database import get_db
from models.user import User

from schemas.user import (
    ShopOwnerRegister,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

# Admin Notification Helper
from services.notification_service import notify_all_admins


# =====================================
# AUTHENTICATION ROUTER
# =====================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# Swagger UI uses email + password.
# The form calls POST /auth/token.

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/token"
)


# =====================================
# GET CURRENT LOGGED-IN USER
# =====================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)

    if not payload:
        raise unauthorized

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)

    if not user or not user.is_active:
        raise unauthorized

    if (
        user.role == "shop_owner"
        and user.approval_status != "approved"
    ):
        raise HTTPException(
            status_code=403,
            detail="Shop owner account is not approved",
        )

    return user


# =====================================
# CREATE CUSTOMER OR SHOP OWNER
# =====================================

def create_user(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    role: str,
    shop_name=None,
    phone=None,
    address=None,
    approval_status=None,
):
    normalized_email = email.strip().lower()

    existing_user = db.scalar(
        select(User).where(
            User.email == normalized_email
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    user = User(
        full_name=full_name.strip(),
        email=normalized_email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        shop_name=shop_name,
        phone=phone,
        address=address,
        approval_status=approval_status,
    )

    try:
        db.add(user)

        # Generate User ID before notifications
        db.flush()

        # =====================================
        # ADMIN NOTIFICATION
        # NEW SHOP OWNER REGISTRATION
        # =====================================

        if role == "shop_owner":
            notify_all_admins(
                db=db,
                title="New Shop Owner Registration",
                message=(
                    f"{user.shop_name or user.full_name} "
                    "has registered as a partner shop "
                    "and is waiting for admin approval."
                ),
            )

        # Save user and notifications together
        db.commit()
        db.refresh(user)

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from error

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create user account.",
        ) from error

    return user


# =====================================
# CUSTOMER REGISTRATION
# =====================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_customer(
    data: UserRegister,
    db: Session = Depends(get_db),
):
    return create_user(
        db=db,
        full_name=data.full_name,
        email=str(data.email),
        password=data.password,
        role="customer",
    )


# =====================================
# SHOP OWNER REGISTRATION
# =====================================

@router.post(
    "/shop-owner/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_shop_owner(
    data: ShopOwnerRegister,
    db: Session = Depends(get_db),
):
    return create_user(
        db=db,
        full_name=data.full_name,
        email=str(data.email),
        password=data.password,
        role="shop_owner",
        shop_name=data.shop_name.strip(),
        phone=data.phone.strip(),
        address=data.address.strip(),
        approval_status="pending",
    )


# =====================================
# SHARED LOGIN VALIDATION
# =====================================

def authenticate_user(
    db: Session,
    email: str,
    password: str,
):
    normalized_email = email.strip().lower()

    user = db.scalar(
        select(User).where(
            User.email == normalized_email
        )
    )

    if (
        user is None
        or not user.hashed_password
        or not verify_password(
            password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive",
        )

    if (
        user.role == "shop_owner"
        and user.approval_status != "approved"
    ):
        raise HTTPException(
            status_code=403,
            detail="Shop owner approval is pending or rejected",
        )

    return user


# =====================================
# JSON LOGIN FOR REACT FRONTEND
# =====================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    data: UserLogin,
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db=db,
        email=str(data.email),
        password=data.password,
    )

    return TokenResponse(
        access_token=create_access_token(user.id),
        token_type="bearer",
    )


# =====================================
# SWAGGER EMAIL + PASSWORD LOGIN
# =====================================

@router.post(
    "/token",
    response_model=TokenResponse,
)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Swagger calls the email field "username".

    user = authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )

    return TokenResponse(
        access_token=create_access_token(user.id),
        token_type="bearer",
    )


# =====================================
# GET LOGGED-IN USER PROFILE
# =====================================

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user
