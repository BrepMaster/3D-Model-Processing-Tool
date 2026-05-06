import os
import numpy as np
import trimesh
from typing import Tuple, Dict, Any, Optional
from stl import mesh as stl_mesh
from utils.logger import get_logger

logger = get_logger('mesh_utils')


def load_mesh_with_fallbacks(file_path: str) -> Any:
    file_ext = file_path.lower().split('.')[-1]

    if file_ext == 'dae':
        return _load_dae_with_fallbacks(file_path)
    elif file_ext in ('step', 'stp'):
        return _load_step_with_fallbacks(file_path)
    else:
        return _load_generic_with_fallbacks(file_path)


def _load_step_with_fallbacks(file_path: str) -> Any:
    logger.info(f"Loading STEP file with OCC: {file_path}")
    try:
        from OCC.Extend.DataExchange import read_step_file
        shape = read_step_file(file_path)
        logger.info(f"STEP file loaded successfully with OCC")
        return shape
    except ImportError as e:
        logger.error(f"OCC not available: {e}")
        raise Exception("STEP文件需要OpenCASCADE库支持。请使用其他格式或安装 OCC")
    except Exception as e:
        logger.error(f"Failed to load STEP file: {type(e).__name__}: {e}")
        raise Exception(f"无法加载STEP文件: {str(e)}")


def _load_dae_with_fallbacks(file_path: str) -> Any:
    try:
        logger.info(f"Loading DAE file with trimesh.load: {file_path}")
        loaded = trimesh.load(file_path, force='scene')
        if isinstance(loaded, trimesh.Scene):
            logger.info(f"DAE loaded as Scene with {len(loaded.geometry)} geometry objects")
        return loaded
    except Exception as e:
        logger.warning(f"First DAE load attempt failed: {type(e).__name__}: {e}")
        try:
            logger.info("Trying load_mesh for DAE")
            mesh_obj = trimesh.load_mesh(file_path)
            if hasattr(mesh_obj, 'vertices') and len(mesh_obj.vertices) > 0:
                return mesh_obj
            logger.warning("load_mesh returned empty mesh, trying as scene")
            scene = trimesh.load_scene(file_path)
            return scene
        except Exception as e2:
            logger.warning(f"Second DAE load attempt failed: {type(e2).__name__}: {e2}")
            try:
                logger.info("Trying load_scene for DAE")
                return trimesh.load_scene(file_path)
            except Exception as e3:
                logger.warning(f"Third DAE load attempt failed: {type(e3).__name__}: {e3}")
                try:
                    logger.info("Trying fallback with force='mesh' for DAE")
                    return trimesh.load(file_path, force='mesh')
                except Exception as e4:
                    logger.error(f"All DAE load attempts failed: {type(e4).__name__}: {e4}")
                    raise Exception(f"无法加载DAE文件: {str(e4)}")


def _load_generic_with_fallbacks(file_path: str) -> Any:
    def _try_load(**kwargs):
        return trimesh.load(file_path, **kwargs)

    try:
        return _try_load(force='mesh', process=False)
    except Exception as e_load:
        logger.warning(f"load with force='mesh' failed: {type(e_load).__name__}: {e_load}")
        try:
            return _try_load(process=False)
        except FileNotFoundError as e_missing:
            error_msg = str(e_missing)
            error_msg_lower = error_msg.lower()
            if any(ext in error_msg_lower for ext in ['.png', '.jpg', '.jpeg', '.bmp', '.tga', '.dds']):
                missing_file = _extract_missing_filename(error_msg)
                logger.warning(f"Missing texture file: {missing_file}")
                
                import json
                with open(file_path, 'r') as f:
                    gltf_data = json.load(f)
                
                all_missing_textures = _find_all_missing_textures(gltf_data, os.path.dirname(os.path.abspath(file_path)))
                logger.info(f"Found {len(all_missing_textures)} missing texture files: {all_missing_textures}")
                
                for tex_file in all_missing_textures:
                    _create_placeholder_texture(tex_file, file_path)
                
                try:
                    return _try_load(force='mesh', process=False, use_cache=False)
                except Exception as e_retry1:
                    logger.warning(f"Retry 1 after placeholder failed: {e_retry1}")
                    try:
                        return _try_load(process=False, use_cache=False)
                    except Exception as e_retry2:
                        logger.warning(f"Retry 2 after placeholder failed: {e_retry2}")
                        logger.info("Placeholder approach failed, trying GLTF geometry extraction")
                        return _load_gltf_without_textures(file_path)
                raise Exception(f"GLTF文件缺少外部纹理文件（{missing_file}）。请上传GLB格式（自包含）或将GLTF及所有相关文件打包为ZIP上传")
            elif '.bin' in error_msg_lower:
                raise Exception(f"GLTF文件缺少外部文件（.bin）。请上传GLB格式（自包含）或将GLTF及所有相关文件打包为ZIP上传")
            raise
        except Exception as e_load2:
            logger.warning(f"load with process=False failed: {type(e_load2).__name__}: {e_load2}")
            return _try_load()


