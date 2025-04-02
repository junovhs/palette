// Simple client-side authentication
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const userKey = urlParams.get('key');
  const validKey = 'ARTISTG9V4'; // your secret access key

  if (userKey === validKey) {
    localStorage.setItem('hasAccess', 'true');
  }

  const hasAccess = localStorage.getItem('hasAccess');

  if (!hasAccess) {
    document.body.innerHTML = `
      <div style="text-align: center; margin-top: 100px;">
        <h2> ProPalette Access Required</h2>
        <p>Please enter your access key:</p>
        <input type="text" id="accessKey" placeholder="Enter key" />
        <button onclick="
          const inputKey = document.getElementById('accessKey').value;
          if(inputKey === '${validKey}') {
            localStorage.setItem('hasAccess', 'true');
            location.reload();
          } else {
            alert('Incorrect access key. Please try again.');
          }
        ">Unlock</button>
      </div>
    `;
    // Stop further script execution if no access
    throw new Error("Access Denied. Script execution halted.");
  }
})();

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
import { copyPaletteToClipboard } from './clipboardUtils.js'; 
import { applyAllEffects } from './paletteStateManager.js';

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const initialUploadArea = document.getElementById('upload-area'); 
    const uploadButton = document.getElementById('upload-button');
    const paletteDisplay = document.getElementById('palette-display');
    const paletteContainer = document.getElementById('palette-container');
    const emptyPaletteMessage = document.querySelector('.empty-palette-message');
    const paletteActions = document.getElementById('palette-actions');
    const downloadSwatchesButton = document.getElementById('download-swatches');
    const simplifyPaletteButton = document.getElementById('simplify-palette');
    const colorSlider = document.getElementById('color-slider');
    const colorCountDisplay = document.getElementById('color-count');
    const paletteView = document.getElementById('palette-view');
    const paletteTitle = document.getElementById('palette-title');
    const paletteTitleInput = document.getElementById('palette-title-input');
    const editPencilIcon = document.getElementById('edit-pencil-icon');
    const colorSliderContainer = document.querySelector('.slider-container'); // Get slider container

    // Filter controls
    const filterSelector = document.getElementById('filter-selector');

    // Load the default image
    loadDefaultImage();

    // Re-enable color slider initially (will be disabled by preset if needed)
    if (colorSlider) colorSlider.disabled = false;

    // Set up color palette title editing
    let isEditingTitle = false;

    paletteTitle.addEventListener('click', toggleEditTitle);
    editPencilIcon.addEventListener('click', toggleEditTitle);

    paletteTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            toggleEditTitle();
        }
    });
    // Blur listener to save changes if user clicks away
    paletteTitleInput.addEventListener('blur', () => {
        if (isEditingTitle) {
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
            paletteTitleInput.select(); 
        } else {
            paletteTitle.style.display = 'inline';
            editPencilIcon.style.display = 'inline';
            paletteTitleInput.style.display = 'none';
            // Only update if the value is not empty
            const newTitle = paletteTitleInput.value.trim();
            if (newTitle) {
                paletteTitle.textContent = newTitle;
                 // Update cached name if it matches the old title
                 if (cachedPaletteName === paletteTitle.textContent) {
                    cachedPaletteName = newTitle;
                 }
            } else {
                // Restore original text content if input is empty
                paletteTitleInput.value = paletteTitle.textContent;
            }
        }
    }

    // --- Drag and Drop / File Handling ---

    // Define the single drop handler function
    const handleDrop = (e) => {
        e.preventDefault(); 

        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        } else {
            console.log("No files found in drop event.");
        }
    };

    // Setup initial handlers
    if (initialUploadArea) {
        setupDropHandlers(initialUploadArea, handleDrop);
    } else {
        console.error("Initial upload area not found!");
    }

    // --- Other Event Listeners ---
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
    let allPalettes = {}; 
    let unmodifiedColors = []; 
    let processingImage = false; 
    let lastProcessedImage = null; 
    let cachedPaletteName = null; 
    let activeColorRanges = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'neutral']); // Initialize with all active

    // Debounced image processing function (created once at initialization)
    const debouncedProcessImage = debounce((imageSrc) => {
        // Check if this is the same image we just processed (based on src)
        if (lastProcessedImage === imageSrc && Object.keys(allPalettes).length > 0) {
             console.log("Skipping analysis, same image.");
             processingImage = false; 
             hideLoading(); 
             return;
        }
        resizeAndAnalyzeImage(imageSrc);
    }, 500); // Increased debounce slightly for slider changes

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
            const imageSrc = e.target.result;

            // Reset filters, palette name, and active colors when loading a new image
            resetPaletteEffects();
            resetFilterSliders();
            cachedPaletteName = null;
            resetActiveColorFilters(); // Reset color buttons to all active

            // Re-enable color slider when loading an image
            if (colorSlider) colorSlider.disabled = false;

            // Create image placeholder and add drop handlers using the handleDrop function
            const placeholder = createImagePlaceholder(imageSrc, handleDrop);
            // Note: setupDropHandlers is called inside createImagePlaceholder
            currentImage = imageSrc;

            // Show loading indicator
            showLoading();

            // Use debounced function to process image
            debouncedProcessImage(imageSrc);
        };
        reader.onerror = () => {
            console.error("FileReader error.");
            alert("Error reading file.");
            processingImage = false; 
            hideLoading();
        }
        reader.readAsDataURL(file);
    }

    function handleFileSelect(e) {
        handleFiles(e.target.files);
    }

    // New function to resize the image before analysis with caching
    function resizeAndAnalyzeImage(imageSrc) {
        const img = new Image();
        img.onload = () => {
            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate new dimensions (max 800x800 while maintaining aspect ratio)
            let width = img.naturalWidth; 
            let height = img.naturalHeight;
            const maxDim = 800;

            if (width > height && width > maxDim) {
                height = Math.floor(height * (maxDim / width));
                width = maxDim;
            } else if (height > maxDim) {
                width = Math.floor(width * (maxDim / height));
                height = maxDim;
            }

            // Set canvas size and draw resized image
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Create a new resized image element for analysis
            const resizedImg = new Image();
            resizedImg.onload = () => {
                 try {
                    // Pre-calculate all palettes using the resized image and ACTIVE color ranges
                    allPalettes = analyzeImage(resizedImg, null, "dominant", config, activeColorRanges);

                    // Display the palette for current slider value
                    const numColors = parseInt(colorSlider.value);
                    originalColors = allPalettes[numColors] || createDefaultPalette(); 

                    // Store unmodified colors for filter chains
                    unmodifiedColors = [...originalColors];

                    // Reset any active filter (applyCurrentFilters will handle state)
                    // resetFilterSliders(); 

                    // Update palette state with original colors and apply effects
                    setPaletteState({
                        ...getPaletteState(), 
                        originalColors: [...originalColors],
                        numColors: numColors,
                    });
                    applyCurrentFilters(); 

                    // Auto-name the palette based on the palette
                    if (!cachedPaletteName) { 
                        cachedPaletteName = generatePaletteName(getPaletteState().currentColors);
                    }
                    paletteTitle.textContent = cachedPaletteName;

                    // Cache the processed image source to avoid duplicate processing
                    lastProcessedImage = imageSrc;

                 } catch (error) {
                      console.error("Error during image analysis or palette display:", error);
                      alert("An error occurred while processing the image. Please try again.");
                      restoreUploadArea(handleDrop); 
                 } finally {
                     // Reset processing flag and hide loading indicator
                     processingImage = false;
                     hideLoading();
                 }
            };
             resizedImg.onerror = () => {
                 console.error("Error loading resized image for analysis.");
                 alert("Error processing image data.");
                 processingImage = false;
                 hideLoading();
                 restoreUploadArea(handleDrop); 
             }
            resizedImg.src = canvas.toDataURL('image/jpeg'); 
        };
        img.onerror = () => {
            console.error("Error loading source image:", imageSrc);
            alert("Could not load the selected image.");
            processingImage = false;
            hideLoading();
            restoreUploadArea(handleDrop); 
        }
        img.src = imageSrc;
    }

    // No clearImage function needed anymore? Uploading a new image replaces the old one.
    // Presets also replace the image area.

    function displayColorPalette(colors) {
        paletteDisplay.innerHTML = ''; 

        if (!colors || colors.length === 0) {
            emptyPaletteMessage.style.display = 'block';
            paletteActions.hidden = true;
            return; 
        }

        emptyPaletteMessage.style.display = 'none';
        paletteActions.hidden = false;

        // Create 30 slots (3 rows of 10)
        const totalSlots = 30;

        // Set palette container to full width (should be handled by CSS, but ensure here)
        paletteDisplay.style.width = '100%';

        // Fill available colors
        for (let i = 0; i < totalSlots; i++) {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';

            if (i < colors.length && colors[i] !== null && typeof colors[i] === 'object') {
                // Check if color object has r, g, b properties
                if (colors[i].hasOwnProperty('r') && colors[i].hasOwnProperty('g') && colors[i].hasOwnProperty('b')) {
                    const { r, g, b } = colors[i];
                    const colorSample = document.createElement('div');
                    colorSample.className = 'color-sample';
                    // Ensure valid RGB values
                    const safeR = Math.max(0, Math.min(255, Math.round(r)));
                    const safeG = Math.max(0, Math.min(255, Math.round(g)));
                    const safeB = Math.max(0, Math.min(255, Math.round(b)));
                    colorSample.style.backgroundColor = `rgb(${safeR}, ${safeG}, ${safeB})`;

                    colorItem.appendChild(colorSample);

                    // Store color data as attributes for potential use
                    colorItem.dataset.r = safeR;
                    colorItem.dataset.g = safeG;
                    colorItem.dataset.b = safeB;
                } else {
                     // Invalid color object, treat as empty
                     colorItem.innerHTML = '<div class="empty-color-slot"></div>';
                     console.warn(`Invalid color object at index ${i}:`, colors[i]);
                }
            } else {
                // Empty slot or invalid data
                colorItem.innerHTML = '<div class="empty-color-slot"></div>';
            }

            paletteDisplay.appendChild(colorItem);
        }
        // Update global extractedColors with the currently displayed ones
        // Ensure it's a copy and handle potential nulls/undefined
        extractedColors = colors ? [...colors.filter(c => c)] : [];
    }

    function handleColorSliderChange(e) {
        if (!currentImage || Object.keys(allPalettes).length === 0) {
            // Do nothing if no image analyzed or a preset is active
            // Slider should be disabled in preset mode anyway
            return;
        }

        const numColors = parseInt(e.target.value);
        colorCountDisplay.textContent = numColors;

        // Only update display if we have pre-calculated palettes for the current filter set
        if (allPalettes && allPalettes[numColors]) {
            // Get current palette state to maintain filter settings
            const state = getPaletteState();

            // Update original colors based on new count from pre-calculated data
            state.originalColors = allPalettes[numColors] ? [...allPalettes[numColors]] : [];
            unmodifiedColors = [...state.originalColors]; 

            // Re-apply all filters to new color set
            const processedColors = applyAllEffects(state.originalColors, state);

            // Update the current colors in state
            state.currentColors = processedColors;
            state.numColors = numColors;
            setPaletteState(state);

            displayColorPalette(processedColors);
            // Ensure slider reflects the actual count after analysis/update
            colorSlider.value = state.numColors.toString();
            colorCountDisplay.textContent = state.numColors;
        }
    }

    function handleColorSliderFinalChange(e) {
        if (!currentImage || Object.keys(allPalettes).length === 0) return; // Do nothing if no image or preset active
        // Update palette state after slider is released (numColors already updated in input handler)
        // No extra action needed here if handleColorSliderChange handles state update.
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
        paletteActions.hidden = true; 
    }

    function hideLoading() {
        const loadingIndicator = paletteDisplay.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
         // Actions visibility is handled by displayColorPalette based on results
    }

    async function downloadProcreateSwatches() {
        // Use the globally updated extractedColors which reflects the current display
        const currentState = getPaletteState(); 
        let colorsToSave = currentState.currentColors;

        if (!colorsToSave || colorsToSave.length === 0) {
             alert("No palette colors to download.");
             return;
        }

        // Create swatches array in the format expected by Procreate
        const swatches = colorsToSave.map(color => {
            if (!color || typeof color.r !== 'number') { 
                // Default to white if color is invalid
                return { hue: 0, saturation: 0, brightness: 1, alpha: 1, colorSpace: 0 };
            }
            // Convert RGB to HSB/HSV
            const { r, g, b } = color;
            const hsl = rgbToHsl(r, g, b);

            // Convert HSL to HSB/HSV (in HSB, V=B is equivalent to L but calculated differently)
            const h = hsl.h / 360; 

            let s, v;
            const l_norm = hsl.l / 100;
            const s_norm = hsl.s / 100;

            v = l_norm + s_norm * Math.min(l_norm, 1 - l_norm);

            if (v === 0) {
                s = 0;
            } else {
                s = 2 * (1 - l_norm / v);
            }

            return {
                hue: h,
                saturation: Math.max(0, Math.min(1, s)), 
                brightness: Math.max(0, Math.min(1, v)), 
                alpha: 1,
                colorSpace: 0 
            };
        });

        // Fill the remaining slots with white if there are fewer than 30 colors
        while (swatches.length < 30) {
            swatches.push({
                hue: 0,
                saturation: 0,
                brightness: 1, 
                alpha: 1,
                colorSpace: 0
            });
        }

        // Ensure only 30 swatches are included
        const finalSwatches = swatches.slice(0, 30);

        // Create the Procreate swatches file structure
        const swatchData = [
            {
                "name": paletteTitle.textContent || "Extracted Palette",
                "swatches": finalSwatches
            }
        ];

        // Generate pretty JSON with Procreate's specific formatting
        let jsonStr = JSON.stringify(swatchData, null, 2);

        // Adjust spacing around colons in keys (Procreate's format)
        jsonStr = jsonStr.replace(/"(\w+)"\s*:/g, '"$1" : ');
        // Ensure correct spacing for array items
        jsonStr = jsonStr.replace(/\{\s+/g, '{ ').replace(/\s+\}/g, ' }');
        jsonStr = jsonStr.replace(/,\s+/g, ', ');

        try {
            // Create a ZIP archive with the JSON file
            const zip = new JSZip();
            zip.file("Swatches.json", jsonStr);
            const blob = await zip.generateAsync({ type: "blob" });

            // Trigger download with the .swatches extension
            const safeTitle = (paletteTitle.textContent || "ExtractedPalette").replace(/[^a-z0-9]/gi, '_');
            saveAs(blob, `${safeTitle}.swatches`);
        } catch (error) {
            console.error("Error creating Procreate swatches file:", error);
            alert("Failed to create Procreate swatches file. Check console for details.");
        }
    }

    function handleSimplifyPalette() {
        // Get current palette state
        const state = getPaletteState();
        if (!state.currentColors || state.currentColors.length === 0) return;

        // Simplify the current palette (which already includes effects)
        const simplifiedColors = simplifyPalette(state.currentColors, {
            targetColorCount: 15,
            minColors: 12,
            maxColors: 15
        });

        // Update state with simplified colors
        state.currentColors = simplifiedColors;
        state.numColors = simplifiedColors.length; 
        // Simplification modifies the current view. If filters need to be reapplied
        // after simplifying, state.originalColors would need careful handling.
        // For now, treat simplification as a final step for the current view.
        setPaletteState(state);

        // Update display
        displayColorPalette(simplifiedColors);

        // Update slider to reflect new count
        if(colorSlider) {
           colorSlider.value = simplifiedColors.length.toString();
           colorCountDisplay.textContent = simplifiedColors.length;
        }
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

        // Always use the state's originalColors as the base for applying effects
        let baseColors;
        if (state.originalColors && state.originalColors.length > 0) {
            baseColors = [...state.originalColors];
            // Sync numColors in state if it differs (e.g., after preset load)
            if (state.numColors !== baseColors.length) {
                state.numColors = baseColors.length;
                 if (colorSlider) colorSlider.value = state.numColors;
                 if (colorCountDisplay) colorCountDisplay.textContent = state.numColors;
            }
        } else {
            // Fallback: use default palette if no other source
            baseColors = createDefaultPalette();
            state.originalColors = [...baseColors];
            state.numColors = baseColors.length;
            if (colorSlider) colorSlider.value = state.numColors;
            if (colorCountDisplay) colorCountDisplay.textContent = state.numColors;
            console.warn("Applying filters with fallback default palette as base.");
        }

        // Use the utility function to apply all effects starting from the base colors
        const processedColors = applyAllEffects(baseColors, state);

        // Update the current colors in state
        state.currentColors = processedColors;

        // Save the updated state
        setPaletteState(state);

        // Display the processed colors
        displayColorPalette(processedColors); 
    }

    // Set up filter event listeners - direct call for real-time updates
    filterSelector.addEventListener('change', applyCurrentFilters);

    // Remove debounce for slider inputs to get real-time feedback
    filterStrength.addEventListener('input', (e) => {
        filterStrengthValue.textContent = `${e.target.value}%`;
        applyCurrentFilters(); 
    });

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

    if (warmCoolSlider) {
        warmCoolSlider.addEventListener('input', (e) => {
            warmCoolValue.textContent = e.target.value;
            applyCurrentFilters(); 
        });
    }

    // --- Clipboard Paste Functionality ---
    document.addEventListener('paste', (e) => {
        // Prevent paste if editing title input
        if (document.activeElement === paletteTitleInput) {
            return;
        }

        if (processingImage) return; 

        const items = e.clipboardData?.items;
        if (!items) return;

        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    // Create a File object with a name
                    imageFile = new File([blob], `pasted-image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                    break; 
                }
            }
        }

        if (imageFile) {
            handleFiles([imageFile]); 
        }
    });

    // Initialize the preset library
    initPresetLibrary((rgbColors, presetName) => {
        // First, ensure colors aren't empty
        if (!rgbColors || rgbColors.length === 0) {
            console.error('No colors in preset');
            return;
        }

        // Ensure we have full color objects {r, g, b}
        originalColors = rgbColors.map(color => ({
            r: color.r,
            g: color.g,
            b: color.b
        })).filter(c => c.r !== undefined); 

         if (originalColors.length === 0) {
            console.error('Preset colors were invalid after mapping.');
            return;
         }

        unmodifiedColors = [...originalColors];

        // Reset all filter and effect sliders and state
        resetFilterSliders();
        resetPaletteEffects();
        resetActiveColorFilters(); // Reset color buttons when loading preset

        // Get current state (which is now reset) and update it for the preset
        const state = getPaletteState();
        state.originalColors = [...originalColors]; // Set preset colors as original
        state.numColors = originalColors.length;
        state.currentColors = [...originalColors]; // Initial display is just the preset colors
        setPaletteState(state);

        // Apply the *current* (reset) filters/effects to display the clean preset
        applyCurrentFilters(); // This will now use state.originalColors (preset colors) as base

        // Update palette title with preset name
        paletteTitle.textContent = presetName;
        cachedPaletteName = presetName;

        // Set color count slider to preset color count (30) and disable it
        if (colorSlider) {
            const presetColorCount = 30; // Presets always have 30 colors
            colorSlider.value = presetColorCount.toString();
            colorCountDisplay.textContent = presetColorCount;
            colorSlider.disabled = true; // Disable slider for presets
        }

        // Clear image placeholder and show upload area
        restoreUploadArea(handleDrop);
    });

    // Copy Hex to Clipboard
    copyHexButton.addEventListener('click', async () => {
        const currentState = getPaletteState();
        const colorsToCopy = currentState.currentColors; 

        if (!colorsToCopy || colorsToCopy.length === 0) {
             showCopyMessage('No colors to copy.', false);
             return;
        }

        const success = await copyPaletteToClipboard(colorsToCopy);

        if (success) {
            showCopyMessage('Copied palette in HEX format!', true);
        } else {
            showCopyMessage('Failed to copy palette.', false);
        }
    });

    // Helper to show copy message
    function showCopyMessage(message, success) {
        copyMessage.textContent = message;
        copyMessage.style.backgroundColor = success ? 'rgba(0, 128, 0, 0.7)' : 'rgba(200, 0, 0, 0.7)'; 
        copyMessage.classList.add('show');

        setTimeout(() => {
            copyMessage.classList.remove('show');
        }, 3000);
    }

    // Function to load the default image
    function loadDefaultImage() {
        const defaultImagePath = "SnowDog.png";

        // Simulate a File object for handleFiles
        fetch(defaultImagePath)
            .then(res => {
                 if (!res.ok) {
                     throw new Error(`HTTP error! status: ${res.status}`);
                 }
                 return res.blob();
            })
            .then(blob => {
                 const file = new File([blob], "SnowDog.png", { type: blob.type });
                 // Reset state before loading default image
                 resetPaletteEffects();
                 resetFilterSliders();
                 cachedPaletteName = null;
                 lastProcessedImage = null; 
                 allPalettes = {};
                 unmodifiedColors = [];
                 currentImage = null;

                 handleFiles([file]); 
            })
            .catch(error => {
                console.error("Failed to fetch default image:", error);
                alert("Could not load the default image.");
                restoreUploadArea(handleDrop); 
                // Setup handlers for the restored area
                const uploadAreaElem = document.getElementById('upload-area');
                 if (uploadAreaElem) {
                    setupDropHandlers(uploadAreaElem, handleDrop);
                 } else {
                     console.error("Failed to find upload area after default image load failure.");
                 }
            });
    }

    // --- Color Filter Button Handling ---
    function setupColorFilterButtons() {
        if (!colorFilterButtonsContainer) return;
        const buttons = colorFilterButtonsContainer.querySelectorAll('.color-filter-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const color = button.dataset.color;
                button.classList.toggle('active');
                
                if (activeColorRanges.has(color)) {
                    activeColorRanges.delete(color);
                } else {
                    activeColorRanges.add(color);
                }
                
                // Trigger re-analysis if an image is loaded
                if (currentImage && !processingImage) {
                    // Use debounce to avoid rapid re-analysis if clicking quickly
                    debouncedReAnalyze();
                } else if (!currentImage) {
                     // If no image loaded (using default or preset), update display based on current base colors
                     // This scenario needs clarification: should buttons filter presets/defaults?
                     // For now, let's assume buttons only affect image analysis.
                     console.log("Color filters changed, but no image loaded for re-analysis.");
                }
            });
        });
    }

    // Helper function to reset color filter buttons to active state
    function resetActiveColorFilters() {
        activeColorRanges = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'neutral']);
        if (colorFilterButtonsContainer) {
            colorFilterButtonsContainer.querySelectorAll('.color-filter-btn').forEach(btn => {
                btn.classList.add('active');
            });
        }
    }

    // Debounced re-analysis function specifically for filter changes
    const debouncedReAnalyze = debounce(() => {
        if (currentImage && !processingImage) {
            console.log("Re-analyzing image due to filter change...");
            processingImage = true; // Set flag before async operation
            showLoading();
            // Pass the current activeColorRanges to the analysis function
            resizeAndAnalyzeImage(currentImage); // This will use the updated activeColorRanges
        }
    }, 500); // 500ms debounce for filter button clicks

    // Initial setup for color filter buttons
    setupColorFilterButtons();
});