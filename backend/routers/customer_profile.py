
from pathlib import Path
from uuid import uuid4
from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
)

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from PIL import Image, UnidentifiedImageError

from database import get_db
from models.user import User
from routers.auth import get_current_user


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/customer/profile",
    tags=["Customer Profile"],
)


# ==========================================
# PROFILE PHOTO CONFIGURATION
# ==========================================

# Resolve relative to the backend directory.
BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads" / "profile_photos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

IMAGE_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


# ==========================================
# SCHEMAS
# ==========================================

class CustomerProfileUpdate(BaseModel):
    full_name: str = Field(
        min_length=2,
        max_length=100,
    )

    email: EmailStr

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    address: str | None = Field(
        default=None,
        max_length=500,
    )


class CustomerProfileResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str

    phone: str | None = None
    address: str | None = None

    profile_photo: str | None = None

    model_config = ConfigDict(
        from_attributes=True
    )


class ProfilePhotoResponse(BaseModel):
    message: str
    profile_photo: str | None = None


# ==========================================
# CUSTOMER ACCESS VALIDATION
# ==========================================

def require_customer(current_user: User):
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access only",
        )


# ==========================================
# HELPER: DELETE STORED PHOTO
# ==========================================

def delete_stored_photo(photo_url: str | None):
    if not photo_url:
        return

    prefix = "/uploads/profile_photos/"

    if not photo_url.startswith(prefix):
        return

    filename = photo_url.removeprefix(prefix)

    # Only delete files directly inside our upload folder.
    if not filename or Path(filename).name != filename:
        return

    photo_path = UPLOAD_DIR / filename

    try:
        photo_path.unlink(missing_ok=True)
    except OSError:
        # The database operation has already succeeded.
        # A failed cleanup should not break the response.
        pass


# ==========================================
# GET CUSTOMER PROFILE
# GET /customer/profile/me
# ==========================================

@router.get(
    "/me",
    response_model=CustomerProfileResponse,
)
def get_customer_profile(
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    return current_user


# ==========================================
# UPDATE CUSTOMER PROFILE
# PUT /customer/profile/me
# ==========================================

@router.put(
    "/me",
    response_model=CustomerProfileResponse,
)
def update_customer_profile(
    payload: CustomerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    full_name = payload.full_name.strip()
    email = str(payload.email).strip().lower()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=422,
            detail="Full name must contain at least 2 characters",
        )

    existing_user = (
        db.query(User)
        .filter(
            func.lower(User.email) == email,
            User.id != current_user.id,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    current_user.full_name = full_name
    current_user.email = email

    current_user.phone = (
        payload.phone.strip()
        if payload.phone
        else None
    )

    current_user.address = (
        payload.address.strip()
        if payload.address
        else None
    )

    try:
        db.commit()
        db.refresh(current_user)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update profile",
        )

    return current_user


# ==========================================
# UPLOAD / CHANGE PROFILE PHOTO
# POST /customer/profile/photo
# ==========================================

@router.post(
    "/photo",
    response_model=ProfilePhotoResponse,
)
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    # Step 1: Validate MIME type.
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed",
        )

    # Step 2: Read at most 2 MB + 1 byte.
    try:
        content = await file.read(MAX_FILE_SIZE + 1)
    finally:
        await file.close()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Profile photo must be 2 MB or smaller",
        )

    # Step 3: Validate actual image contents.
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()

        with Image.open(BytesIO(content)) as image:
            image_format = image.format

            if image_format not in IMAGE_EXTENSIONS:
                raise ValueError("Unsupported image format")

            if image_format != ALLOWED_IMAGE_TYPES[file.content_type]:
                raise ValueError("Image type does not match file content")

            # Limit decompression / pixel abuse.
            if image.width * image.height > 20_000_000:
                raise ValueError("Image dimensions are too large")

            # Decode and re-encode the image, avoiding
            # retention of unnecessary uploaded metadata.
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            else:
                image = image.copy()

            if image_format == "JPEG" and image.mode == "RGBA":
                image = image.convert("RGB")

            output = BytesIO()

            image.save(
                output,
                format=image_format,
            )

            cleaned_content = output.getvalue()

    except (
        UnidentifiedImageError,
        ValueError,
        OSError,
        Image.DecompressionBombError,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported image file",
        )

    # Step 4: Generate a unique filename.
    extension = IMAGE_EXTENSIONS[image_format]

    filename = f"{uuid4().hex}{extension}"

    file_path = UPLOAD_DIR / filename

    photo_url = (
        f"/uploads/profile_photos/{filename}"
    )

    # Step 5: Save photo.
    try:
        file_path.write_bytes(cleaned_content)
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Unable to store profile photo",
        )

    # Step 6: Update database.
    old_photo = current_user.profile_photo

    current_user.profile_photo = photo_url

    try:
        db.commit()
        db.refresh(current_user)

    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Unable to save profile photo",
        )

    # Step 7: Remove old photo after successful update.
    if old_photo and old_photo != photo_url:
        delete_stored_photo(old_photo)

    return {
        "message": "Profile photo uploaded successfully",
        "profile_photo": current_user.profile_photo,
    }


# ==========================================
# REMOVE PROFILE PHOTO
# DELETE /customer/profile/photo
# ==========================================

@router.delete(
    "/photo",
    response_model=ProfilePhotoResponse,
)
def remove_profile_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_customer(current_user)

    old_photo = current_user.profile_photo

    if not old_photo:
        return {
            "message": "No profile photo to remove",
            "profile_photo": None,
        }

    current_user.profile_photo = None

    try:
        db.commit()
        db.refresh(current_user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to remove profile photo",
        )

    delete_stored_photo(old_photo)

    return {
        "message": "Profile photo removed successfully",
        "profile_photo": None,
    }