def _extract_missing_filename(error_msg: str) -> str:
    import re
    match = re.search(r"'([^']+)'", error_msg)
    if match:
        filepath = match.group(1)
        return os.path.basename(filepath)
    match = re.search(r"(?<=No such file: )[^\s]+", error_msg)
    if match:
        return os.path.basename(match.group(0))
    return os.path.basename(error_msg.replace("'", "").strip())


def _find_all_missing_textures(gltf_data: dict, gltf_dir: str) -> list:
    missing_textures = set()
    
    if 'images' in gltf_data:
        for img in gltf_data['images']:
            if 'uri' in img:
                uri = img['uri']
                if not uri.startswith('data:'):
                    full_path = os.path.join(gltf_dir, uri)
                    if not os.path.exists(full_path):
                        missing_textures.add(uri)
    
    return list(missing_textures)


def _create_placeholder_texture(missing_file: str, gltf_path: str) -> bool:
    try:
        gltf_dir = os.path.dirname(gltf_path)
        missing_path = os.path.join(gltf_dir, missing_file)
        logger.info(f"Creating placeholder texture at: {missing_path}")
        if os.path.exists(missing_path):
            logger.info(f"Placeholder already exists: {missing_path}")
            return True
        os.makedirs(os.path.dirname(missing_path), exist_ok=True)
        with open(missing_path, 'wb') as f:
            minimal_png = (
                b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
                b'\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
            )
            f.write(minimal_png)
        logger.info(f"Created minimal placeholder texture: {missing_path}")
        if os.path.exists(missing_path):
            logger.info(f"Placeholder verified to exist: {missing_path}")
            return True
        else:
            logger.warning(f"Placeholder creation failed - file does not exist after write: {missing_path}")
            return False
    except Exception as e:
        logger.warning(f"Failed to create placeholder texture: {e}")
        return False


