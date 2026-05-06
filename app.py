from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import tempfile
import zipfile
import datetime
import traceback
import signal
import sys
import argparse

from config import (
    UPLOAD_FOLDER, OUTPUT_FOLDER, MAX_CONTENT_LENGTH, PORT, DEBUG,
    ALLOWED_EXTENSIONS, SUPPORTED_INPUT_FORMATS, SUPPORTED_OUTPUT_FORMATS,
    LOG_FOLDER
)
from utils.file_utils import allowed_file, generate_unique_filename
from utils.mesh_utils import get_model_stats, calculate_bounding_box
from utils.logger import setup_logger, log_error_with_traceback
from services.conversion import ConversionService
from services.simplification import SimplificationService
from services.step_service import StepService
from cleanup import start_cleanup_thread

# 确保日志目录存在
os.makedirs(LOG_FOLDER, exist_ok=True)

# 初始化日志
logger = setup_logger('app')

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/viewer')
def viewer():
    return render_template('viewer.html')


@app.route('/simplify')
def simplify_page():
    return render_template('simplify.html')


@app.route('/convert')
def convert_page():
    return render_template('convert.html')


@app.route('/theme')
def theme_page():
    return render_template('theme.html')


@app.route('/step')
def step_page():
    return render_template('step.html')


@app.route('/api/step/upload', methods=['POST'])
def step_upload():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        original_filename = file.filename
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''

        if ext not in ['step', 'stp']:
            return jsonify({'error': 'Only STEP files are supported'}), 400

        unique_name = generate_unique_filename(ext)
        file_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(file_path)

        result = {
            'success': True,
            'file': unique_name,
            'filename': original_filename
        }

        return jsonify(result)
    except Exception as e:
        logger.error(f"Step upload error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/step/face-areas', methods=['POST'])
def step_face_areas():
    try:
        data = request.json
        if not data or 'file' not in data:
            return jsonify({'error': 'No file specified'}), 400

        step_file = data['file']
        file_path = os.path.join(UPLOAD_FOLDER, step_file)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        face_areas = StepService.calculate_face_areas(file_path)

        return jsonify({
            'success': True,
            'face_areas': face_areas
        })
    except Exception as e:
        logger.error(f"Face areas error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/step/face-geometry', methods=['POST'])
def step_face_geometry():
    try:
        data = request.json
        if not data or 'file' not in data or 'face_index' not in data:
            return jsonify({'error': 'No file or face_index specified'}), 400

        step_file = data['file']
        face_index = data['face_index']
        file_path = os.path.join(UPLOAD_FOLDER, step_file)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        face_geometry = StepService.get_face_geometry(file_path, face_index)

        if face_geometry is None:
            return jsonify({
                'success': False,
                'error': 'Failed to get face geometry'
            })

        return jsonify({
            'success': True,
            'face_geometry': face_geometry
        })
    except Exception as e:
        logger.error(f"Face geometry error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/step/faces-info', methods=['POST'])
def step_faces_info():
    try:
        data = request.json
        if not data or 'file' not in data:
            return jsonify({'error': 'No file specified'}), 400

        step_file = data['file']
        file_path = os.path.join(UPLOAD_FOLDER, step_file)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        faces_info = StepService.get_faces_info(file_path)

        return jsonify({
            'success': True,
            'faces_info': faces_info
        })
    except Exception as e:
        logger.error(f"Faces info error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/step/to-gltf', methods=['POST'])
def step_to_gltf():
    try:
        data = request.json
        if not data or 'file' not in data:
            return jsonify({'error': 'No file specified'}), 400

        step_file = data['file']
        file_path = os.path.join(UPLOAD_FOLDER, step_file)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        gltf_file = StepService.convert_to_gltf(file_path, OUTPUT_FOLDER, generate_unique_filename)

        return jsonify({
            'success': True,
            'gltf_file': gltf_file
        })
    except Exception as e:
        logger.error(f"STEP to GLTF error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400

        files = request.files.getlist('file')
        if len(files) == 0 or all(f.filename == '' for f in files):
            return jsonify({'error': 'No selected file'}), 400

        main_file = None
        main_ext = None
        original_size = 0
        original_filenames = []

        with tempfile.TemporaryDirectory() as temp_dir:
            for file in files:
                if file.filename == '':
                    continue

                original_filename = file.filename
                if '.' not in original_filename:
                    return jsonify({'error': 'File must have an extension'}), 400

                ext = original_filename.rsplit('.', 1)[1].lower()

                if ext not in ALLOWED_EXTENSIONS and ext != 'bin':
                    return jsonify({'error': f'File type not allowed: {ext}'}), 400

                file_path = os.path.join(temp_dir, original_filename)
                file.save(file_path)
                original_size += os.path.getsize(file_path)
                original_filenames.append(original_filename)

                if ext == 'gltf' and main_file is None:
                    main_file = file_path
                    main_ext = 'gltf'
                elif main_file is None and ext in ALLOWED_EXTENSIONS and ext != 'gltf':
                    main_file = file_path
                    main_ext = ext

            if main_file is None:
                return jsonify({'error': '没有找到有效的模型文件'}), 400

            if main_ext == 'zip':
                with tempfile.TemporaryDirectory() as extract_dir:
                    with zipfile.ZipFile(main_file, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    gltf_files = [f for f in os.listdir(extract_dir) if f.lower().endswith('.gltf')]
                    if len(gltf_files) == 0:
                        return jsonify({'error': 'ZIP文件中没有找到GLTF文件'}), 400
                    main_file = os.path.join(extract_dir, gltf_files[0])

            result = ConversionService.process_upload_and_convert_to_stl(
                temp_dir, main_file, original_filenames
            )
            result['original_size'] = original_size

        return jsonify(result)
    except Exception as e:
        log_error_with_traceback(logger, e, "Upload failed")
        return jsonify({'error': str(e)}), 500


@app.route('/simplify', methods=['POST'])
def simplify():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400

        stl_file = data.get('stl_file')
        reduction_ratio = data.get('reduction_ratio', 0.5)

        if not stl_file:
            return jsonify({'error': 'No STL file specified'}), 400

        result = SimplificationService.process_simplification(stl_file, reduction_ratio)
        return jsonify(result)
    except FileNotFoundError:
        return jsonify({'error': 'STL file not found'}), 404
    except Exception as e:
        logger.error(f"Simplify error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/convert', methods=['POST'])
def convert_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        original_filename = file.filename

        if '.' in original_filename:
            ext = original_filename.rsplit('.', 1)[1].lower()
        else:
            return jsonify({'error': 'File must have an extension'}), 400

        if ext not in SUPPORTED_INPUT_FORMATS:
            return jsonify({
                'error': f'Unsupported file format: {ext}. Supported formats: {", ".join(SUPPORTED_INPUT_FORMATS)}'
            }), 400

        unique_name = generate_unique_filename(ext)
        input_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(input_path)

        output_formats = []
        for key in request.form.keys():
            if key.startswith('output_formats'):
                val = request.form.getlist(key)
                output_formats.extend(val)
        if not output_formats:
            output_formats = ['stl']

        custom_name = request.form.get('custom_name', '').strip()
        name_mode = request.form.get('name_mode', 'original')

        logger.info(f"Received output formats: {output_formats}")

        results = ConversionService.convert_to_multiple_formats(
            input_path, original_filename, output_formats, custom_name, name_mode
        )

        for r in results:
            r['friendlyName'] = r.pop('friendly_name')

        if results:
            return jsonify({
                'success': True,
                'results': results
            })
        else:
            return jsonify({'error': 'Conversion failed for all formats'}), 500
    except Exception as e:
        logger.error(f"Convert error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/outputs/<filename>')
def serve_output(filename):
    response = send_from_directory(app.config['OUTPUT_FOLDER'], filename)
    response.headers.pop('Content-Disposition', None)
    return response


def signal_handler(sig, frame):
    print('\n🛑 正在关闭服务器...')
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == '__main__':
    start_cleanup_thread()
    parser = argparse.ArgumentParser()
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()
    app.run(debug=args.debug or DEBUG, port=PORT, use_reloader=args.debug)
