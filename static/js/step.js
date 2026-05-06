let scene, camera, renderer, controls;
let currentModel = null;
let currentStepFile = null;
let faceAreasData = [];
let isGLTF = false;
let highlightedFace = null;
let originalColors = [];
let originalMaterials = [];
let filteredFaceAreas = [];
let faceIndexCounter = 0;

function handleFileSelect(input) {
    const files = input.files;
    if (files.length > 0) {
        const file = files[0];
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'step' || ext === 'stp') {
            uploadStepFile(file);
        } else {
            setStatus('uploadStatus', '请上传 STEP 或 STP 文件', 'error');
        }
    }
    input.value = '';
}

function init() {
    const container = document.getElementById('canvasContainer');
    if (!container) {
        console.error('canvasContainer not found!');
        return;
    }

    scene = new THREE.Scene();
    const savedTheme = localStorage.getItem('theme') || 'default';
    scene.background = new THREE.Color(getSceneBackgroundColor(savedTheme));

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    window.addEventListener('resize', onWindowResize);

    document.addEventListener('themeChanged', function(e) {
        if (scene) {
            scene.background = new THREE.Color(getSceneBackgroundColor(e.detail.theme));
        }
    });

    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('stepFileInput');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                fileInput.click();
            }
        });
    }

    const colorR = document.getElementById('colorR');
    const colorG = document.getElementById('colorG');
    const colorB = document.getElementById('colorB');
    if (colorR) colorR.addEventListener('input', updateColorPreview);
    if (colorG) colorG.addEventListener('input', updateColorPreview);
    if (colorB) colorB.addEventListener('input', updateColorPreview);

    const applyColorBtn = document.getElementById('applyColorBtn');
    if (applyColorBtn) {
        applyColorBtn.addEventListener('click', applyColorToMesh);
    }

    const resetColorBtn = document.getElementById('resetColorBtn');
    if (resetColorBtn) {
        resetColorBtn.addEventListener('click', resetColorToOriginal);
    }

    const exportAreasBtn = document.getElementById('exportAreasBtn');
    if (exportAreasBtn) {
        exportAreasBtn.addEventListener('click', exportFaceAreas);
    }

    const faceSearch = document.getElementById('faceSearch');
    if (faceSearch) {
        faceSearch.addEventListener('input', function() {
            filterFaceAreas(this.value);
        });
    }

    const uploadZone = document.getElementById('uploadArea');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'step' || ext === 'stp') {
                    uploadStepFile(file);
                } else {
                    setStatus('uploadStatus', '请上传 STEP 或 STP 文件', 'error');
                }
            }
        });
    }

    updateColorPreview();
    animate();
}

function onWindowResize() {
    const container = document.getElementById('canvasContainer');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function setStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = 'status-message status-' + type;
    }
}

function updateColorPreview() {
    const r = parseInt(document.getElementById('colorR').value) || 0;
    const g = parseInt(document.getElementById('colorG').value) || 0;
    const b = parseInt(document.getElementById('colorB').value) || 0;
    const hex = '#' + [r, g, b].map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
    
    const colorPreview = document.getElementById('colorPreview');
    const colorHex = document.getElementById('colorHex');
    const colorRgb = document.getElementById('colorRgb');
    const colorRValue = document.getElementById('colorRValue');
    const colorGValue = document.getElementById('colorGValue');
    const colorBValue = document.getElementById('colorBValue');
    
    if (colorPreview) colorPreview.style.backgroundColor = hex;
    if (colorHex) colorHex.textContent = hex.toUpperCase();
    if (colorRgb) colorRgb.textContent = 'RGB(' + r + ', ' + g + ', ' + b + ')';
    if (colorRValue) colorRValue.textContent = r;
    if (colorGValue) colorGValue.textContent = g;
    if (colorBValue) colorBValue.textContent = b;
}