def _load_gltf_without_textures(file_path: str) -> Any:
    logger.info(f"Attempting to load GLTF geometry without textures: {file_path}")
    import json
    
    with open(file_path, 'r') as f:
        gltf_data = json.load(f)
    
    logger.info(f"GLTF keys: {list(gltf_data.keys())}")
    
    gltf_dir = os.path.dirname(os.path.abspath(file_path))
    logger.info(f"GLTF directory: {gltf_dir}")
    logger.info(f"Files in directory: {os.listdir(gltf_dir)}")
    
    buffers = []
    if 'buffers' in gltf_data:
        logger.info(f"Found {len(gltf_data['buffers'])} buffers in GLTF")
        for idx, buffer_def in enumerate(gltf_data['buffers']):
            logger.info(f"Buffer {idx}: {buffer_def}")
            if 'uri' in buffer_def:
                buffer_uri = buffer_def['uri']
                if not buffer_uri.startswith('data:'):
                    buffer_path = os.path.join(gltf_dir, buffer_uri)
                    logger.info(f"Trying to load buffer from: {buffer_path}")
                    try:
                        with open(buffer_path, 'rb') as bf:
                            buffers.append(bf.read())
                        logger.info(f"Successfully loaded buffer from: {buffer_path}, size: {len(buffers[-1])} bytes")
                    except FileNotFoundError:
                        logger.warning(f"Buffer file not found: {buffer_path}")
                        buffers.append(None)
                else:
                    import base64
                    buffers.append(base64.b64decode(buffer_uri.split(',')[1]))
                    logger.info(f"Loaded embedded buffer, size: {len(buffers[-1])} bytes")
            else:
                logger.info("Buffer has no URI, likely embedded GLB")
                buffers.append(None)
    else:
        logger.warning("No buffers section found in GLTF")
    
    if not buffers or all(b is None for b in buffers):
        raise Exception(f"无法加载GLTF：找不到必要的buffer文件（.bin）。请上传GLB格式或将GLTF和bin文件一起上传")
    
    try:
        scene = trimesh.load(file_path, force='scene')
        if isinstance(scene, trimesh.Scene) and len(scene.geometry) > 0:
            logger.info(f"Loaded as scene with {len(scene.geometry)} geometries")
            return scene
        else:
            logger.warning(f"Scene loaded but has no geometry or wrong type: type={type(scene)}, geometry count={len(scene.geometry) if hasattr(scene, 'geometry') else 'N/A'}")
    except Exception as e:
        logger.warning(f"Scene load failed: {e}")
    
    meshes_list = []
    if 'meshes' in gltf_data:
        logger.info(f"Found {len(gltf_data['meshes'])} meshes in GLTF")
        logger.info(f"Total accessors: {len(gltf_data.get('accessors', []))}")
        logger.info(f"Total bufferViews: {len(gltf_data.get('bufferViews', []))}")
        logger.info(f"Total buffers: {len(gltf_data.get('buffers', []))}")
        
        for mesh_idx, mesh_def in enumerate(gltf_data['meshes']):
            if 'primitives' in mesh_def:
                for prim_idx, prim in enumerate(mesh_def['primitives']):
                    try:
                        if 'POSITION' not in prim['attributes']:
                            logger.warning(f"Mesh {mesh_idx}, prim {prim_idx}: no POSITION attribute")
                            continue
                        
                        pos_attr = prim['attributes']['POSITION']
                        accessors = gltf_data.get('accessors', [])
                        bufferViews = gltf_data.get('bufferViews', [])
                        
                        if pos_attr >= len(accessors):
                            logger.warning(f"Mesh {mesh_idx}, prim {prim_idx}: POSITION accessor index {pos_attr} out of range (have {len(accessors)} accessors)")
                            continue
                        
                        pos_accessors = accessors[pos_attr]
                        buff_view_idx = pos_accessors.get('bufferView')
                        
                        if buff_view_idx is None:
                            logger.warning(f"Mesh {mesh_idx}, prim {prim_idx}: bufferView is None for POSITION")
                            continue
                            
                        if buff_view_idx >= len(bufferViews):
                            logger.warning(f"Mesh {mesh_idx}, prim {prim_idx}: bufferView index {buff_view_idx} out of range (have {len(bufferViews)} bufferViews)")
                            continue
                        
                        if buff_view_idx is not None and buffers[buff_view_idx] is not None:
                            import struct
                            bv = gltf_data['bufferViews'][buff_view_idx]
                            offset = bv.get('byteOffset', 0)
                            stride = bv.get('byteStride', 0)
                            count = pos_accessors['count']
                            comp_type = pos_accessors['componentType']
                            
                            byte_start = offset
                            byte_length = bv.get('byteLength', count * 12)
                            
                            buffer_data = buffers[buff_view_idx][byte_start:byte_start + byte_length]
                            
                            if comp_type == 5126:
                                vertices = struct.unpack(f'<{count * 3}f', buffer_data)
                                vertices = np.array(vertices).reshape(-1, 3)
                            else:
                                continue
                            
                            if 'indices' in prim:
                                idx_accessor = gltf_data['accessors'][prim['indices']]
                                idx_buff_view = idx_accessor.get('bufferView')
                                if idx_buff_view is not None and buffers[idx_buff_view] is not None:
                                    idx_bv = gltf_data['bufferViews'][idx_buff_view]
                                    idx_offset = idx_bv.get('byteOffset', 0)
                                    idx_count = idx_accessor['count']
                                    idx_byte_start = idx_offset
                                    idx_byte_length = idx_bv.get('byteLength', idx_count * 4)
                                    idx_data = buffers[idx_buff_view][idx_byte_start:idx_byte_start + idx_byte_length]
                                    faces = struct.unpack(f'<{idx_count}I', idx_data)
                                    faces = np.array(faces).reshape(-1, 3)
                                else:
                                    continue
                            else:
                                faces = np.arange(len(vertices)).reshape(-1, 3)
                            
                            mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
                            meshes_list.append(mesh)
                            logger.info(f"Created mesh with {len(vertices)} vertices, {len(faces)} faces")
                    except Exception as e_prim:
                        logger.warning(f"Failed to parse primitive: {e_prim}")
                        continue
    else:
        logger.warning("No 'meshes' key found in GLTF JSON")
    
    if meshes_list:
        result = trimesh.util.concatenate(meshes_list)
        logger.info(f"Concatenated {len(meshes_list)} meshes into single mesh with {len(result.vertices)} vertices")
        return result
    
    raise Exception(f"无法从GLTF中提取网格数据。请将GLTF转换为GLB格式后重试")


