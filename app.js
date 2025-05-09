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

import { analyzeImage, rgbToHsl, hslToRgb, rgbToCssColor, rgbToHex, getContrastColor } from './colorUtils.js';
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
    const colorSliderContainer = document.querySelector('.slider-container'); 

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
    const copyHexButton = document.getElementById('copy-hex'); 
    const copyMessage = document.getElementById('copy-message'); 
    const colorFilterButtonsContainer = document.getElementById('color-filter-buttons');

    // Initially show the palette view with default gradient
    paletteView.style.display = 'flex';

    // Create default rainbow gradient palette
    const createDefaultPalette = () => {
        const colors = [];
        for (let i = 0; i < 30; i++) {
            // Generate colors in full hue spectrum (0-360 degrees)
            const h = i * 12; 
            const s = 80 + (i % 2) * 10; 
            const l = 50 + ((i % 3) - 1) * 10; 

            const rgb = hslToRgb(h, s, l);
            colors.push({r: rgb.r, g: rgb.g, b: rgb.b});
        }
        return colors;
    };

    // Initialize with default colors
    let extractedColors = createDefaultPalette();
    let originalColors = [...extractedColors]; 
    displayColorPalette(extractedColors);
    paletteTitle.textContent = "Rainbow Gradient";

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
    let activeColorRanges = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'neutral']); 

    const debouncedProcessImage = debounce((imageSrc) => {
        if (lastProcessedImage === imageSrc && Object.keys(allPalettes).length > 0) {
             console.log("Skipping analysis, same image.");
             processingImage = false; 
             hideLoading(); 
             return;
        }
        resizeAndAnalyzeImage(imageSrc);
    }, 500); 

    function handleFiles(files) {
        if (files.length === 0 || processingImage) return;

        const file = files[0];
        if (!file.type.match('image.*')) {
            alert('Please select an image file.');
            return;
        }

        processingImage = true;

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageSrc = e.target.result;

            resetPaletteEffects();
            resetFilterSliders();
            cachedPaletteName = null;
            resetActiveColorFilters(); 

            if (colorSlider) colorSlider.disabled = false;

            const placeholder = createImagePlaceholder(imageSrc, handleDrop);
            currentImage = imageSrc;

            showLoading();

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

    function resizeAndAnalyzeImage(imageSrc) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

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

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const resizedImg = new Image();
            resizedImg.onload = () => {
                 try {
                    allPalettes = analyzeImage(resizedImg, null, "dominant", config, activeColorRanges);

                    const numColors = parseInt(colorSlider.value);
                    originalColors = allPalettes[numColors] || createDefaultPalette(); 

                    unmodifiedColors = [...originalColors];

                    const state = getPaletteState();
                    state.originalColors = [...originalColors];
                    state.numColors = numColors;
                    setPaletteState(state);
                    applyCurrentFilters(); 

                    if (!cachedPaletteName) { 
                        cachedPaletteName = generatePaletteName(getPaletteState().currentColors);
                    }
                    paletteTitle.textContent = cachedPaletteName;

                    lastProcessedImage = imageSrc;

                 } catch (error) {
                      console.error("Error during image analysis or palette display:", error);
                      alert("An error occurred while processing the image. Please try again.");
                      restoreUploadArea(handleDrop); 
                 } finally {
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

    function displayColorPalette(colors) {
        paletteDisplay.innerHTML = ''; 

        if (!colors || colors.length === 0) {
            emptyPaletteMessage.style.display = 'block';
            paletteActions.hidden = true;
            return; 
        }

        emptyPaletteMessage.style.display = 'none';
        paletteActions.hidden = false;

        const totalSlots = 30;
        paletteDisplay.style.width = '100%';

        for (let i = 0; i < totalSlots; i++) {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';

            if (i < colors.length && colors[i] !== null && typeof colors[i] === 'object' && colors[i].hasOwnProperty('r')) {
                const { r, g, b } = colors[i];
                const safeR = Math.max(0, Math.min(255, Math.round(r)));
                const safeG = Math.max(0, Math.min(255, Math.round(g)));
                const safeB = Math.max(0, Math.min(255, Math.round(b)));

                const colorSample = document.createElement('div');
                colorSample.className = 'color-sample';
                colorSample.style.backgroundColor = `rgb(${safeR}, ${safeG}, ${safeB})`;
                colorItem.appendChild(colorSample);

                colorItem.dataset.r = safeR;
                colorItem.dataset.g = safeG;
                colorItem.dataset.b = safeB;

                colorItem.addEventListener('click', () => handleColorItemClick(colorItem, safeR, safeG, safeB));

            } else {
                colorItem.innerHTML = '<div class="empty-color-slot"></div>';
                if (i < colors.length) console.warn(`Invalid color data at index ${i}:`, colors[i]);
            }

            paletteDisplay.appendChild(colorItem);
        }
        extractedColors = colors ? [...colors.filter(c => c)] : [];
    }

    async function handleColorItemClick(colorItemElement, r, g, b) {
        const existingHex = colorItemElement.querySelector('.hex-display');
        if (existingHex) {
            existingHex.remove();
        }

        const hexCode = rgbToHex(r, g, b);
        
        try {
            await navigator.clipboard.writeText(hexCode);

            const hexDisplay = document.createElement('span');
            hexDisplay.className = 'hex-display';
            hexDisplay.textContent = hexCode;

            const contrastColor = getContrastColor(r, g, b);
            hexDisplay.style.color = contrastColor;
            hexDisplay.style.backgroundColor = contrastColor === '#FFFFFF' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

            colorItemElement.appendChild(hexDisplay);

            setTimeout(() => {
                 hexDisplay.classList.add('fade-out');
            }, 50); 

            setTimeout(() => {
                hexDisplay.remove();
            }, 1500);

        } catch (err) {
            console.error('Failed to copy hex code: ', err);
            showCopyMessage('Failed to copy color!', false);
        }
    }

    function handleColorSliderChange(e) {
        if (!currentImage || Object.keys(allPalettes).length === 0) {
            return;
        }

        const numColors = parseInt(e.target.value);
        colorCountDisplay.textContent = numColors;

        if (allPalettes && allPalettes[numColors]) {
            const state = getPaletteState();

            state.originalColors = allPalettes[numColors] ? [...allPalettes[numColors]] : [];
            unmodifiedColors = [...state.originalColors]; 

            const processedColors = applyAllEffects(state.originalColors, state);

            state.currentColors = processedColors;
            state.numColors = numColors;
            setPaletteState(state);

            displayColorPalette(processedColors);
            colorSlider.value = state.numColors.toString();
            colorCountDisplay.textContent = state.numColors;
        }
    }

    function handleColorSliderFinalChange(e) {
        if (!currentImage || Object.keys(allPalettes).length === 0) return; 
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
    }

    async function downloadProcreateSwatches() {
        const currentState = getPaletteState(); 
        let colorsToSave = currentState.currentColors;

        if (!colorsToSave || colorsToSave.length === 0) {
             alert("No palette colors to download.");
             return;
        }

        const swatches = colorsToSave.map(color => {
            if (!color || typeof color.r !== 'number') { 
                return { hue: 0, saturation: 0, brightness: 1, alpha: 1, colorSpace: 0 };
            }
            const { r, g, b } = color;
            const hsl = rgbToHsl(r, g, b);

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

        while (swatches.length < 30) {
            swatches.push({
                hue: 0,
                saturation: 0,
                brightness: 1, 
                alpha: 1,
                colorSpace: 0
            });
        }

        const finalSwatches = swatches.slice(0, 30);

        const swatchData = [
            {
                "name": paletteTitle.textContent || "Extracted Palette",
                "swatches": finalSwatches
            }
        ];

        let jsonStr = JSON.stringify(swatchData, null, 2);

        jsonStr = jsonStr.replace(/"(\w+)"\s*:/g, '"$1" : ');
        jsonStr = jsonStr.replace(/\{\s+/g, '{ ').replace(/\s+\}/g, ' }');
        jsonStr = jsonStr.replace(/,\s+/g, ', ');

        try {
            const zip = new JSZip();
            zip.file("Swatches.json", jsonStr);
            const blob = await zip.generateAsync({ type: "blob" });

            const safeTitle = (paletteTitle.textContent || "ExtractedPalette").replace(/[^a-z0-9]/gi, '_');
            saveAs(blob, `${safeTitle}.swatches`);
        } catch (error) {
            console.error("Error creating Procreate swatches file:", error);
            alert("Failed to create Procreate swatches file. Check console for details.");
        }
    }

    function handleSimplifyPalette() {
        const state = getPaletteState();
        if (!state.currentColors || state.currentColors.length === 0) return;

        const simplifiedColors = simplifyPalette(state.currentColors, {
            targetColorCount: 15,
            minColors: 12,
            maxColors: 15
        });

        state.currentColors = simplifiedColors;
        state.numColors = simplifiedColors.length; 
        setPaletteState(state);

        displayColorPalette(simplifiedColors);

        if(colorSlider) {
           colorSlider.value = simplifiedColors.length.toString();
           colorCountDisplay.textContent = simplifiedColors.length;
        }
    }

    function applyCurrentFilters() {
        const filterName = filterSelector.value;
        const strength = parseInt(filterStrength.value);
        const brightness = brightnessSlider ? parseInt(brightnessSlider.value) : 0;
        const hueShift = hueShiftSlider ? parseInt(hueShiftSlider.value) : 0;
        const warmCool = warmCoolSlider ? parseInt(warmCoolSlider.value) : 0;

        const state = getPaletteState();

        state.filter = filterName;
        state.filterStrength = strength;
        state.brightness = brightness;
        state.hueShift = hueShift;
        state.warmCool = warmCool;

        let baseColors;
        if (state.originalColors && state.originalColors.length > 0) {
            baseColors = [...state.originalColors];
            if (state.numColors !== baseColors.length) {
                state.numColors = baseColors.length;
                if (colorSlider) colorSlider.value = state.numColors;
                if (colorCountDisplay) colorCountDisplay.textContent = state.numColors;
            }
        } else {
            baseColors = createDefaultPalette();
            state.originalColors = [...baseColors];
            state.numColors = baseColors.length;
            if (colorSlider) colorSlider.value = state.numColors;
            if (colorCountDisplay) colorCountDisplay.textContent = state.numColors;
            console.warn("Applying filters with fallback default palette as base.");
        }

        const processedColors = applyAllEffects(baseColors, state);

        state.currentColors = processedColors;
        setPaletteState(state);

        displayColorPalette(processedColors); 
    }

    filterSelector.addEventListener('change', applyCurrentFilters);

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

    document.addEventListener('paste', (e) => {
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
                    imageFile = new File([blob], `pasted-image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                    break; 
                }
            }
        }

        if (imageFile) {
            handleFiles([imageFile]); 
        }
    });

    initPresetLibrary((rgbColors, presetName) => {
        if (!rgbColors || rgbColors.length === 0) {
            console.error('No colors in preset');
            return;
        }

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

        resetFilterSliders();
        resetPaletteEffects();
        resetActiveColorFilters(); 

        const state = getPaletteState();
        state.originalColors = [...originalColors]; 
        state.numColors = originalColors.length;
        state.currentColors = [...originalColors]; 
        setPaletteState(state);

        applyCurrentFilters(); 

        paletteTitle.textContent = presetName;
        cachedPaletteName = presetName;

        if (colorSlider) {
            const presetColorCount = 30; 
            colorSlider.value = presetColorCount.toString();
            colorCountDisplay.textContent = presetColorCount;
            colorSlider.disabled = true; 
        }

        restoreUploadArea(handleDrop);
    });

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

    function showCopyMessage(message, success) {
        copyMessage.textContent = message;
        copyMessage.style.backgroundColor = success ? 'rgba(0, 128, 0, 0.7)' : 'rgba(200, 0, 0, 0.7)'; 
        copyMessage.classList.add('show');

        setTimeout(() => {
            copyMessage.classList.remove('show');
        }, 3000); 
    }

    function loadDefaultImage() {
        const defaultImagePath = "SnowDog.png";

        fetch(defaultImagePath)
            .then(res => {
                 if (!res.ok) {
                     throw new Error(`HTTP error! status: ${res.status}`);
                 }
                 return res.blob();
            })
            .then(blob => {
                 const file = new File([blob], "SnowDog.png", { type: blob.type });
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
                const uploadAreaElem = document.getElementById('upload-area');
                 if (uploadAreaElem) {
                    setupDropHandlers(uploadAreaElem, handleDrop);
                 } else {
                     console.error("Failed to find upload area after default image load failure.");
                 }
            });
    }

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
                
                if (currentImage && !processingImage) {
                    debouncedReAnalyze();
                } else if (!currentImage) {
                     console.log("Color filters changed, but no image loaded for re-analysis.");
                }
            });
        });
    }

    function resetActiveColorFilters() {
        activeColorRanges = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'neutral']);
        if (colorFilterButtonsContainer) {
            colorFilterButtonsContainer.querySelectorAll('.color-filter-btn').forEach(btn => {
                btn.classList.add('active');
            });
        }
    }

    const debouncedReAnalyze = debounce(() => {
        if (currentImage && !processingImage) {
            console.log("Re-analyzing image due to filter change...");
            processingImage = true; 
            showLoading();
            resizeAndAnalyzeImage(currentImage); 
        }
    }, 500); 

    setupColorFilterButtons();
});