function clearScene() {
    clearHighlight();
    faceIndexCounter = 0;
    if (currentModel) {
        scene.remove(currentModel);
        if (currentModel.geometry) currentModel.geometry.dispose();
        if (currentModel.material) {
            if (Array.isArray(currentModel.material)) {
                currentModel.material.forEach(function(m) { m.dispose(); });
            } else {
                currentModel.material.dispose();
            }
        }
        currentModel = null;
    }
    originalColors = [];
    originalMaterials = [];
}

function applyColorToMesh() {
    if (!currentModel) return;

    const r = parseInt(document.getElementById('colorR').value) || 0;
    const g = parseInt(document.getElementById('colorG').value) || 0;
    const b = parseInt(document.getElementById('colorB').value) || 0;

    const hexColor = (r << 16) | (g << 8) | b;

    if (isGLTF && currentModel.traverse) {
        currentModel.traverse(function(node) {
            if (node.isMesh && node.material) {
                if (node.material.color) {
                    node.material.color.setHex(hexColor);
                }
                if (node.material.specular) {
                    node.material.specular.setHex(hexColor);
                }
                if (node.material.pbrMetallicRoughness && node.material.pbrMetallicRoughness.baseColorFactor) {
                    node.material.pbrMetallicRoughness.baseColorFactor = [r / 255, g / 255, b / 255, 1.0];
                }
            }
        });
    } else if (currentModel.material) {
        if (currentModel.material.color) {
            currentModel.material.color.setHex(hexColor);
        }
        if (currentModel.material.specular) {
            currentModel.material.specular.setHex(hexColor);
        }
    }
}

function resetColorToOriginal() {
    if (!currentModel || originalMaterials.length === 0) return;

    if (isGLTF && currentModel.traverse) {
        let matIndex = 0;
        currentModel.traverse(function(node) {
            if (node.isMesh && node.material && originalMaterials[matIndex]) {
                const originalMat = originalMaterials[matIndex];
                if (Array.isArray(node.material)) {
                    for (let i = 0; i < node.material.length; i++) {
                        if (originalMat[i] && node.material[i].color && originalMat[i].color) {
                            node.material[i].color.copy(originalMat[i].color);
                        }
                    }
                } else if (node.material.color && originalMat.color) {
                    node.material.color.copy(originalMat.color);
                }
                matIndex++;
            }
        });
    } else if (currentModel.material && originalMaterials[0]) {
        const originalMat = originalMaterials[0];
        if (currentModel.material.color && originalMat.color) {
            currentModel.material.color.copy(originalMat.color);
        }
    }
}

function loadGLTF(url) {
    showLoading(true);
    originalColors = [];
    originalMaterials = [];

    const loader = new THREE.GLTFLoader();

    loader.load(url, function(gltf) {
        showLoading(false);
        clearScene();

        currentModel = gltf.scene;
        isGLTF = true;

        let matIndex = 0;
        currentModel.traverse(function(node) {
            if (node.isMesh && node.geometry) {
                let hasVertexColorAttribute = false;
                if (node.geometry.attributes && node.geometry.attributes.color) {
                    hasVertexColorAttribute = true;
                    const colorAttr = node.geometry.attributes.color;
                    const savedColors = new Float32Array(colorAttr.array.length);
                    savedColors.set(colorAttr.array);
                    originalColors.push(savedColors);
                } else {
                    originalColors.push(null);
                }
                
                if (Array.isArray(node.material)) {
                    const savedMats = node.material.map(m => m.clone());
                    originalMaterials.push(savedMats);
                    node.material = node.material.map(function(mat) {
                        return ensureMaterialWithLighting(mat, hasVertexColorAttribute);
                    });
                } else if (node.material) {
                    originalMaterials.push(node.material.clone());
                    node.material = ensureMaterialWithLighting(node.material, hasVertexColorAttribute);
                }
                matIndex++;
            }
        });

        scene.add(currentModel);

        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        camera.position.set(center.x, center.y, center.z + cameraZ * 1.5);
        controls.target.copy(center);
        controls.update();

    }, undefined, function(error) {
        showLoading(false);
        console.error('Error loading GLTF:', error);
        setStatus('uploadStatus', 'GLTF加载失败: ' + error.message, 'error');
    });
}

