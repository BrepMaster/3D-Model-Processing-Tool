import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')
LOG_FOLDER = os.path.join(BASE_DIR, 'logs')
MAX_CONTENT_LENGTH = 50 * 1024 * 1024
FILE_MAX_AGE_HOURS = 24
LOG_MAX_AGE_HOURS = 168  # 7天
PORT = 5000
DEBUG = False

ALLOWED_EXTENSIONS = {'stl', 'obj', '3mf', 'ply', 'off', 'dae', 'gltf', 'step', 'stp'}
SUPPORTED_INPUT_FORMATS = {'stl', 'step', 'stp', 'obj', '3mf'}
SUPPORTED_OUTPUT_FORMATS = {'stl', 'obj', '3mf'}
