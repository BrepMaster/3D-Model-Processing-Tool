import os
from typing import Dict, Any
from utils.mesh_utils import read_model, simplify_mesh, calculate_bounding_box, get_model_stats
from utils.file_utils import generate_unique_filename
from utils.logger import get_logger
from config import OUTPUT_FOLDER

logger = get_logger('simplification')


class SimplificationService:
    @staticmethod
    def process_simplification(stl_file: str, reduction_ratio: float) -> Dict[str, Any]:
        input_path = os.path.join(OUTPUT_FOLDER, stl_file)

        if not os.path.exists(input_path):
            raise FileNotFoundError("STL file not found")

        simplified_name = generate_unique_filename('stl')
        output_path = os.path.join(OUTPUT_FOLDER, simplified_name)

        mesh_obj = read_model(input_path)
        simplified_mesh = simplify_mesh(mesh_obj, reduction_ratio)
        simplified_mesh.export(output_path, file_type='stl')

        final_size = os.path.getsize(output_path)
        bbox = calculate_bounding_box(output_path)
        model_stats = get_model_stats(output_path)

        return {
            'success': True,
            'simplified_file': simplified_name,
            'file_size': final_size,
            'bounding_box': bbox,
            'vertices': model_stats['vertices'],
            'faces': model_stats['faces']
        }
