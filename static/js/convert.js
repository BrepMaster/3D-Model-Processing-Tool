let currentFile = null;

function setStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status-text status-${type}`;
    }
}

document.getElementById('convertBtn').addEventListener('click', function() {
    document.getElementById('convertFileInput').click();
});

document.getElementById('convertFileInput').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        currentFile = file;
        document.getElementById('selectedFileName').textContent = file.name;

        const ext = file.name.split('.').pop().toLowerCase();
        const inputFormatSelect = document.getElementById('inputFormat');
        inputFormatSelect.value = ext;
    } else {
        currentFile = null;
        document.getElementById('selectedFileName').textContent = '未选择文件';
        document.getElementById('inputFormat').value = '';
    }
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

// 拖拽上传功能 - 支持整个页面拖拽
document.addEventListener('DOMContentLoaded', function() {
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
            const file = files[0];
            document.getElementById('selectedFileName').textContent = file.name;

            const ext = file.name.split('.').pop().toLowerCase();
            const inputFormatSelect = document.getElementById('inputFormat');
            inputFormatSelect.value = ext;

            // 设置文件到input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('convertFileInput').files = dataTransfer.files;
            currentFile = file;
        }
    });
});