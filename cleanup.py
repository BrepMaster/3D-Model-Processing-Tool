import threading
from utils.file_utils import cleanup_old_files
from utils.logger import get_logger

logger = get_logger('cleanup')


def start_cleanup_thread():
    cleanup_t = threading.Thread(target=cleanup_old_files, daemon=True)
    cleanup_t.start()
    logger.info("Cleanup thread started")
