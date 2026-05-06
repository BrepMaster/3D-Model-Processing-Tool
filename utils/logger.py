import logging
import os
import datetime
from logging.handlers import TimedRotatingFileHandler
from typing import Optional

from config import LOG_FOLDER, DEBUG


def setup_logger(name: str = 'app', log_file: Optional[str] = None) -> logging.Logger:
    """
    设置统一的日志记录器

    Args:
        name: 日志记录器名称
        log_file: 日志文件名（可选，默认使用日期命名）

    Returns:
        配置好的 logger 实例
    """
    # 确保日志目录存在
    os.makedirs(LOG_FOLDER, exist_ok=True)

    # 创建 logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if DEBUG else logging.INFO)

    # 避免重复添加处理器
    if logger.handlers:
        return logger

    # 设置日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG if DEBUG else logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 文件处理器 - 按天分割，保留7天日志
    if log_file is None:
        log_file = os.path.join(LOG_FOLDER, f'app_{datetime.datetime.now().strftime("%Y%m%d")}.log')

    file_handler = TimedRotatingFileHandler(
        log_file,
        when='midnight',
        interval=1,
        backupCount=7,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG if DEBUG else logging.INFO)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger


def get_logger(name: str = 'app') -> logging.Logger:
    """
    获取已配置的 logger

    Args:
        name: 日志记录器名称

    Returns:
        logger 实例
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        return setup_logger(name)
    return logger


def log_error_with_traceback(logger: logging.Logger, error: Exception, message: str = "Error occurred") -> None:
    """
    记录错误及其堆栈信息

    Args:
        logger: 日志记录器
        error: 异常对象
        message: 额外的错误信息
    """
    import traceback
    logger.error(f"{message}: {type(error).__name__}: {str(error)}")
    logger.error(f"Traceback:\n{traceback.format_exc()}")
