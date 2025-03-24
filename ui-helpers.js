// Helper functions for UI management

// Setup drop handlers for element
export function setupDropHandlers(element) {
    if (!element) return;
    
    // Remove any existing listeners by cloning and replacing the element
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    element = newElement;
    
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        }
    });
    
    // Only add click handler for the upload area, not for the image placeholder
    if (element.id === 'upload-area') {
        element.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.click();
        });
    }
    
    return element;
}

// Create or update image placeholder
export function createImagePlaceholder(imageSrc) {
    const container = document.querySelector('.image-container');
    
    // Remove upload area
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.remove();
    }
    
    // Create placeholder if it doesn't exist
    let placeholder = document.querySelector('.image-placeholder');
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        
        const img = document.createElement('img');
        img.onload = () => {
            // Store original dimensions
            img.dataset.originalWidth = img.naturalWidth;
            img.dataset.originalHeight = img.naturalHeight;
        };
        placeholder.appendChild(img);
        
        container.appendChild(placeholder);
        
        // Keep the upload button visible below the image
        const uploadButton = document.getElementById('upload-button');
        if (uploadButton) {
            container.appendChild(uploadButton);
        }
    } else {
        // Just update the image
        const img = placeholder.querySelector('img');
        img.src = imageSrc;
        // Clear any stored filtered image data when switching to a new image
        img.dataset.originalSrc = imageSrc;
    }
    
    // Update the image source
    const img = placeholder.querySelector('img');
    img.src = imageSrc;
    
    return placeholder;
}

// Restore upload area (if needed)
export function restoreUploadArea() {
    const container = document.querySelector('.image-container');
    if (!container) return;
    
    const placeholder = document.querySelector('.image-placeholder');
    
    if (placeholder) {
        placeholder.remove();
    }
    
    // Create upload area if it doesn't exist
    if (!document.getElementById('upload-area')) {
        const uploadArea = document.createElement('div');
        uploadArea.className = 'upload-area';
        uploadArea.id = 'upload-area';
        uploadArea.innerHTML = `
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16L12 8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 11L12 8L15 11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 16H16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="#ffffff" stroke-width="2"/>
            </svg>
            <p>Drop image here or click to upload</p>
            <p>You can also paste from clipboard (Ctrl+V)</p>
        `;
        
        container.appendChild(uploadArea);
        setupDropHandlers(uploadArea); 
    }
}