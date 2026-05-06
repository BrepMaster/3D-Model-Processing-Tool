let scene, camera, renderer, controls;
let currentMesh = null;
let boundingBoxMesh = null;
let currentSTLFile = null;

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

function uploadFile(files) {
    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    let uploadedSize = 0;

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
                loadSTL('/outputs/' + data.stl_file);
                createBoundingBox(data.bounding_box);

                const fileNames = fileArray.map(f => f.name).join(', ');
                document.getElementById('infoFileName').textContent = fileNames;
                document.getElementById('infoFileSize').textContent = (data.original_size / 1024).toFixed(2) + ' KB';
                document.getElementById('infoVertices').textContent = data.vertices || '-';
                document.getElementById('infoFaces').textContent = data.faces || '-';
                document.getElementById('infoBoundingBox').textContent = data.bounding_box.size.map(v => v.toFixed(2)).join(' x ');

                document.getElementById('modelInfo').style.display = 'block';
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

document.getElementById('showBoundingBox').addEventListener('change', function() {
    toggleBoundingBox(this.checked);
});

document.getElementById('showWireframe').addEventListener('change', function() {
    toggleWireframe(this.checked);
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