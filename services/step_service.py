import os
import tempfile
from typing import List, Dict, Any, Optional
from utils.logger import get_logger

logger = get_logger('step_service')


class StepService:
    """STEP 文件处理服务类，统一管理所有 STEP 相关功能"""

    @staticmethod
    def calculate_face_areas(file_path: str) -> List[Dict[str, Any]]:
        """计算 STEP 文件中所有面的面积"""
        try:
            from OCC.Extend.DataExchange import read_step_file
            from OCC.Core.GProp import GProp_GProps
            from OCC.Core.BRepGProp import brepgprop
            from OCC.Extend.TopologyUtils import TopologyExplorer

            shape = read_step_file(file_path)
            t = TopologyExplorer(shape)
            face_areas = []

            for idx, face in enumerate(t.faces(), start=1):
                props = GProp_GProps()
                brepgprop.SurfaceProperties(face, props)
                face_area = props.Mass()
                face_areas.append({
                    'face': idx,
                    'area': face_area
                })

            logger.info(f"Calculated {len(face_areas)} face areas")
            return face_areas
        except ImportError as e:
            logger.error(f"OCC not available: {e}")
            raise Exception("STEP文件需要OpenCASCADE库支持")
        except Exception as e:
            logger.error(f"Failed to calculate face areas: {type(e).__name__}: {e}")
            raise

    @staticmethod
    def get_face_geometry(file_path: str, face_index: int) -> Optional[Dict[str, Any]]:
        """获取指定面的几何数据（顶点和索引）"""
        try:
            from OCC.Extend.DataExchange import read_step_file
            from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
            from OCC.Extend.TopologyUtils import TopologyExplorer
            from OCC.Core.BRep import BRep_Tool
            from OCC.Core.TopLoc import TopLoc_Location

            logger.info(f"Getting geometry for face {face_index}")

            shape = read_step_file(file_path)

            mesh = BRepMesh_IncrementalMesh(shape, 0.1)
            mesh.Perform()

            if not mesh.IsDone():
                logger.warning("Initial meshing failed, trying with larger deflection")
                mesh = BRepMesh_IncrementalMesh(shape, 0.5)
                mesh.Perform()

            t = TopologyExplorer(shape)
            faces = list(t.faces())

            logger.info(f"Total faces found: {len(faces)}, requested index: {face_index}")

            if face_index < 0 or face_index >= len(faces):
                logger.error(f"Invalid face index: {face_index}")
                return None

            face = faces[face_index]
            location = TopLoc_Location()
            triangulation = BRep_Tool().Triangulation(face, location)

            if not triangulation:
                logger.warning(f"No triangulation found for face {face_index}")
                return None

            trsf = location.Transformation()

            vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i).Transformed(trsf)
                vertices.append([p.X(), p.Y(), p.Z()])

            indices = []
            for i in range(1, triangulation.NbTriangles() + 1):
                tri = triangulation.Triangle(i)
                indices.extend([tri.Value(1) - 1, tri.Value(2) - 1, tri.Value(3) - 1])

            logger.info(f"Face {face_index}: {len(vertices)} vertices, {len(indices)//3} triangles")

            return {
                'vertices': vertices,
                'indices': indices
            }
        except ImportError as e:
            logger.error(f"OCC not available: {e}")
            raise Exception("STEP文件需要OpenCASCADE库支持")
        except Exception as e:
            logger.error(f"Failed to get face geometry: {type(e).__name__}: {e}")
            raise

    @staticmethod
    def get_faces_info(file_path: str) -> List[Dict[str, Any]]:
        """获取 STEP 文件中所有面的信息（带颜色和标签）"""
        try:
            from OCC.Extend.DataExchange import read_step_file_with_names_colors
            from OCC.Core.Quantity import Quantity_Color, Quantity_TOC_RGB

            shapes_labels_colors = read_step_file_with_names_colors(file_path)
            faces_info = []

            for shape, (label, color) in shapes_labels_colors.items():
                red = int(color.Red() * 255)
                green = int(color.Green() * 255)
                blue = int(color.Blue() * 255)
                faces_info.append({
                    'label': label,
                    'color': {'r': red, 'g': green, 'b': blue}
                })

            logger.info(f"Got info for {len(faces_info)} faces")
            return faces_info
        except ImportError as e:
            logger.error(f"OCC not available: {e}")
            raise Exception("STEP文件需要OpenCASCADE库支持")
        except Exception as e:
            logger.error(f"Failed to get faces info: {type(e).__name__}: {e}")
            raise

    @staticmethod
    def convert_to_gltf(step_file_path: str, output_dir: str, generate_unique_filename_func) -> str:
        """将 STEP 文件转换为 GLTF/GLB 格式"""
        try:
            import trimesh
            from OCC.Extend.DataExchange import read_step_file_with_names_colors, write_stl_file, read_step_file
            from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh

            logger.info(f"Starting conversion of {step_file_path}")
            temp_dir = tempfile.gettempdir()

            shapes_labels_colors = {}
            try:
                shapes_labels_colors = read_step_file_with_names_colors(step_file_path)
                logger.info(f"Found {len(shapes_labels_colors)} shapes with colors")
            except Exception as e:
                logger.warning(f"Error reading STEP with colors: {e}")
                shapes_labels_colors = {}

            meshes_list = []

            if shapes_labels_colors:
                for idx, (shape, (label, color)) in enumerate(shapes_labels_colors.items()):
                    try:
                        mesh = BRepMesh_IncrementalMesh(shape, 0.1)
                        mesh.Perform()

                        temp_stl = os.path.join(temp_dir, f'temp_shape_{idx}.stl')
                        write_stl_file(shape, temp_stl)

                        mesh_data = trimesh.load(temp_stl)

                        if isinstance(mesh_data, trimesh.Scene):
                            if len(mesh_data.geometry) > 0:
                                first_geom = list(mesh_data.geometry.values())[0]
                                mesh_data = first_geom

                        r = int(color.Red() * 255)
                        g = int(color.Green() * 255)
                        b = int(color.Blue() * 255)

                        if hasattr(mesh_data, 'faces') and len(mesh_data.faces) > 0:
                            face_count = len(mesh_data.faces)
                            colors = [[r, g, b, 255] for _ in range(face_count)]
                            mesh_data.visual.face_colors = colors

                        meshes_list.append(mesh_data)

                        if os.path.exists(temp_stl):
                            os.remove(temp_stl)
                    except Exception as e:
                        logger.warning(f"Error processing shape {idx}: {e}")
                        continue

            if not meshes_list:
                try:
                    logger.info("Trying fallback processing...")
                    shape = read_step_file(step_file_path)
                    mesh = BRepMesh_IncrementalMesh(shape, 0.1)
                    mesh.Perform()

                    temp_stl = os.path.join(temp_dir, 'temp_shape.stl')
                    write_stl_file(shape, temp_stl)

                    mesh_data = trimesh.load(temp_stl)

                    if isinstance(mesh_data, trimesh.Scene):
                        if len(mesh_data.geometry) > 0:
                            first_geom = list(mesh_data.geometry.values())[0]
                            mesh_data = first_geom

                    if hasattr(mesh_data, 'faces') and len(mesh_data.faces) > 0:
                        face_count = len(mesh_data.faces)
                        colors = [[180, 180, 180, 255] for _ in range(face_count)]
                        mesh_data.visual.face_colors = colors

                    meshes_list.append(mesh_data)

                    if os.path.exists(temp_stl):
                        os.remove(temp_stl)
                except Exception as e:
                    logger.error(f"Error in fallback processing: {e}")

            if not meshes_list:
                logger.info("Creating default cube...")
                cube = trimesh.creation.box()
                cube.visual.face_colors = [[180, 180, 180, 255]] * len(cube.faces)
                meshes_list.append(cube)

            scene = trimesh.Scene(meshes_list)

            unique_name = generate_unique_filename_func('glb')
            glb_path = os.path.join(output_dir, unique_name)

            try:
                logger.info(f"Exporting to {glb_path}")
                scene.export(glb_path, file_type='glb')
            except Exception as e:
                logger.warning(f"Error exporting GLB: {e}")
                glb_path = os.path.join(output_dir, unique_name.replace('.glb', '.gltf'))
                logger.info(f"Trying GLTF format instead: {glb_path}")
                scene.export(glb_path, file_type='gltf')

            logger.info(f"Conversion complete: {glb_path}")
            return os.path.basename(glb_path)
        except ImportError as e:
            logger.error(f"OCC or trimesh not available: {e}")
            raise Exception("STEP转换需要OpenCASCADE和trimesh库")
        except Exception as e:
            logger.error(f"Failed to convert STEP to GLTF: {type(e).__name__}: {e}")
            raise