def convert_scene_to_mesh(mesh_obj: Any, output_path: Optional[str] = None) -> Any:
    if not isinstance(mesh_obj, trimesh.Scene):
        if not hasattr(mesh_obj, 'vertices') or len(mesh_obj.vertices) == 0:
            raise Exception("Mesh has no vertices")
        return mesh_obj

    logger.info("Converting scene to mesh")
    logger.info(f"Scene geometry count: {len(mesh_obj.geometry)}")
    
    if len(mesh_obj.geometry) == 0:
        raise Exception("Scene has no geometry objects")

    geometry = mesh_obj.geometry
    meshes_list = []
    for name, geom in geometry.items():
        try:
            if hasattr(geom, 'vertices') and len(geom.vertices) > 0:
                vertices = np.array(geom.vertices, copy=True)
                faces = np.array(geom.faces, copy=True)
                g = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
                meshes_list.append(g)
                logger.info(f"Added geometry {name}: {len(vertices)} vertices, {len(faces)} faces")
            else:
                logger.warning(f"Geometry {name} has no vertices, skipping")
        except Exception as e_geom:
            logger.warning(f"Error processing geometry {name}: {e_geom}")

    if not meshes_list:
        logger.error("No valid geometry found in scene")
        raise Exception("无法从场景中提取有效的几何数据")

    meshes = trimesh.util.concatenate(meshes_list)
    mesh_obj = meshes

    if not hasattr(mesh_obj, 'vertices') or len(mesh_obj.vertices) == 0:
        raise Exception("Mesh has no vertices")

    return mesh_obj


def _try_multipart_stl_export(scene: trimesh.Scene, output_path: str) -> bool:
    logger.info("Trying multi-file STL export approach")
    try:
        geometry = scene.geometry
        temp_stl_files = []
        for idx, (name, geom) in enumerate(geometry.items()):
            if hasattr(geom, 'vertices') and len(geom.vertices) > 0:
                try:
                    temp_stl = output_path + f'_part_{idx}.stl'
                    vertices = np.array(geom.vertices, copy=True)
                    faces = np.array(geom.faces, copy=True)
                    g = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
                    g.export(temp_stl, file_type='stl')
                    temp_stl_files.append(temp_stl)
                    logger.info(f"Exported part {idx} ({name}): {len(vertices)} vertices")
                except Exception as e_exp:
                    logger.warning(f"Failed to export part {name}: {e_exp}")
        if temp_stl_files:
            combined = None
            for temp_stl in temp_stl_files:
                try:
                    part = stl_mesh.Mesh.from_file(temp_stl)
                    if combined is None:
                        combined = part
                    else:
                        combined = stl_mesh.Mesh(np.concatenate([combined.data, part.data]))
                    os.remove(temp_stl)
                except Exception as e_combine:
                    logger.warning(f"Failed to combine {temp_stl}: {e_combine}")
            if combined is not None:
                combined.save(output_path)
                logger.info("Successfully exported using multi-part approach")
                return True
        raise Exception("无法使用多文件方式导出")
    except Exception as e_multi:
        logger.error(f"Multi-file approach failed: {e_multi}")
        raise Exception(f"文件太大，内存不足以处理该模型: {str(e_multi)}")


