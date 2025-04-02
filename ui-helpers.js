// Helper functions for UI management

/**
 * Sets up drag and drop event handlers for a given element.
 * @param {HTMLElement} element The element to attach handlers to.
 * @param {Function} onDrop Callback function to execute when files are dropped.
 */
export function setupDropHandlers(element, onDrop) {
    if (!element || typeof onDrop !== 'function') {
        console.error("setupDropHandlers requires an element and an onDrop callback.");
        return;
    }

    // Define handler functions once
    const handleDragOver = (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        // Check if the leave target is outside the element boundary
        if (!element.contains(e.relatedTarget)) {
            element.classList.remove('drag-over');
        }
    };

    // Use the passed onDrop callback directly
    const handleDrop = (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        onDrop(e); // Call the provided callback with the event object
    };

    const handleClick = () => {
        // Only trigger click for the upload area itself
        if (element.id === 'upload-area') {
             const fileInput = document.getElementById('file-input');
             if (fileInput) fileInput.click();
             else console.error("File input element not found on click.");
        }
         // If the placeholder is clicked, also trigger the file input
         else if (element.classList.contains('image-placeholder')) {
             const fileInput = document.getElementById('file-input');
             if (fileInput) fileInput.click();
             else console.error("File input element not found on placeholder click.");
         }
    };

    // --- Event Listener Management ---
    // Store handlers on the element to remove them correctly later
    element._dropHandlers = {
        dragover: handleDragOver,
        dragleave: handleDragLeave,
        drop: handleDrop,
        click: handleClick
    };

    // Remove any previously attached listeners using the stored references
    if (element._oldDropHandlers) {
        element.removeEventListener('dragover', element._oldDropHandlers.dragover, true);
        element.removeEventListener('dragleave', element._oldDropHandlers.dragleave, true);
        element.removeEventListener('drop', element._oldDropHandlers.drop, true);
        element.removeEventListener('click', element._oldDropHandlers.click, true);
    }

    // Add new listeners
    element.addEventListener('dragover', handleDragOver, true);
    element.addEventListener('dragleave', handleDragLeave, true);
    element.addEventListener('drop', handleDrop, true);
    element.addEventListener('click', handleClick, true); // Add click listener to both

    // Store the currently attached handlers for future removal
    element._oldDropHandlers = { ...element._dropHandlers };


    return element; // Return the element for chaining or reference
}

// Create or update image placeholder
export function createImagePlaceholder(imageSrc, onDropCallback) {
    const container = document.querySelector('.image-container');
    if (!container) {
        console.error("Image container not found.");
        return null;
    }

    // Get upload area (it might already be hidden)
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.style.display = 'none'; // Hide upload area
    }

    // Create or find placeholder
    let placeholder = container.querySelector('.image-placeholder');
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';

        const img = document.createElement('img');
        img.alt = "Uploaded image preview"; // Add alt text
        img.onload = () => {
            // Store original dimensions
            img.dataset.originalWidth = img.naturalWidth;
            img.dataset.originalHeight = img.naturalHeight;
        };
        placeholder.appendChild(img);

        // Insert the placeholder before the button if possible
        const uploadButton = container.querySelector('#upload-button');
        if (uploadButton) {
             container.insertBefore(placeholder, uploadButton);
        } else {
             container.appendChild(placeholder); // Fallback
        }
    }

    // Update the image source
    const img = placeholder.querySelector('img');
    img.src = imageSrc;
    img.dataset.originalSrc = imageSrc; // Store original source

    // Setup drop handlers on the new/updated placeholder, passing the callback
    setupDropHandlers(placeholder, onDropCallback);

    // Ensure upload area is hidden if it still exists somehow
    if (uploadArea && placeholder) {
        uploadArea.style.display = 'none';
    }

    return placeholder;
}

// Restore upload area
export function restoreUploadArea(onDropCallback) {
    const container = document.querySelector('.image-container');
    if (!container) return;

    const placeholder = container.querySelector('.image-placeholder');
    if (placeholder) {
        // Clean up listeners before removing
        if (placeholder._oldDropHandlers) {
            placeholder.removeEventListener('dragover', placeholder._oldDropHandlers.dragover, true);
            placeholder.removeEventListener('dragleave', placeholder._oldDropHandlers.dragleave, true);
            placeholder.removeEventListener('drop', placeholder._oldDropHandlers.drop, true);
            placeholder.removeEventListener('click', placeholder._oldDropHandlers.click, true);
        }
        placeholder.remove(); // Remove the image placeholder
    }

    // Find or create upload area
    let uploadArea = document.getElementById('upload-area');
    if (!uploadArea) {
        uploadArea = document.createElement('div');
        uploadArea.className = 'upload-area';
        uploadArea.id = 'upload-area';
        uploadArea.innerHTML = `
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16L12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 11L12 8L15 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 16H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" stroke-width="2"/>
            </svg>
            <p>Drop image here or click to upload</p>
            <p>You can also paste from clipboard (Ctrl+V)</p>
        `;
        // Insert before the button or append as fallback
        const uploadButton = container.querySelector('#upload-button');
        const fileInput = container.querySelector('#file-input'); // Make sure file input comes after
         if (uploadButton) {
             container.insertBefore(uploadArea, uploadButton);
        } else if (fileInput) {
             container.insertBefore(uploadArea, fileInput.nextSibling); // Insert after file input if button missing
        }
         else {
             container.appendChild(uploadArea); // Fallback
        }
    }

    uploadArea.style.display = 'flex'; // Ensure it's visible

    // Re-attach drop handlers using the callback
    setupDropHandlers(uploadArea, onDropCallback);
}