let scene, camera, renderer, controls;
let currentMesh = null;
let boundingBoxMesh = null;
let currentSTLFile = null;

function init() {
    const container = document.getElementById('canvasContainer');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    
    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
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

function loadSTL(url) {
    showLoading(true);
    
    const loader = new THREE.STLLoader();
    loader.load(url, function (geometry) {
        if (currentMesh) {
            scene.remove(currentMesh);
            currentMesh.geometry.dispose();
            currentMesh.material.dispose();
        }
        
        const material = new THREE.MeshPhongMaterial({
            color: 0x6366f1,
            specular: 0x818cf8,
            shininess: 100
        });
        
        currentMesh = new THREE.Mesh(geometry, material);
        scene.add(currentMesh);
        
        const box = new THREE.Box3().setFromObject(currentMesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        camera.position.set(center.x, center.y, center.z + cameraZ * 1.5);
        controls.target.copy(center);
        controls.update();
        
        showLoading(false);
    }, undefined, function(error) {
        console.error('Error loading STL:', error);
        showLoading(false);
    });
}

function createBoundingBox(bbox) {
    if (boundingBoxMesh) {
        scene.remove(boundingBoxMesh);
        boundingBoxMesh.geometry.dispose();
        boundingBoxMesh.material.dispose();
    }
    
    const min = new THREE.Vector3(...bbox.min);
    const max = new THREE.Vector3(...bbox.max);
    const box3 = new THREE.Box3(min, max);
    const geometry = new THREE.Box3Helper(box3, 0x22c55e);
    boundingBoxMesh = geometry;
    scene.add(boundingBoxMesh);
}

function toggleBoundingBox(show) {
    if (boundingBoxMesh) {
        boundingBoxMesh.visible = show;
    }
}

function toggleWireframe(show) {
    if (currentMesh) {
        currentMesh.material.wireframe = show;
    }
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
        element.className = `status-text status-${type}`;
    }
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    setStatus('uploadStatus', '上传中...', 'info');
    document.getElementById('uploadBtn').disabled = true;
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentSTLFile = data.stl_file;
            loadSTL('/outputs/' + data.stl_file);
            createBoundingBox(data.bounding_box);
            
            document.getElementById('infoFileName').textContent = file.name;
            document.getElementById('infoFileSize').textContent = (data.original_size / 1024).toFixed(2) + ' KB';
            document.getElementById('infoVertices').textContent = data.vertices || '-';
            document.getElementById('infoFaces').textContent = data.faces || '-';
            document.getElementById('infoBoundingBox').textContent = data.bounding_box.size.map(v => v.toFixed(2)).join(' x ');
            
            document.getElementById('modelInfo').style.display = 'block';
            document.getElementById('simplifySection').style.display = 'block';
            document.getElementById('exportSection').style.display = 'block';
            setStatus('uploadStatus', '上传成功！', 'success');
        } else {
            setStatus('uploadStatus', '上传失败: ' + data.error, 'error');
        }
    })
    .catch(error => {
        setStatus('uploadStatus', '错误: ' + error.message, 'error');
    })
    .finally(() => {
        document.getElementById('uploadBtn').disabled = false;
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabId = this.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        this.classList.add('active');
        document.getElementById(tabId + 'Tab').classList.add('active');
    });
});

document.getElementById('uploadBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        uploadFile(file);
    }
    this.value = '';
});

document.getElementById('reductionSlider').addEventListener('input', function() {
    document.getElementById('reductionValue').textContent = this.value;
});

