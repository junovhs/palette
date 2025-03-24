import { 
    applyFilterToPalette 
} from './colorFilters.js';

import {
    applyBrightnessContrast,
    applyHueShift
} from './paletteEffects.js';

import {
    applyWarmCoolAdjustment
} from './colorWarmCool.js';

/**
 * Applies all current filters and adjustments to a palette
 * @param {Array} originalColors The original unmodified colors
 * @param {Object} state Current palette state with filter settings
 * @return {Array} The processed colors with all effects applied
 */
export function applyAllEffects(originalColors, state) {
    if (!originalColors || originalColors.length === 0) return [];
    
    // Start with original colors
    let processedColors = [...originalColors];
    
    // Apply filter if active
    if (state.filter !== 'none' && state.filterStrength > 0) {
        processedColors = applyFilterToPalette(processedColors, state.filter, state.filterStrength);
    }
    
    // Apply brightness adjustment if needed
    if (state.brightness !== 0) {
        processedColors = applyBrightnessContrast(processedColors, state.brightness);
    }
    
    // Apply hue shift if needed
    if (state.hueShift !== 0) {
        processedColors = applyHueShift(processedColors, state.hueShift);
    }
    
    // Apply warm/cool adjustment if needed
    if (state.warmCool !== 0) {
        processedColors = applyWarmCoolAdjustment(processedColors, state.warmCool);
    }
    
    return processedColors;
}