def convert_to_stl(input_file: str, output_file: str) -> bool:
    import shutil
    if input_file.lower().endswith('.stl'):
        shutil.copy(input_file, output_file)
        logger.info("Copied STL file")
        return True

    file_ext = input_file.lower().split('.')[-1]
    
    if file_ext in ('step', 'stp'):
        return _convert_step_to_stl(input_file, output_file)
    
    try:
        logger.info(f"Loading file: {input_file}")
        mesh_obj = load_mesh_with_fallbacks(input_file)
        mesh_obj = convert_scene_to_mesh(mesh_obj, output_file)

        logger.info(f"Exporting to STL: {output_file}")
        mesh_obj.export(output_file, file_type='stl')
        logger.info("Successfully converted to STL")
        return True
    except FileNotFoundError as e:
        logger.error(f"File not found error: {e}")
        error_msg = str(e).lower()
        if 'bin' in error_msg or '.bin' in error_msg:
            raise Exception("GLTF 文件需要包含相关的 .bin 文件。请上传 GLB 格式（自包含）或使用 ZIP 压缩包包含所有相关文件")
        if any(ext in error_msg for ext in ['.png', '.jpg', '.jpeg', '.bmp', '.tga', '.dds']):
            raise Exception("GLTF 文件引用了外部纹理文件。请上传 GLB 格式（自包含）或将 GLTF 及相关纹理文件一起压缩为 ZIP 上传")
        raise Exception(f"文件转换失败: 找不到相关文件: {str(e)}")
    except ImportError as e:
        logger.error(f"Import error (missing library): {e}")
        if 'OCC' in str(e) or 'opencascade' in str(e).lower():
            raise Exception("STEP/IGES 格式需要安装 OCC 依赖。请使用 STL、OBJ 或 3MF 格式")
        raise
    except Exception as e:
        logger.error(f"Conversion error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"文件转换失败: {str(e)}")


def _convert_step_to_stl(step_file: str, output_file: str) -> bool:
    logger.info(f"Converting STEP to STL using OCC: {step_file}")
    import tempfile
    
    try:
        from OCC.Extend.DataExchange import read_step_file, write_stl_file
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
        
        shape = read_step_file(step_file)
        logger.info("STEP file loaded, meshing...")
        
        mesh = BRepMesh_IncrementalMesh(shape, 0.1)
        mesh.Perform()
        
        if not mesh.IsDone():
            logger.warning("Initial meshing failed, trying with larger deflection")
            mesh = BRepMesh_IncrementalMesh(shape, 0.5)
            mesh.Perform()
        
        temp_stl = tempfile.mktemp(suffix='.stl')
        write_stl_file(shape, temp_stl)
        logger.info(f"Exported to temp STL: {temp_stl}")
        
        stl_mesh_obj = stl_mesh.Mesh.from_file(temp_stl)
        stl_mesh_obj.save(output_file)
        logger.info(f"Copied to final output: {output_file}")
        
        if os.path.exists(temp_stl):
            os.remove(temp_stl)
        
        return True
    except ImportError as e:
        logger.error(f"OCC not available: {e}")
        raise Exception("STEP文件需要OpenCASCADE库支持。请使用其他格式或安装 OCC")
    except Exception as e:
        logger.error(f"STEP to STL conversion failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"STEP文件转换失败: {str(e)}")


def convert_to_format(input_file: str, output_file: str, output_format: str) -> bool:
    if output_format == 'stl':
        return convert_to_stl(input_file, output_file)

    temp_stl = None
    working_file = input_file

    try:
        logger.info(f"convert_to_format: {input_file} -> {output_format}")

        if input_file.lower().endswith(('.step', '.stp')):
            logger.info("STEP file, converting to STL first")
            temp_stl = input_file + '_temp.stl'
            if not convert_to_stl(input_file, temp_stl):
                return False
            working_file = temp_stl

        mesh_obj = load_mesh_with_fallbacks(working_file)
        mesh_obj = convert_scene_to_mesh(mesh_obj)

        logger.info(f"Mesh stats: {len(mesh_obj.vertices)} vertices, {len(mesh_obj.faces)} faces")
        logger.info(f"Exporting to {output_format}: {output_file}")
        mesh_obj.export(output_file, file_type=output_format)

        if temp_stl and os.path.exists(temp_stl):
            os.remove(temp_stl)
            logger.info(f"Removed temp file: {temp_stl}")

        logger.info(f"Successfully converted {input_file} to {output_format}")
        return True
    except Exception as e:
        logger.error(f"Conversion error for {input_file} to {output_format}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        if temp_stl and os.path.exists(temp_stl):
            try:
                os.remove(temp_stl)
            except:
                pass
        return False


def get_model_stats(stl_file: str) -> Dict[str, int]:
    try:
        mesh_obj = trimesh.load(stl_file)
        if isinstance(mesh_obj, trimesh.Scene):
            meshes = mesh_obj.dump()
            if isinstance(meshes, list) and len(meshes) > 0:
                mesh_obj = trimesh.util.concatenate(meshes)
            elif hasattr(meshes, 'sum'):
                mesh_obj = meshes.sum()

        vertex_count = len(mesh_obj.vertices) if hasattr(mesh_obj, 'vertices') else 0
        face_count = len(mesh_obj.faces) if hasattr(mesh_obj, 'faces') else 0
        return {
            'vertices': vertex_count,
            'faces': face_count
        }
    except Exception as e:
        logger.error(f"get_model_stats error: {type(e).__name__}: {e}")
        return {
            'vertices': 0,
            'faces': 0
        }


def calculate_bounding_box(stl_file: str) -> Dict[str, list]:
    try:
        stl_mesh_obj = stl_mesh.Mesh.from_file(stl_file)
        if stl_mesh_obj.vectors is None or len(stl_mesh_obj.vectors) == 0:
            raise Exception("STL file has no mesh data")
        vertices = stl_mesh_obj.vectors.reshape(-1, 3)
        min_bound = np.min(vertices, axis=0)
        max_bound = np.max(vertices, axis=0)
        size = max_bound - min_bound
        return {
            'min': min_bound.tolist(),
            'max': max_bound.tolist(),
            'size': size.tolist()
        }
    except Exception as e:
        logger.warning(f"calculate_bounding_box (numpy-stl) error: {type(e).__name__}: {e}")
        try:
            mesh_obj = trimesh.load(stl_file)
            if isinstance(mesh_obj, trimesh.Scene):
                meshes = mesh_obj.dump()
                if isinstance(meshes, list) and len(meshes) > 0:
                    mesh_obj = trimesh.util.concatenate(meshes)
                elif hasattr(meshes, 'sum'):
                    mesh_obj = meshes.sum()
            if hasattr(mesh_obj, 'bounds') and mesh_obj.bounds is not None:
                bounds = mesh_obj.bounds
                return {
                    'min': bounds[0].tolist(),
                    'max': bounds[1].tolist(),
                    'size': (bounds[1] - bounds[0]).tolist()
                }
            raise Exception("Mesh has no bounds")
        except Exception as e2:
            logger.error(f"trimesh fallback error: {type(e2).__name__}: {e2}")
            return {
                'min': [0, 0, 0],
                'max': [1, 1, 1],
                'size': [1, 1, 1]
            }


def read_model(filename: str) -> Any:
    mesh_obj = trimesh.load(filename)
    if isinstance(mesh_obj, trimesh.Scene):
        mesh_obj = mesh_obj.dump().sum()
    return mesh_obj


def simplify_mesh(mesh_obj: Any, reduction_ratio: float) -> Any:
    try:
        if reduction_ratio < 0:
            reduction_ratio = 0
        elif reduction_ratio > 0.95:
            reduction_ratio = 0.95

        original_faces = len(mesh_obj.faces)
        target_faces = int(original_faces * (1 - reduction_ratio))
        
        if target_faces < 1:
            target_faces = 1

        logger.info(f"Simplifying mesh: {original_faces} faces -> {target_faces} faces (reduction: {reduction_ratio*100:.1f}%)")
        
        simplified = mesh_obj.simplify_quadric_decimation(target_faces)
        logger.info(f"Simplification complete: {len(simplified.faces)} faces")
        
        return simplified
    except Exception as e:
        logger.error(f"Simplify mesh error: {type(e).__name__}: {e}")
        raise