document.getElementById('simplifyBtn').addEventListener('click', function() {
    if (!currentSTLFile) return;
    
    const reductionRatio = parseFloat(document.getElementById('reductionSlider').value);
    setStatus('simplifyStatus', '简化中...', 'info');
    document.getElementById('simplifyBtn').disabled = true;
    
    fetch('/simplify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            stl_file: currentSTLFile,
            reduction_ratio: reductionRatio
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentSTLFile = data.simplified_file;
            loadSTL('/outputs/' + data.simplified_file);
            createBoundingBox(data.bounding_box);
            
            document.getElementById('infoVertices').textContent = data.vertices || '-';
            document.getElementById('infoFaces').textContent = data.faces || '-';
            document.getElementById('infoBoundingBox').textContent = data.bounding_box.size.map(v => v.toFixed(2)).join(' x ');
            
            setStatus('simplifyStatus', `简化成功！新大小: ${(data.file_size / 1024).toFixed(2)} KB`, 'success');
        } else {
            setStatus('simplifyStatus', '简化失败: ' + data.error, 'error');
        }
    })
    .catch(error => {
        setStatus('simplifyStatus', '错误: ' + error.message, 'error');
    })
    .finally(() => {
        document.getElementById('simplifyBtn').disabled = false;
    });
});

document.getElementById('showBoundingBox').addEventListener('change', function() {
    toggleBoundingBox(this.checked);
});

document.getElementById('showWireframe').addEventListener('change', function() {
    toggleWireframe(this.checked);
});

function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            setTimeout(() => resolve(), 100);
        })
        .catch(error => {
            console.error('下载失败:', error);
            reject(error);
        });
    });
}

document.getElementById('exportBtn').addEventListener('click', function() {
    if (!currentSTLFile) {
        alert('请先上传模型');
        return;
    }
    
    const customName = document.getElementById('exportFileName').value.trim();
    const nameMode = document.querySelector('input[name="exportNameMode"]:checked').value;
    
    let downloadName = 'model';
    
    if (customName) {
        downloadName = customName;
    } else if (nameMode === 'date') {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        downloadName = `model_${dateStr}`;
    }
    
    downloadFile('/outputs/' + currentSTLFile, downloadName + '.stl');
});

document.getElementById('convertBtn').addEventListener('click', function() {
    document.getElementById('convertFileInput').click();
});

document.getElementById('convertFileInput').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        document.getElementById('selectedFileName').textContent = file.name;
        
        const ext = file.name.split('.').pop().toLowerCase();
        const inputFormatSelect = document.getElementById('inputFormat');
        inputFormatSelect.value = ext;
    } else {
        document.getElementById('selectedFileName').textContent = '未选择文件';
        document.getElementById('inputFormat').value = '';
    }
});

document.getElementById('convertAllBtn').addEventListener('click', async function() {
    const fileInput = document.getElementById('convertFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        setStatus('convertStatus', '请先选择文件', 'error');
        return;
    }
    
    const selectedFormats = Array.from(document.querySelectorAll('.outputFormatCheckbox:checked'))
        .map(checkbox => checkbox.value);
    
    if (selectedFormats.length === 0) {
        setStatus('convertStatus', '请至少选择一种输出格式', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    selectedFormats.forEach(format => {
        formData.append('output_formats[]', format);
    });
    
    setStatus('convertStatus', '转换中...', 'info');
    document.getElementById('convertAllBtn').disabled = true;
    
    try {
        const response = await fetch('/convert', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            const customName = document.getElementById('convertFileName').value.trim();
            const nameMode = document.querySelector('input[name="convertNameMode"]:checked').value;
            const originalName = file.name.replace(/\.[^/.]+$/, '');
            
            for (const result of data.results) {
                let downloadName = 'converted';
                
                if (customName) {
                    downloadName = customName;
                } else if (nameMode === 'date') {
                    const now = new Date();
                    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
                    downloadName = `${originalName}_${dateStr}`;
                } else {
                    downloadName = originalName;
                }
                
                await downloadFile('/outputs/' + result.file, downloadName + '.' + result.format);
            }
            
            setStatus('convertStatus', `转换成功！已下载 ${data.results.length} 个文件`, 'success');
        } else {
            setStatus('convertStatus', '转换失败: ' + data.error, 'error');
        }
    } catch (error) {
        setStatus('convertStatus', '错误: ' + error.message, 'error');
    } finally {
        document.getElementById('convertAllBtn').disabled = false;
    }
});

init();