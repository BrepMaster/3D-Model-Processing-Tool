let scene, camera, renderer, controls;
let originalMesh = null;
let simplifiedMesh = null;
let currentSTLFile = null;
let simplifiedSTLFile = null;
let showOriginal = true;
let showSimplified = true;

function init() {
    const container = document.getElementById('canvasContainer');
    
    scene = new THREE.Scene();
    // 初始化时应用主题背景色
    const savedTheme = localStorage.getItem('theme') || 'default';
    scene.background = new THREE.Color(getSceneBackgroundColor(savedTheme));
    
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
    
    // 监听主题变化事件
    document.addEventListener('themeChanged', function(e) {
        if (scene) {
            scene.background = new THREE.Color(getSceneBackgroundColor(e.detail.theme));
        }
    });
    
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

function loadSTL(url, meshType) {
    showLoading(true);
    
    const loader = new THREE.STLLoader();
    loader.load(url, function (geometry) {
        const material = new THREE.MeshPhongMaterial({
            color: meshType === 'original' ? 0x6366f1 : 0x22c55e,
            specular: meshType === 'original' ? 0x818cf8 : 0x4ade80,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        if (meshType === 'original') {
            if (originalMesh) {
                scene.remove(originalMesh);
                originalMesh.geometry.dispose();
                originalMesh.material.dispose();
            }
            originalMesh = mesh;
            scene.add(originalMesh);
        } else {
            if (simplifiedMesh) {
                scene.remove(simplifiedMesh);
                simplifiedMesh.geometry.dispose();
                simplifiedMesh.material.dispose();
            }
            simplifiedMesh = mesh;
            scene.add(simplifiedMesh);
        }
        
        const box = new THREE.Box3().setFromObject(scene);
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

function toggleOriginalMesh(show) {
    showOriginal = show;
    if (originalMesh) {
        originalMesh.visible = show;
    }
}

function toggleSimplifiedMesh(show) {
    showSimplified = show;
    if (simplifiedMesh) {
        simplifiedMesh.visible = show;
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function setChangeValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.remove('change-positive', 'change-negative', 'change-neutral');

    if (value === '-') {
        element.textContent = '-';
        element.classList.add('change-neutral');
    } else {
        const numValue = parseFloat(value);
        element.textContent = numValue + '%';
        
        if (numValue < 0) {
            element.classList.add('change-negative');
        } else if (numValue > 0) {
            element.classList.add('change-positive');
        } else {
            element.classList.add('change-neutral');
        }
    }
}

function setStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status-text status-${type}`;
    }
}

function uploadFile(files) {
    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);

    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressSize = document.getElementById('progressSize');

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '上传中: 0%';
    progressSize.textContent = `0 KB / ${(totalSize / 1024).toFixed(1)} KB`;

    setStatus('uploadStatus', '上传中...', 'info');
    document.getElementById('uploadBtn').disabled = true;

    const formData = new FormData();
    fileArray.forEach(f => formData.append('file', f));

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
            const currentProgress = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = currentProgress + '%';
            progressText.textContent = `上传中: ${currentProgress}%`;
            progressSize.textContent = `${(e.loaded / 1024).toFixed(1)} KB / ${(e.total / 1024).toFixed(1)} KB`;
        }
    });

    xhr.addEventListener('load', function() {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
                currentSTLFile = data.stl_file;
                loadSTL('/outputs/' + data.stl_file, 'original');

                document.getElementById('compareFileSize').textContent = (data.original_size / 1024).toFixed(2) + ' KB';
                document.getElementById('compareVertices').textContent = data.vertices || '-';
                document.getElementById('compareFaces').textContent = data.faces || '-';
                document.getElementById('compareSizeChange').textContent = '-';
                document.getElementById('compareVertexChange').textContent = '-';
                document.getElementById('compareFaceChange').textContent = '-';

                document.getElementById('comparisonSection').style.display = 'block';
                document.getElementById('simplifySection').style.display = 'block';
                setStatus('uploadStatus', '上传成功！', 'success');
                progressFill.style.width = '100%';
                progressText.textContent = '上传完成';
            } else {
                setStatus('uploadStatus', '上传失败: ' + data.error, 'error');
                progressContainer.style.display = 'none';
            }
        } else {
            setStatus('uploadStatus', '上传失败: HTTP ' + xhr.status, 'error');
            progressContainer.style.display = 'none';
        }
        document.getElementById('uploadBtn').disabled = false;
    });

    xhr.addEventListener('error', function() {
        setStatus('uploadStatus', '上传失败: 网络错误', 'error');
        progressContainer.style.display = 'none';
        document.getElementById('uploadBtn').disabled = false;
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
}

document.getElementById('uploadBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function() {
    const files = this.files;
    if (files.length > 0) {
        uploadFile(files);
    }
    this.value = '';
});

// 定义预设值
const PRESET_VALUES = [0.2, 0.5, 0.8];

// 滑块值变化时更新
document.getElementById('reductionSlider').addEventListener('input', function() {
    const value = parseFloat(this.value);
    updateReductionValue(value);
});

// 滑块释放时进行吸附
document.getElementById('reductionSlider').addEventListener('change', function() {
    const value = parseFloat(this.value);
    const snappedValue = snapToPreset(value);
    updateReductionValue(snappedValue);
});

// 预设按钮点击
document.querySelectorAll('.preset-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const value = parseFloat(this.dataset.value);
        updateReductionValue(value);
        
        // 更新按钮激活状态
        document.querySelectorAll('.preset-btn').forEach(function(b) {
            b.classList.remove('active');
        });
        this.classList.add('active');
    });
});

// 自定义输入框变化
document.getElementById('customReductionInput').addEventListener('input', function() {
    let value = parseFloat(this.value);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 0.95) value = 0.95;
    updateReductionValue(value);
});

document.getElementById('customReductionInput').addEventListener('change', function() {
    let value = parseFloat(this.value);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 0.95) value = 0.95;
    this.value = value;
    updateReductionValue(value);
});

// 更新所有相关元素的函数
function updateReductionValue(value) {
    document.getElementById('reductionValue').textContent = value;
    document.getElementById('reductionSlider').value = value;
    document.getElementById('customReductionInput').value = value;
    
    // 更新预设按钮激活状态
    document.querySelectorAll('.preset-btn').forEach(function(btn) {
        const btnValue = parseFloat(btn.dataset.value);
        if (Math.abs(btnValue - value) < 0.01) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 吸附到预设值的函数
function snapToPreset(value) {
    for (let preset of PRESET_VALUES) {
        if (Math.abs(value - preset) < 0.05) {
            return preset;
        }
    }
    return value;
}

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
            simplifiedSTLFile = data.simplified_file;
            loadSTL('/outputs/' + data.simplified_file, 'simplified');

            document.getElementById('compareSimplifiedFileSize').textContent = (data.file_size / 1024).toFixed(2) + ' KB';
            document.getElementById('compareSimplifiedVertices').textContent = data.vertices || '-';
            document.getElementById('compareSimplifiedFaces').textContent = data.faces || '-';
            document.getElementById('compareRatio').textContent = (reductionRatio * 100).toFixed(0) + '%';

            const originalSize = parseFloat(document.getElementById('compareFileSize').textContent);
            const simplifiedSize = (data.file_size / 1024).toFixed(2);
            const sizeChange = ((simplifiedSize - originalSize) / originalSize * 100).toFixed(1);
            setChangeValue('compareSizeChange', sizeChange);

            const originalVertices = parseInt(document.getElementById('compareVertices').textContent) || 0;
            const simplifiedVertices = parseInt(data.vertices) || 0;
            const vertexChange = originalVertices > 0 ? (((simplifiedVertices - originalVertices) / originalVertices) * 100).toFixed(1) : '-';
            setChangeValue('compareVertexChange', vertexChange);

            const originalFaces = parseInt(document.getElementById('compareFaces').textContent) || 0;
            const simplifiedFaces = parseInt(data.faces) || 0;
            const faceChange = originalFaces > 0 ? (((simplifiedFaces - originalFaces) / originalFaces) * 100).toFixed(1) : '-';
            setChangeValue('compareFaceChange', faceChange);

            setStatus('simplifyStatus', `简化成功！`, 'success');
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

document.getElementById('showOriginal').addEventListener('change', function() {
    toggleOriginalMesh(this.checked);
});

document.getElementById('showSimplified').addEventListener('change', function() {
    toggleSimplifiedMesh(this.checked);
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

document.getElementById('downloadSimplifiedBtn').addEventListener('click', function() {
    if (!simplifiedSTLFile) {
        alert('请先进行模型简化');
        return;
    }

    downloadFile('/outputs/' + simplifiedSTLFile, 'simplified_model.stl');
});

document.addEventListener('DOMContentLoaded', function() {
    init();

    const uploadArea = document.getElementById('uploadArea');
    const uploadText = uploadArea ? uploadArea.querySelector('.upload-text') : null;
    const originalText = uploadText ? uploadText.textContent : '';

    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (uploadArea) {
            uploadArea.classList.add('drag-over');
            if (uploadText) uploadText.textContent = '释放以上传文件';
        }
    });

    document.addEventListener('dragleave', function(e) {
        e.preventDefault();
        if (uploadArea) {
            uploadArea.classList.remove('drag-over');
            if (uploadText) uploadText.textContent = originalText;
        }
    });

    document.addEventListener('drop', function(e) {
        e.preventDefault();
        if (uploadArea) {
            uploadArea.classList.remove('drag-over');
            if (uploadText) uploadText.textContent = originalText;
        }

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files);
        }
    });
});