function ensureMaterialWithLighting(originalMaterial, hasGeometryColors) {
    if (hasGeometryColors === undefined) hasGeometryColors = false;
    let color = new THREE.Color(0xb4b4b4);
    let hasVertexColors = false;

    if (originalMaterial) {
        if (originalMaterial.color) {
            color = originalMaterial.color.clone();
        } else if (originalMaterial.pbrMetallicRoughness && originalMaterial.pbrMetallicRoughness.baseColorFactor) {
            const rgb = originalMaterial.pbrMetallicRoughness.baseColorFactor;
            color = new THREE.Color(rgb[0], rgb[1], rgb[2]);
        }
        if (originalMaterial.vertexColors !== undefined) {
            hasVertexColors = originalMaterial.vertexColors;
        }
    }
    
    if (hasGeometryColors) {
        hasVertexColors = true;
    }

    return new THREE.MeshPhongMaterial({
        color: color,
        specular: 0x222222,
        shininess: 30,
        vertexColors: hasVertexColors,
        flatShading: true
    });
}

function displayFaceAreas(faceAreas) {
    faceAreasData = faceAreas;
    filteredFaceAreas = faceAreas;
    renderFaceAreasList();
    
    const faceCountBadge = document.getElementById('faceCountBadge');
    if (faceCountBadge) {
        faceCountBadge.textContent = faceAreas.length + ' 个面';
    }

    document.getElementById('faceAreasCard').style.display = 'block';
}

function renderFaceAreasList() {
    const container = document.getElementById('faceAreasList');
    if (!container) return;
    
    container.innerHTML = '';

    if (filteredFaceAreas.length === 0) {
        container.innerHTML = '<div class="face-area-item">没有找到面信息</div>';
        return;
    }

    filteredFaceAreas.forEach(function(item) {
        const div = document.createElement('div');
        div.className = 'face-area-item';
        div.dataset.faceIndex = item.face - 1;
        div.innerHTML = '<div class="face-area-left"><div class="face-number-badge">' + item.face + '</div><div class="face-area-label">面 #' + item.face + '</div></div><div class="face-area-value">' + item.area.toFixed(2) + ' mm²</div>';
        div.addEventListener('click', function() { highlightFace(item.face - 1); });
        div.addEventListener('dblclick', function() { 
            highlightFace(item.face - 1); 
            focusCameraOnFace(item.face - 1); 
        });
        container.appendChild(div);
    });
}

// 聚焦相机到指定面
function focusCameraOnFace(faceIndex) {
    if (!currentStepFile) {
        console.log('No step file loaded');
        return;
    }

    console.log('Focusing camera on face index:', faceIndex);

    // 先尝试获取面的几何信息
    fetch('/api/step/face-geometry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: currentStepFile, face_index: faceIndex })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success && data.face_geometry) {
            moveCameraToGeometry(data.face_geometry);
        } else {
            console.log('No face geometry available, using bounding box');
            moveCameraToBoundingBox();
        }
    })
    .catch(function(error) {
        console.error('Error fetching face geometry:', error);
        moveCameraToBoundingBox();
    });
}

// 移动相机到几何中心
function moveCameraToGeometry(faceGeometry) {
    const vertices = faceGeometry.vertices;
    if (!vertices || vertices.length === 0) {
        moveCameraToBoundingBox();
        return;
    }

    // 计算面的中心点
    let center = new THREE.Vector3(0, 0, 0);
    let count = 0;
    
    vertices.forEach(function(v) {
        center.x += v[0];
        center.y += v[1];
        center.z += v[2];
        count++;
    });
    center.divideScalar(count);

    animateCameraToPoint(center);
}

// 移动相机到整个模型的包围盒中心
function moveCameraToBoundingBox() {
    if (!currentModel) return;

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    animateCameraToPoint(center);
}

