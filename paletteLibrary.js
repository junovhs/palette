import { palettePresets } from './presets.js';
import { hslToRgb } from './colorUtils.js';

// Function to convert HSB (Procreate format) to RGB
function hsbToRgb(h, s, b) {
    // HSB (HSV) and HSL use different algorithms
    // Convert HSB to RGB directly
    let r, g, b2;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = b * (1 - s);
    const q = b * (1 - f * s);
    const t = b * (1 - (1 - f) * s);
    
    switch (i % 6) {
        case 0: r = b, g = t, b2 = p; break;
        case 1: r = q, g = b, b2 = p; break;
        case 2: r = p, g = b, b2 = t; break;
        case 3: r = p, g = q, b2 = b; break;
        case 4: r = t, g = p, b2 = b; break;
        case 5: r = b, g = p, b2 = q; break;
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b2 * 255)
    };
}

// Convert Procreate swatches to RGB format
function convertSwatchesToRgb(swatches) {
    return swatches.map(swatch => {
        return hsbToRgb(swatch.hue, swatch.saturation, swatch.brightness);
    });
}

// Initialize the preset library
export function initPresetLibrary(onSelectPreset) {
    // Get unique categories
    const categories = [...new Set(palettePresets.map(preset => preset.category))];
    
    // Create library container
    const libraryContainer = document.getElementById('preset-library-container');
    if (!libraryContainer) return;
    
    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'preset-tabs';
    libraryContainer.appendChild(tabsContainer);
    
    // Create preset grid container
    const presetGrid = document.createElement('div');
    presetGrid.className = 'preset-grid';
    libraryContainer.appendChild(presetGrid);
    
    // Create tabs for each category
    categories.forEach((category, index) => {
        const tab = document.createElement('div');
        tab.className = 'preset-tab';
        if (index === 0) tab.classList.add('active');
        tab.textContent = category;
        tab.dataset.category = category;
        tabsContainer.appendChild(tab);
        
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.preset-tab').forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            // Show presets for this category
            showPresetsForCategory(category);
        });
    });
    
    // Function to display presets for a category
    function showPresetsForCategory(category) {
        // Clear the grid
        presetGrid.innerHTML = '';
        
        // Filter presets by category
        const filteredPresets = palettePresets.filter(preset => preset.category === category);
        
        // Create preset cards
        filteredPresets.forEach(preset => {
            const presetCard = document.createElement('div');
            presetCard.className = 'preset-card';
            
            // Create preset title
            const presetTitle = document.createElement('div');
            presetTitle.className = 'preset-title';
            presetTitle.textContent = preset.name;
            presetCard.appendChild(presetTitle);
            
            // Create preset swatch preview
            const presetSwatches = document.createElement('div');
            presetSwatches.className = 'preset-swatches';
            
            // Create mini swatches for preview
            preset.swatches.slice(0, 15).forEach(swatch => {
                const rgb = hsbToRgb(swatch.hue, swatch.saturation, swatch.brightness);
                const swatchElem = document.createElement('div');
                swatchElem.className = 'mini-swatch';
                swatchElem.style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                presetSwatches.appendChild(swatchElem);
            });
            
            presetCard.appendChild(presetSwatches);
            
            // Add click handler
            presetCard.addEventListener('click', () => {
                // Convert all 30 swatches to RGB format for the palette
                const rgbColors = convertSwatchesToRgb(preset.swatches);
                
                // Call the callback with the selected preset
                if (onSelectPreset) {
                    onSelectPreset(rgbColors, preset.name);
                }
            });
            
            presetGrid.appendChild(presetCard);
        });
    }
    
    // Initialize with first category
    if (categories.length > 0) {
        showPresetsForCategory(categories[0]);
    }
}