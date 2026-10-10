import os
import shutil
import tempfile
import zipfile
from pathlib import Path


class ArchiveValidationError(Exception):
    """Raised when an uploaded archive fails security or structural validation."""

    def __init__(self, message: str, code: str = "INVALID_ARCHIVE", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


IGNORED_DIRS = {"__MACOSX", ".git", ".svn", "node_modules", ".gradle", ".idea", ".vscode"}


def validate_and_extract_zip(
    zip_path: str,
    max_upload_size_mb: float = 25.0,
    max_extracted_files: int = 2000,
    max_extracted_size_mb: float = 100.0,
    base_temp_dir: str = None,
) -> tuple[str, list[dict]]:
    """
    Safely validate and extract a ZIP archive containing a Java project.

    Protections implemented:
    1. File existence & size verification against max_upload_size_mb
    2. ZIP format verification
    3. Path traversal protection (rejects '..', absolute paths, drive letters, outside-root targets)
    4. Zip-bomb protection (limits total extracted entries and total uncompressed byte count)
    5. Symlink rejection
    6. Recursive discovery of .java source files and rejection of empty/non-Java projects

    Returns:
        (extract_dir_path, list_of_java_file_entries)
        where each entry is {"abs_path": str, "rel_path": str, "file_name": str}
    """
    if not os.path.exists(zip_path):
        raise ArchiveValidationError("Uploaded archive file does not exist.", "FILE_NOT_FOUND", 400)

    file_size = os.path.getsize(zip_path)
    if file_size == 0:
        raise ArchiveValidationError("The uploaded file is empty (0 bytes).", "EMPTY_FILE", 400)

    max_upload_bytes = int(max_upload_size_mb * 1024 * 1024)
    if file_size > max_upload_bytes:
        raise ArchiveValidationError(
            f"Upload size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum limit of {max_upload_size_mb} MB.",
            "UPLOAD_TOO_LARGE",
            413,
        )

    if not zipfile.is_zipfile(zip_path):
        raise ArchiveValidationError(
            "Uploaded file is not a valid ZIP archive. Please upload a valid .zip file.",
            "INVALID_ZIP_FORMAT",
            400,
        )

    extract_dir = tempfile.mkdtemp(prefix="java_proj_", dir=base_temp_dir)
    real_extract_root = os.path.realpath(extract_dir)
    max_extracted_bytes = int(max_extracted_size_mb * 1024 * 1024)

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            infos = zf.infolist()
            if not infos:
                raise ArchiveValidationError(
                    "The uploaded ZIP archive is empty and contains no files.",
                    "EMPTY_ARCHIVE",
                    400,
                )

            if len(infos) > max_extracted_files:
                raise ArchiveValidationError(
                    f"Archive contains {len(infos)} entries, exceeding the maximum allowed limit of {max_extracted_files} files.",
                    "TOO_MANY_FILES",
                    400,
                )

            total_uncompressed = 0
            for info in infos:
                member_name = info.filename
                # Normalize slashes for inspection
                normalized_parts = member_name.replace("\\", "/").split("/")

                # 1. Check for path traversal segments or drive letters
                if (
                    member_name.startswith("/")
                    or member_name.startswith("\\")
                    or ".." in normalized_parts
                    or ":" in member_name
                ):
                    raise ArchiveValidationError(
                        f"Unsafe archive path detected ('{member_name}'). Path traversal and absolute paths are forbidden.",
                        "UNSAFE_ARCHIVE_PATH",
                        400,
                    )

                # 2. Check for Unix symlinks in external_attr (mode >> 16)
                unix_mode = info.external_attr >> 16
                if (unix_mode & 0o170000) == 0o120000:
                    raise ArchiveValidationError(
                        f"Symbolic links inside archives are forbidden for security reasons ('{member_name}').",
                        "SYMLINK_FORBIDDEN",
                        400,
                    )

                # 3. Check cumulative uncompressed size (zip bomb defense)
                total_uncompressed += info.file_size
                if total_uncompressed > max_extracted_bytes:
                    raise ArchiveValidationError(
                        f"Total uncompressed size exceeds maximum safe limit of {max_extracted_size_mb} MB.",
                        "EXTRACTED_SIZE_EXCEEDED",
                        400,
                    )

                # 4. Verify resolved destination stays strictly inside real_extract_root
                target_path = os.path.realpath(os.path.join(real_extract_root, member_name))
                if not (
                    target_path == real_extract_root
                    or target_path.startswith(real_extract_root + os.sep)
                ):
                    raise ArchiveValidationError(
                        f"Archive member '{member_name}' resolves outside the target extraction directory.",
                        "UNSAFE_ARCHIVE_PATH",
                        400,
                    )

            # Safe member-by-member extraction
            for info in infos:
                if info.is_dir():
                    continue
                rel_parts = info.filename.replace("\\", "/").split("/")
                if any(part in IGNORED_DIRS for part in rel_parts):
                    continue
                target_file = os.path.realpath(os.path.join(real_extract_root, info.filename))
                os.makedirs(os.path.dirname(target_file), exist_ok=True)
                with zf.open(info, "r") as src, open(target_file, "wb") as dst:
                    shutil.copyfileobj(src, dst)

        # Discover .java files recursively
        java_files = []
        for root, dirs, files in os.walk(real_extract_root):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
            for fname in sorted(files):
                if fname.endswith(".java") and not fname.startswith("._"):
                    abs_p = os.path.join(root, fname)
                    rel_p = os.path.relpath(abs_p, real_extract_root).replace("\\", "/")
                    java_files.append(
                        {
                            "abs_path": abs_p,
                            "rel_path": rel_p,
                            "file_name": fname,
                        }
                    )

        if not java_files:
            raise ArchiveValidationError(
                "No Java source files (.java) were found in the uploaded archive. Please upload a Java project.",
                "NO_JAVA_FILES",
                400,
            )

        return real_extract_root, java_files

    except ArchiveValidationError:
        cleanup_extracted_dir(real_extract_root)
        raise
    except zipfile.BadZipFile:
        cleanup_extracted_dir(real_extract_root)
        raise ArchiveValidationError(
            "Corrupted or malformed ZIP archive.", "BAD_ZIP_FILE", 400
        )
    except Exception as exc:
        cleanup_extracted_dir(real_extract_root)
        raise ArchiveValidationError(
            f"Failed to process archive safely: {str(exc)}", "EXTRACTION_FAILED", 400
        )


def cleanup_extracted_dir(extract_dir: str):
    """Safely remove temporary extraction directory."""
    if extract_dir and os.path.exists(extract_dir):
        shutil.rmtree(extract_dir, ignore_errors=True)
