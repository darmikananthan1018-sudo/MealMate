
from pathlib import Path
from uuid import uuid4
from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
)

from sqlalchemy.orm import Session
from PIL import Image, UnidentifiedImageError

from database import get_db
from models.user import User
from routers.auth import get_current_user


router = APIRouter(
    prefix="/shop-owner/profile",
    tags=["Shop Owner Images"],
)

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_ROOT = BASE_DIR / "uploads"

MAX_FILE_SIZE = 2 * 1024 * 1024

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

IMAGE_FIELDS = {
    "photo": ("profile_photo", "shop_owner_photos"),
    "logo": ("shop_logo", "shop_logos"),
    "cover": ("shop_cover_photo", "shop_covers"),
}


def require_shop_owner(user: User):
    if user.role != "shop_owner":
        raise HTTPException(
            status_code=403,
            detail="Shop owner access only",
        )


def delete_stored_image(image_url, folder_name):
    if not image_url:
        return

    prefix = f"/uploads/{folder_name}/"

    if not image_url.startswith(prefix):
        return

    filename = image_url.removeprefix(prefix)

    if not filename or Path(filename).name != filename:
        return

    image_path = UPLOAD_ROOT / folder_name / filename

    try:
        image_path.unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/images/{image_type}")
async def upload_shop_image(
    image_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    if image_type not in IMAGE_FIELDS:
        raise HTTPException(
            status_code=400,
            detail="Image type must be photo, logo or cover",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed",
        )

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
            detail="Image must be 2 MB or smaller",
        )

    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()

        with Image.open(BytesIO(content)) as image:
            image_format = image.format

            if image_format not in IMAGE_EXTENSIONS:
                raise ValueError("Unsupported image format")

            if image_format != ALLOWED_IMAGE_TYPES[file.content_type]:
                raise ValueError("Image type mismatch")

            if image.width * image.height > 20_000_000:
                raise ValueError("Image dimensions too large")

            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            else:
                image = image.copy()

            if image_format == "JPEG" and image.mode == "RGBA":
                image = image.convert("RGB")

            output = BytesIO()
            image.save(output, format=image_format)
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

    field_name, folder_name = IMAGE_FIELDS[image_type]

    upload_dir = UPLOAD_ROOT / folder_name
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{IMAGE_EXTENSIONS[image_format]}"

    file_path = upload_dir / filename
    image_url = f"/uploads/{folder_name}/{filename}"

    try:
        file_path.write_bytes(cleaned_content)
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Unable to store image",
        )

    old_image = getattr(current_user, field_name)

    setattr(current_user, field_name, image_url)

    try:
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Unable to save image",
        )

    if old_image and old_image != image_url:
        delete_stored_image(old_image, folder_name)

    return {
        "message": f"Shop {image_type} uploaded successfully",
        field_name: getattr(current_user, field_name),
    }


@router.delete("/images/{image_type}")
def remove_shop_image(
    image_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_shop_owner(current_user)

    if image_type not in IMAGE_FIELDS:
        raise HTTPException(
            status_code=400,
            detail="Image type must be photo, logo or cover",
        )

    field_name, folder_name = IMAGE_FIELDS[image_type]

    old_image = getattr(current_user, field_name)

    if not old_image:
        return {
            "message": "No image to remove",
            field_name: None,
        }

    setattr(current_user, field_name, None)

    try:
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to remove image",
        )

    delete_stored_image(old_image, folder_name)

    return {
        "message": f"Shop {image_type} removed successfully",
        field_name: None,
    }
