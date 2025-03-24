import { analyzeImage, rgbToHsl, hslToRgb, rgbToCssColor, rgbToHex } from './colorUtils.js';
import { config } from './config.js';
import { createImagePlaceholder, restoreUploadArea, setupDropHandlers } from './ui-helpers.js';
import { generatePaletteName } from './paletteNaming.js';
import { applyFilterToPalette, applyFilterToImage, filters } from './colorFilters.js';
import { applyBrightnessContrast, applyHueShift, getPaletteState, setPaletteState, resetPaletteEffects } from './paletteEffects.js';
import { debounce } from './utils.js';
import { simplifyPalette } from './paletteSimplifier.js';
import { applyWarmCoolAdjustment } from './colorWarmCool.js';
import { initPresetLibrary } from './paletteLibrary.js';
import { copyPaletteToClipboard } from './clipboardUtils.js'; // Import new function
import { applyAllEffects } from './paletteStateManager.js';

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const uploadButton = document.getElementById('upload-button');
    const paletteDisplay = document.getElementById('palette-display');
    const paletteContainer = document.getElementById('palette-container');
    const emptyPaletteMessage = document.querySelector('.empty-palette-message');
    const paletteActions = document.getElementById('palette-actions');
    const downloadButton = document.getElementById('download-palette');
    const copyHslButton = document.getElementById('copy-hsl');
    const downloadSwatchesButton = document.getElementById('download-swatches');
    const simplifyPaletteButton = document.getElementById('simplify-palette');
    const colorSlider = document.getElementById('color-slider');
    const colorCountDisplay = document.getElementById('color-count');
    const paletteView = document.getElementById('palette-view');
    const paletteTitle = document.getElementById('palette-title');
    const paletteTitleInput = document.getElementById('palette-title-input');
    const editPencilIcon = document.getElementById('edit-pencil-icon');
    
    // Filter controls
    const filterSelector = document.getElementById('filter-selector');
    const filterStrength = document.getElementById('filter-strength');
    const filterStrengthValue = document.getElementById('filter-strength-value');
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValue = document.getElementById('brightness-value');
    const hueShiftSlider = document.getElementById('hue-shift-slider');
    const hueShiftValue = document.getElementById('hue-shift-value');
    const warmCoolSlider = document.getElementById('warm-cool-slider');
    const warmCoolValue = document.getElementById('warm-cool-value');
    const copyHexButton = document.getElementById('copy-hex'); // Get copy hex button
    const copyMessage = document.getElementById('copy-message'); // Get copy message
    

    // Initially show the palette view with default gradient
    paletteView.style.display = 'flex';
    
    // Create default rainbow gradient palette
    const createDefaultPalette = () => {
        const colors = [];
        for (let i = 0; i < 30; i++) {
            // Generate colors in full hue spectrum (0-360 degrees)
            const h = i * 12; // Evenly distribute 30 colors across 360 degrees
            const s = 80 + (i % 2) * 10; // Slight variation in saturation
            const l = 50 + ((i % 3) - 1) * 10; // Variation in lightness
            
            const rgb = hslToRgb(h, s, l);
            colors.push({r: rgb.r, g: rgb.g, b: rgb.b});
        }
        return colors;
    };
    
    // Initialize with default colors
    let extractedColors = createDefaultPalette();
    let originalColors = [...extractedColors]; // Keep a copy of original colors before filtering
    displayColorPalette(extractedColors);
    paletteTitle.textContent = "Rainbow Gradient";
    
    // Load the default image
    loadDefaultImage();
    
    // Set up color palette title editing
    let isEditingTitle = false;
    
    paletteTitle.addEventListener('click', toggleEditTitle);
    editPencilIcon.addEventListener('click', toggleEditTitle);
    
    paletteTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            toggleEditTitle();
        }
    });
    
    function toggleEditTitle() {
        isEditingTitle = !isEditingTitle;
        
        if (isEditingTitle) {
            paletteTitle.style.display = 'none';
            editPencilIcon.style.display = 'none';
            paletteTitleInput.style.display = 'block';
            paletteTitleInput.value = paletteTitle.textContent;
            paletteTitleInput.focus();
        } else {
            paletteTitle.style.display = 'inline';
            editPencilIcon.style.display = 'inline';
            paletteTitleInput.style.display = 'none';
            paletteTitle.textContent = paletteTitleInput.value;
        }
    }
    
    // Set up event listeners
    uploadArea && setupDropHandlers(uploadArea);
    uploadButton && uploadButton.addEventListener('click', () => fileInput.click());
    fileInput && fileInput.addEventListener('change', handleFileSelect);
    downloadSwatchesButton && downloadSwatchesButton.addEventListener('click', downloadProcreateSwatches);
    simplifyPaletteButton && simplifyPaletteButton.addEventListener('click', handleSimplifyPalette);
    
    // Move color slider initial setup
    const sliderContainer = document.querySelector('.slider-container');
    if (sliderContainer) {
        document.querySelector('.palette-title-row')?.appendChild(sliderContainer);
    }
    
    if (colorSlider) {
        colorSlider.addEventListener('input', handleColorSliderChange);
        colorSlider.addEventListener('change', handleColorSliderFinalChange);
        colorSlider.min = "3";
        colorSlider.max = config.maxColors.toString();
        colorSlider.value = config.numColors.toString();
        colorCountDisplay.textContent = config.numColors;
    }

    let currentImage = null;
    let allPalettes = {}; // Store all pre-calculated palettes
    let unmodifiedColors = []; // Store colors before any filters are applied
    let processingImage = false; // Flag to prevent multiple simultaneous processing
    let lastProcessedImage = null; // Cache last processed image source
    let cachedPaletteName = null; // Cache the generated palette name
    
    // Debounced image processing function (created once at initialization)
    const debouncedProcessImage = debounce((imageSrc, numColors) => {
        if (lastProcessedImage === imageSrc) return; // Skip if same image is processed again
        resizeAndAnalyzeImage(imageSrc);
    }, 500);

    function setupDropHandlers(element) {
        if (!element) return;
        
        // Remove any existing listeners by cloning and replacing the element
        const newElement = element.cloneNode(true);
        if (element.parentNode) {
            element.parentNode.replaceChild(newElement, element);
        }
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
                handleFiles(e.dataTransfer.files);
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
    

    function handleFiles(files) {
        if (files.length === 0 || processingImage) return;
        
        const file = files[0];
        if (!file.type.match('image.*')) {
            alert('Please select an image file.');
            return;
        }

        // Set processing flag to prevent multiple simultaneous analyses
        processingImage = true;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            // Reset all filter effects when loading a new image
            resetPaletteEffects();
            resetFilterSliders();
            cachedPaletteName = null; // Clear cached palette name for new image
            
            // Create image placeholder instead of thumbnail
            const placeholder = createImagePlaceholder(e.target.result);
            setupDropHandlers(placeholder); // Add drop handlers to allow replacement
            
            currentImage = e.target.result;
            
            // Show loading indicator
            showLoading();
            
            // Use debounced function to process image
            debouncedProcessImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    function handleFileSelect(e) {
        handleFiles(e.target.files);
    }

    // New function to resize the image before analysis with caching
    function resizeAndAnalyzeImage(imageSrc) {
        // Check if this is the same image we just processed
        if (lastProcessedImage === imageSrc) {
            processingImage = false;
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate new dimensions (max 800x800 while maintaining aspect ratio)
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > 800) {
                height = Math.floor(height * (800 / width));
                width = 800;
            } else if (height > 800) {
                width = Math.floor(width * (800 / height));
                height = 800;
            }
            
            // Set canvas size and draw resized image
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Create a new resized image for analysis
            const resizedImg = new Image();
            resizedImg.onload = () => {
                // Pre-calculate all palettes using the resized image
                allPalettes = analyzeImage(resizedImg, null, "dominant", config);
                
                // Display the palette for current slider value
                const numColors = parseInt(colorSlider.value);
                originalColors = allPalettes[numColors] || [];
                
                // Store unmodified colors for filter chains
                unmodifiedColors = [...originalColors];
                
                // Reset any active filter
                resetFilterSliders();
                
                // Display unfiltered colors
                extractedColors = [...originalColors];
                displayColorPalette(extractedColors);
                
                // Update palette state with original colors
                setPaletteState({
                    originalColors: [...originalColors],
                    currentColors: [...extractedColors],
                    numColors: numColors,
                    filter: 'none',
                    filterStrength: 50,
                    brightness: 0,
                    hueShift: 0
                });
                
                // Auto-name the palette based on the palette
                if (currentImage) {
                    // Use cached name if available, otherwise generate new one
                    if (!cachedPaletteName) {
                        cachedPaletteName = generatePaletteName(extractedColors);
                    }
                    paletteTitle.textContent = cachedPaletteName;
                }
                
                // Cache the processed image source to avoid duplicate processing
                lastProcessedImage = imageSrc;
                
                // Reset processing flag
                processingImage = false;
            };
            resizedImg.src = canvas.toDataURL('image/jpeg');
        };
        img.src = imageSrc;
    }

    function clearImage() {
        restoreUploadArea();
        
        // Reset to default palette
        originalColors = createDefaultPalette();
        extractedColors = [...originalColors];
        displayColorPalette(extractedColors);
        paletteTitle.textContent = "Rainbow Gradient";
        
        // Reset filter
        filterSelector.value = 'none';
        filterStrength.value = 50;
        filterStrengthValue.textContent = '50%';
        
        // Clear stored palettes
        allPalettes = {};
        
        // Re-initialize the upload area with event listeners
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) {
            setupDropHandlers(uploadArea);
        }
    }

    function displayColorPalette(colors) {
        paletteDisplay.innerHTML = '';
        emptyPaletteMessage.style.display = 'none';
        paletteActions.hidden = false;

        // Create 30 slots (3 rows of 10)
        const totalSlots = 30;
        
        // Remove Clear button if it exists - we don't need it anymore
        const clearButton = document.getElementById('clear-image');
        if (clearButton) {
            clearButton.remove();
        }
        
        // Set palette container to full width
        paletteDisplay.style.width = '100%';
        
        // Fill available colors
        for (let i = 0; i < totalSlots; i++) {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            if (i < colors.length && colors[i] !== null) {
                const { r, g, b } = colors[i];
                const colorSample = document.createElement('div');
                colorSample.className = 'color-sample';
                colorSample.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                
                colorItem.appendChild(colorSample);
                
                // Store color data as attributes for potential use
                colorItem.dataset.r = r;
                colorItem.dataset.g = g;
                colorItem.dataset.b = b;
            } else {
                // Empty slot
                colorItem.innerHTML = '<div class="empty-color-slot"></div>';
            }
            
            paletteDisplay.appendChild(colorItem);
        }
    }

    function handleColorSliderChange(e) {
        const numColors = parseInt(e.target.value);
        colorCountDisplay.textContent = numColors;
        
        if (Object.keys(allPalettes).length > 0) {
            // Get current palette state to maintain filter settings
            const state = getPaletteState();
            
            // Update original colors based on new count
            state.originalColors = allPalettes[numColors] || [];
            unmodifiedColors = [...state.originalColors];
            
            // Re-apply all filters to new color set
            let processedColors = [...state.originalColors];
            
            if (state.filter !== 'none' && state.filterStrength > 0) {
                processedColors = applyFilterToPalette(processedColors, state.filter, state.filterStrength);
            }
            
            if (state.brightness !== 0) {
                processedColors = applyBrightnessContrast(processedColors, state.brightness);
            }
            
            if (state.hueShift !== 0) {
                processedColors = applyHueShift(processedColors, state.hueShift);
            }
            
            // Update the current colors in state
            state.currentColors = processedColors;
            state.numColors = numColors;
            setPaletteState(state);
            
            displayColorPalette(processedColors);
        } else if (currentImage) {
            // Fallback to calculating just this palette
            processImageWithColorCount(currentImage, numColors);
        }
    }

    function handleColorSliderFinalChange(e) {
        // Update palette state after slider is released
        const state = getPaletteState();
        state.numColors = parseInt(e.target.value);
        setPaletteState(state);
    }

    function resetFilterSliders() {
        filterSelector.value = 'none';
        filterStrength.value = 50;
        filterStrengthValue.textContent = '50%';
        if (brightnessSlider) {
            brightnessSlider.value = 0;
            brightnessValue.textContent = '0';
        }
        if (hueShiftSlider) {
            hueShiftSlider.value = 0;
            hueShiftValue.textContent = '0';
        }
        if (warmCoolSlider) {
            warmCoolSlider.value = 0;
            warmCoolValue.textContent = '0';
        }
    }

    function showLoading() {
        paletteDisplay.innerHTML = `
            <div class="loading-indicator">
                <div class="spinner"></div>
            </div>
        `;
        emptyPaletteMessage.style.display = 'none';
    }

    async function downloadProcreateSwatches() {
        if (extractedColors.length === 0) return;
        
        // Create swatches array in the format expected by Procreate
        const swatches = extractedColors.map(color => {
            // Convert RGB to HSB/HSV
            const { r, g, b } = color;
            const hsl = rgbToHsl(r, g, b);
            
            // Convert HSL to HSB/HSV (in HSB, V=B is equivalent to L but calculated differently)
            // Approximation for conversion
            const h = hsl.h / 360; // Procreate uses 0-1 range for hue
            
            // Adjust saturation and brightness calculations for HSB
            let s, v;
            const l = hsl.l / 100;
            
            if (l === 0) {
                s = 0;
                v = 0;
            } else {
                v = l + (hsl.s / 100) * Math.min(l, 1 - l);
                s = v === 0 ? 0 : 2 * (1 - l / v);
            }
            
            return {
                hue: h,
                saturation: s,
                brightness: v,
                alpha: 1,
                colorSpace: 0 // HSB/HSV color space as used by Procreate
            };
        });
        
        // Fill the remaining slots with white if there are fewer than 30 colors
        while (swatches.length < 30) {
            swatches.push({
                hue: 0,
                saturation: 0,
                brightness: 1, // White
                alpha: 1,
                colorSpace: 0
            });
        }
        
        // Create the Procreate swatches file structure
        const swatchData = [
            {
                "name": paletteTitle.textContent || "Extracted Palette",
                "swatches": swatches.slice(0, 30) // Limit to 30 swatches (Procreate's format)
            }
        ];
        
        // Generate pretty JSON with Procreate's specific formatting
        let jsonStr = JSON.stringify(swatchData, null, 2);
        
        // Adjust spacing around colons in keys (Procreate's format)
        jsonStr = jsonStr.replace(/"(\w+)"\s*:/g, '"$1" :');
        
        try {
            // Create a ZIP archive with the JSON file
            const zip = new JSZip();
            zip.file("Swatches.json", jsonStr);
            const blob = await zip.generateAsync({ type: "blob" });
            
            // Trigger download with the .swatches extension
            saveAs(blob, `${paletteTitle.textContent || "ExtractedPalette"}.swatches`);
        } catch (error) {
            console.error("Error creating Procreate swatches file:", error);
            alert("Failed to create Procreate swatches file. Check console for details.");
        }
    }

    function handleSimplifyPalette() {
        // Get current palette state
        const state = getPaletteState();
        if (!state.currentColors || state.currentColors.length === 0) return;
        
        // Simplify the current palette
        const simplifiedColors = simplifyPalette(state.currentColors, {
            targetColorCount: 15,
            minColors: 12,
            maxColors: 15
        });
        
        // Update state with simplified colors
        state.currentColors = simplifiedColors;
        setPaletteState(state);
        
        // Update display
        displayColorPalette(simplifiedColors);
    }

    function applyCurrentFilters() {
        // Get current filter values
        const filterName = filterSelector.value;
        const strength = parseInt(filterStrength.value);
        const brightness = brightnessSlider ? parseInt(brightnessSlider.value) : 0;
        const hueShift = hueShiftSlider ? parseInt(hueShiftSlider.value) : 0;
        const warmCool = warmCoolSlider ? parseInt(warmCoolSlider.value) : 0;
        
        // Get the current palette state
        const state = getPaletteState();
        
        // Update state with new filter settings
        state.filter = filterName;
        state.filterStrength = strength;
        state.brightness = brightness;
        state.hueShift = hueShift;
        state.warmCool = warmCool;
        
        // Store unmodified colors from original source based on current color count
        if (state.numColors !== originalColors.length && Object.keys(allPalettes).length > 0) {
            state.originalColors = allPalettes[state.numColors] || [];
            unmodifiedColors = [...state.originalColors];
        } else {
            state.originalColors = [...unmodifiedColors];
        }
        
        // Use the new utility function to apply all effects
        const processedColors = applyAllEffects(state.originalColors, state);
        
        // Update the current colors in state
        state.currentColors = processedColors;
        
        // Save the updated state
        setPaletteState(state);
        
        // Display the processed colors
        displayColorPalette(processedColors);
    }

    // Set up filter event listeners
    filterSelector.addEventListener('change', applyCurrentFilters);
    filterStrength.addEventListener('input', (e) => {
        filterStrengthValue.textContent = `${e.target.value}%`;
        applyCurrentFilters();
    });
    
    // Add brightness and hue shift event listeners
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            brightnessValue.textContent = e.target.value;
            applyCurrentFilters();
        });
    }
    
    if (hueShiftSlider) {
        hueShiftSlider.addEventListener('input', (e) => {
            hueShiftValue.textContent = e.target.value;
            applyCurrentFilters();
        });
    }

    // Add warm/cool event listener
    if (warmCoolSlider) {
        warmCoolSlider.addEventListener('input', (e) => {
            warmCoolValue.textContent = e.target.value;
            applyCurrentFilters();
        });
    }

    // Clipboard paste functionality
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const file = new File([blob], "pasted-image.png", { type: blob.type });
                handleFiles([file]);
                break;
            }
        }
    });

    // Restore upload area (if needed)
    function restoreUploadArea() {
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
            
            // Re-add the upload button
            const uploadButton = document.getElementById('upload-button');
            if (uploadButton) {
                container.appendChild(uploadButton);
            }
            
            setupDropHandlers(uploadArea);
        }
    }
    
    // Initialize the preset library
    initPresetLibrary((rgbColors, presetName) => {
        // First, ensure colors aren't empty
        if (!rgbColors || rgbColors.length === 0) {
            console.error('No colors in preset');
            return;
        }

        // Ensure we have full color objects
        originalColors = rgbColors.map(color => ({
            r: color.r,
            g: color.g,
            b: color.b
        }));
        unmodifiedColors = [...originalColors];
        
        // Get current state and update sources
        const state = getPaletteState();
        state.originalColors = [...originalColors];
        state.numColors = originalColors.length;
        
        // Reset all filter and effect sliders
        resetFilterSliders();
        
        // Trigger the filter application which will use the current slider values
        applyCurrentFilters();
        
        // Update palette title with preset name
        paletteTitle.textContent = presetName;
        
        // Ensure color count slider matches preset color count
        if (colorSlider) {
            colorSlider.value = originalColors.length.toString();
            colorCountDisplay.textContent = originalColors.length;
        }
    });

    // Copy Hex to Clipboard
    copyHexButton.addEventListener('click', async () => {
        const success = await copyPaletteToClipboard(extractedColors);
        
        if (success) {
            copyMessage.textContent = 'Copied palette in HEX format!';
            copyMessage.classList.add('show');
            
            setTimeout(() => {
                copyMessage.classList.remove('show');
            }, 3000);
        } else {
            copyMessage.textContent = 'Failed to copy palette.';
            copyMessage.classList.add('show');
            
            setTimeout(() => {
                copyMessage.classList.remove('show');
            }, 3000);
        }
    });

    // Function to load the default image
    function loadDefaultImage() {
        const defaultImagePath = "SnowDog.png";
        
        // Create a new image element
        const img = new Image();
        img.onload = function() {
            // Reset all filter effects when loading a new image
            resetPaletteEffects();
            resetFilterSliders();
            cachedPaletteName = null;
            
            // Create image placeholder
            const placeholder = createImagePlaceholder(defaultImagePath);
            setupDropHandlers(placeholder);
            
            currentImage = defaultImagePath;
            
            // Show loading indicator
            showLoading();
            
            // Process the image
            resizeAndAnalyzeImage(defaultImagePath);
        };
        img.src = defaultImagePath;
    }
});