// 动画移动相机到指定点
function animateCameraToPoint(targetPoint) {
    if (!camera || !controls) return;

    // 计算相机距离
    let distance = 3;
    if (currentModel) {
        const box = new THREE.Box3().setFromObject(currentModel);
        const size = box.getSize(new THREE.Vector3());
        distance = Math.max(size.x, size.y, size.z) * 1.5;
    }

    // 计算目标相机位置
    const targetCameraPos = new THREE.Vector3(
        targetPoint.x + distance * 0.5,
        targetPoint.y + distance * 0.3,
        targetPoint.z + distance * 0.5
    );

    // 动画参数
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 800; // 毫秒
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        
        // 缓动函数 (ease-out-cubic)
        const ease = 1 - Math.pow(1 - t, 3);

        // 平滑移动相机
        camera.position.lerpVectors(startPos, targetCameraPos, ease);
        
        // 平滑移动目标点
        controls.target.lerpVectors(startTarget, targetPoint, ease);

        controls.update();

        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

function filterFaceAreas(searchText) {
    if (!searchText) {
        filteredFaceAreas = faceAreasData;
    } else {
        filteredFaceAreas = faceAreasData.filter(function(item) {
            return item.face.toString().includes(searchText) || 
                   item.area.toFixed(2).includes(searchText);
        });
    }
    renderFaceAreasList();
}

function highlightFace(faceIndex) {
    if (!currentStepFile) {
        console.log('No step file loaded');
        return;
    }

    console.log('Highlighting face index:', faceIndex);
    clearHighlight();

    const items = document.querySelectorAll('.face-area-item');
    items.forEach(function(item) {
        const idx = parseInt(item.dataset.faceIndex);
        item.classList.toggle('highlighted', idx === faceIndex);
    });

    fetch('/api/step/face-geometry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: currentStepFile, face_index: faceIndex })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        console.log('Received face geometry data:', data);
        if (data.success && data.face_geometry) {
            createHighlightMesh(data.face_geometry);
        } else {
            console.log('No face geometry available');
            createSimpleHighlight();
        }
    })
    .catch(function(error) {
        console.error('Error fetching face geometry:', error);
        createSimpleHighlight();
    });
}

function createSimpleHighlight() {
    // 在创建新高亮之前先清除旧的高亮，确保每次只显示一个
    clearHighlight();
    
    console.log('Creating simple highlight');
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshPhongMaterial({
        color: 0xff4444,
        emissive: 0xff0000,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });
    highlightedFace = new THREE.Mesh(geometry, material);
    if (currentModel) {
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        highlightedFace.position.copy(center);
    }
    scene.add(highlightedFace);
}

function createHighlightMesh(faceGeometry) {
    // 在创建新高亮之前先清除旧的高亮，确保每次只显示一个
    clearHighlight();
    
    const vertices = faceGeometry.vertices;
    const indices = faceGeometry.indices;

    console.log('Creating highlight mesh - vertices:', vertices ? vertices.length : 0, 'indices:', indices ? indices.length : 0);

    if (!vertices || !indices || vertices.length === 0 || indices.length === 0) {
        console.log('No valid geometry data');
        createSimpleHighlight();
        return;
    }

    const geometry = new THREE.BufferGeometry();

    try {
        const verticesArray = new Float32Array(vertices.flat());
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verticesArray, 3));

        const indicesArray = new Uint32Array(indices);
        geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));

        geometry.computeVertexNormals();

        // 使用更明显的高亮颜色和效果
        const material = new THREE.MeshPhongMaterial({
            color: 0xff4444,
            emissive: 0xff0000,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            wireframe: false
        });

        highlightedFace = new THREE.Mesh(geometry, material);
        scene.add(highlightedFace);

        console.log('Highlight mesh added to scene');
    } catch (e) {
        console.error('Error creating highlight mesh:', e);
        createSimpleHighlight();
    }
}

