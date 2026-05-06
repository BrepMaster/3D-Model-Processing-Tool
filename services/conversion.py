import os
from typing import List, Dict, Any
from utils.mesh_utils import convert_to_format, get_model_stats, calculate_bounding_box
from utils.file_utils import generate_unique_filename
from utils.logger import get_logger
from config import OUTPUT_FOLDER, SUPPORTED_OUTPUT_FORMATS

logger = get_logger('conversion')


class ConversionService:
    @staticmethod
    def process_upload_and_convert_to_stl(temp_dir: str, main_file: str, original_filenames: List[str]) -> Dict[str, Any]:
        from utils.mesh_utils import convert_to_stl
        stl_name = generate_unique_filename('stl')
        stl_path = os.path.join(OUTPUT_FOLDER, stl_name)

        convert_to_stl(main_file, stl_path)

        bbox = calculate_bounding_box(stl_path)
        stl_size = os.path.getsize(stl_path)
        model_stats = get_model_stats(stl_path)

        return {
            'success': True,
            'original_file': ', '.join(original_filenames),
            'stl_file': stl_name,
            'bounding_box': bbox,
            'stl_size': stl_size,
            'vertices': model_stats['vertices'],
            'faces': model_stats['faces']
        }

    @staticmethod
    def convert_to_multiple_formats(
        input_path: str,
        original_filename: str,
        output_formats: List[str],
        custom_name: str = '',
        name_mode: str = 'original'
    ) -> List[Dict[str, Any]]:
        results = []
        total = len(output_formats)

        for idx, output_format in enumerate(output_formats):
            if output_format not in SUPPORTED_OUTPUT_FORMATS:
                continue

            output_name = generate_unique_filename(output_format)
            output_path = os.path.join(OUTPUT_FOLDER, output_name)

            if convert_to_format(input_path, output_path, output_format):
                output_size = os.path.getsize(output_path)

                if custom_name:
                    base_name = custom_name
                else:
                    base_name = os.path.splitext(original_filename)[0]

                friendly_name = f"{base_name}.{output_format}"
                if name_mode == 'date':
                    import datetime
                    date_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
                    friendly_name = f"{base_name}_{date_str}.{output_format}"

                results.append({
                    'format': output_format,
                    'file': output_name,
                    'friendly_name': friendly_name,
                    'size': output_size,
                    'progress': (idx + 1) * 100 // total
                })

        return results
