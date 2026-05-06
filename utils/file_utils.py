import os
import uuid
import time
from typing import Optional
from utils.logger import get_logger

logger = get_logger('file_utils')


def allowed_file(filename: str) -> bool:
    from config import ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_unique_filename(extension: str) -> str:
    safe_extension = extension.split('.')[-1].lower()
    return f"{uuid.uuid4().hex}.{safe_extension}"


def cleanup_old_files():
    from config import UPLOAD_FOLDER, OUTPUT_FOLDER, LOG_FOLDER, FILE_MAX_AGE_HOURS, LOG_MAX_AGE_HOURS
    while True:
        time.sleep(3600)
        current_time = time.time()
        file_max_age = FILE_MAX_AGE_HOURS * 3600
        log_max_age = LOG_MAX_AGE_HOURS * 3600

        # 清理 uploads 和 outputs 目录
        for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
            try:
                for filename in os.listdir(folder):
                    file_path = os.path.join(folder, filename)
                    if os.path.isfile(file_path):
                        file_age = current_time - os.path.getmtime(file_path)
                        if file_age > file_max_age:
                            os.remove(file_path)
                            logger.info(f"Cleaned up old file: {file_path}")
            except Exception as e:
                logger.error(f"Cleanup error for {folder}: {e}")

        # 清理 logs 目录
        try:
            for filename in os.listdir(LOG_FOLDER):
                file_path = os.path.join(LOG_FOLDER, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > log_max_age:
                        os.remove(file_path)
                        logger.info(f"Cleaned up old log file: {file_path}")
        except Exception as e:
            logger.error(f"Cleanup error for logs: {e}")