function clearHighlight() {
    const items = document.querySelectorAll('.face-area-item');
    items.forEach(function(item) { item.classList.remove('highlighted'); });

    if (highlightedFace) {
        scene.remove(highlightedFace);
        if (highlightedFace.geometry) {
            highlightedFace.geometry.dispose();
        }
        if (highlightedFace.material) {
            highlightedFace.material.dispose();
        }
        highlightedFace = null;
        console.log('Highlight mesh cleared');
    }
}

function displayFacesInfo(facesInfo) {
    const container = document.getElementById('facesInfoList');
    if (!container) return;
    
    container.innerHTML = '';

    if (facesInfo.length === 0) {
        container.innerHTML = '<div class="face-info-item">没有找到颜色信息</div>';
    } else {
        facesInfo.forEach(function(item, index) {
            const div = document.createElement('div');
            div.className = 'face-info-item';
            const r = item.color.r;
            const g = item.color.g;
            const b = item.color.b;
            const hexColor = '#' + [r, g, b].map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
            div.innerHTML = '<div class="face-info-left"><div class="face-color-preview" style="background-color: ' + hexColor + ';"></div><div class="face-name">零件 ' + (index + 1) + ': ' + item.label + '</div></div><div class="face-rgb-value">RGB(' + r + ', ' + g + ', ' + b + ')</div>';
            container.appendChild(div);
        });
    }

    const partCountBadge = document.getElementById('partCountBadge');
    if (partCountBadge) {
        partCountBadge.textContent = facesInfo.length + ' 个零件';
    }

    document.getElementById('facesInfoCard').style.display = 'block';
}

function exportFaceAreas() {
    if (faceAreasData.length === 0) return;

    let content = 'Face,Area (mm²)\n';
    faceAreasData.forEach(function(item) {
        content += 'Face ' + item.face + ',' + item.area.toFixed(4) + '\n';
    });

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'face_areas.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function uploadStepFile(file) {
    showLoading(true);
    setStatus('uploadStatus', '上传中...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/step/upload', {
        method: 'POST',
        body: formData
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        showLoading(false);
        if (data.success) {
            currentStepFile = data.file;
            const infoFileName = document.getElementById('infoFileName');
            const infoStatus = document.getElementById('infoStatus');
            const fileInfo = document.getElementById('fileInfo');
            
            if (infoFileName) infoFileName.textContent = data.filename;
            if (infoStatus) infoStatus.textContent = '上传成功';
            if (fileInfo) fileInfo.style.display = 'block';
            
            setStatus('uploadStatus', '上传成功！', 'success');

            fetchFaceAreas(data.file);
            fetchFacesInfo(data.file);
            convertToGLTFAndLoad(data.file);
        } else {
            setStatus('uploadStatus', '上传失败: ' + data.error, 'error');
        }
    })
    .catch(function(error) {
        showLoading(false);
        setStatus('uploadStatus', '上传失败: ' + error.message, 'error');
    });
}

function convertToGLTFAndLoad(file) {
    showLoading(true);
    setStatus('uploadStatus', '转换中...', 'info');

    fetch('/api/step/to-gltf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        showLoading(false);
        if (data.success) {
            loadGLTF('/outputs/' + data.gltf_file);
        } else {
            setStatus('uploadStatus', '转换失败: ' + data.error, 'error');
        }
    })
    .catch(function(error) {
        showLoading(false);
        setStatus('uploadStatus', '转换失败: ' + error.message, 'error');
    });
}

function fetchFaceAreas(file) {
    fetch('/api/step/face-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            displayFaceAreas(data.face_areas);
        }
    })
    .catch(function(error) {
        console.error('Error fetching face areas:', error);
    });
}

function fetchFacesInfo(file) {
    fetch('/api/step/faces-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            displayFacesInfo(data.faces_info);
        }
    })
    .catch(function(error) {
        console.error('Error fetching faces info:', error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('STEP page loaded!');
    init();
});