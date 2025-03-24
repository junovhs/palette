// paletteEffects.js - New file for palette effect functions
import { rgbToHsl, hslToRgb } from './colorUtils.js';

// Store the current palette state
let paletteState = {
    originalColors: [],
    currentColors: [],
    numColors: 30,
    filter: 'none',
    filterStrength: 50,
    brightness: 0,
    hueShift: 0,
    warmCool: 0
};

// Getter for palette state
export function getPaletteState() {
    return { ...paletteState };
}

// Setter for palette state
export function setPaletteState(state) {
    paletteState = { ...state };
}

// Reset palette effects to default values
export function resetPaletteEffects() {
    paletteState = {
        originalColors: [],
        currentColors: [],
        numColors: 30,
        filter: 'none',
        filterStrength: 50,
        brightness: 0,
        hueShift: 0,
        warmCool: 0
    };
}

// Apply brightness and contrast adjustments using perceptual model
export function applyBrightnessContrast(colors, brightnessValue) {
    if (!colors || colors.length === 0) return [];
    
    return colors.map(color => {
        if (!color) return color; // Skip null colors
        
        // Convert to HSL for perceptual adjustments
        const hsl = rgbToHsl(color.r, color.g, color.b);
        
        // Apply perceptual brightness adjustment
        // Use non-linear adjustment for more natural feel
        let newLightness = hsl.l;
        
        if (brightnessValue > 0) {
            // Increase brightness with diminishing returns for already bright colors
            const factor = (100 - hsl.l) / 100; // Factor diminishes as lightness increases
            newLightness = Math.min(100, hsl.l + (brightnessValue * factor));
        } else if (brightnessValue < 0) {
            // Decrease brightness with diminishing returns for already dark colors
            const factor = hsl.l / 100; // Factor diminishes as lightness decreases
            newLightness = Math.max(0, hsl.l + (brightnessValue * factor));
        }
        
        // Convert back to RGB
        const rgb = hslToRgb(hsl.h, hsl.s, newLightness);
        return { r: rgb.r, g: rgb.g, b: rgb.b };
    });
}

// Apply hue shift to colors
export function applyHueShift(colors, hueShiftValue) {
    if (!colors || colors.length === 0) return [];
    
    return colors.map(color => {
        if (!color) return color; // Skip null colors
        
        // Convert to HSL for hue adjustment
        const hsl = rgbToHsl(color.r, color.g, color.b);
        
        // Apply hue shift (0-360 degrees)
        let newHue = (hsl.h + hueShiftValue) % 360;
        if (newHue < 0) newHue += 360; // Handle negative values
        
        // Convert back to RGB
        const rgb = hslToRgb(newHue, hsl.s, hsl.l);
        return { r: rgb.r, g: rgb.g, b: rgb.b };
    });
}