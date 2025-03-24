// colorWarmCool.js - Enhanced for painter-like warm/cool color adjustments
import { rgbToHsl, hslToRgb } from './colorUtils.js';

/**
 * Applies a warm/cool adjustment to colors using a perceptually balanced painter-like approach
 * @param {Array} colors Array of RGB color objects
 * @param {number} warmCoolValue Value from -100 (cool) to +100 (warm)
 * @return {Array} Adjusted colors
 */
export function applyWarmCoolAdjustment(colors, warmCoolValue) {
    if (!colors || colors.length === 0 || warmCoolValue === 0) return [...colors];
    
    // Analyze the palette first to make relational adjustments
    const colorAnalysis = analyzeColorPalette(colors);
    
    return colors.map(color => {
        if (!color) return color; // Skip null colors
        
        // Convert to HSL for perceptual adjustments
        const hsl = rgbToHsl(color.r, color.g, color.b);
        
        // Apply the warm/cool adjustment with palette context
        const adjustedHsl = adjustWarmCool(hsl, warmCoolValue, colorAnalysis);
        
        // Convert back to RGB
        const rgb = hslToRgb(adjustedHsl.h, adjustedHsl.s, adjustedHsl.l);
        return { r: rgb.r, g: rgb.g, b: rgb.b };
    });
}

/**
 * Analyzes the color palette to understand relationships between colors
 * @param {Array} colors Array of RGB color objects
 * @return {Object} Analysis results
 */
function analyzeColorPalette(colors) {
    const validColors = colors.filter(c => c !== null && c !== undefined);
    if (validColors.length === 0) return { averageHue: 0, hueVariance: 0, averageSaturation: 0 };
    
    // Convert all to HSL for analysis
    const hslColors = validColors.map(color => rgbToHsl(color.r, color.g, color.b));
    
    // Calculate average hue (needs special handling due to circular nature)
    let sinSum = 0, cosSum = 0;
    let totalSaturation = 0;
    let totalLightness = 0;
    
    hslColors.forEach(hsl => {
        const hueRadians = (hsl.h * Math.PI) / 180;
        sinSum += Math.sin(hueRadians) * hsl.s; // Weight by saturation
        cosSum += Math.cos(hueRadians) * hsl.s; // Weight by saturation
        totalSaturation += hsl.s;
        totalLightness += hsl.l;
    });
    
    const averageHue = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
    const averageSaturation = totalSaturation / hslColors.length;
    const averageLightness = totalLightness / hslColors.length;
    
    // Calculate hue variance (how spread out the hues are)
    let hueVarianceSum = 0;
    hslColors.forEach(hsl => {
        const hueDiff = Math.min(
            Math.abs(hsl.h - averageHue),
            Math.abs(hsl.h - (averageHue + 360)),
            Math.abs(hsl.h - (averageHue - 360))
        );
        hueVarianceSum += hueDiff * hueDiff;
    });
    const hueVariance = Math.sqrt(hueVarianceSum / hslColors.length);
    
    return {
        averageHue,
        hueVariance,
        averageSaturation,
        averageLightness,
        count: hslColors.length
    };
}

/**
 * Applies warm/cool adjustment to an HSL color with painter-like sensibility
 * @param {Object} hsl HSL color object
 * @param {number} value Warm/cool value (-100 to +100)
 * @param {Object} paletteAnalysis Analysis of the color palette
 * @return {Object} Adjusted HSL color
 */
function adjustWarmCool(hsl, value, paletteAnalysis) {
    // Normalize the value to a -1 to 1 range
    const normalizedValue = value / 100;
    
    // Create a copy of the HSL color to modify
    const result = { ...hsl };
    
    // Get the current hue
    let { h, s, l } = hsl;
    
    // Define warm and cool centers (in hue degrees)
    // Altered to create more painter-like temperature shifts
    const warmPrimary = 30;    // Orange-red (warm)
    const warmSecondary = 60;  // Yellow (warm highlight)
    const coolPrimary = 210;   // Blue (cool)
    const coolSecondary = 280; // Purple-blue (cool shadow)
    
    // Calculate color character - how warm or cool it currently is
    const temperatureProfile = calculateColorTemperature(h, s, l);
    
    // Non-linear easing function for natural transitions
    const easeInOutQuintic = (x) => {
        return x < 0.5 
            ? 16 * x * x * x * x * x 
            : 1 - Math.pow(-2 * x + 2, 5) / 2;
    };
    
    // Apply transformations using painter-like techniques
    if (normalizedValue > 0) { // Moving towards warm
        // Select warm targets based on the color's current temperature and character
        const warmTarget = selectWarmTarget(h, s, l, warmPrimary, warmSecondary);
        
        // Calculate shift intensity based on current temperature
        const shiftIntensity = calculateShiftIntensity(
            temperatureProfile.temperature,
            normalizedValue,
            easeInOutQuintic,
            false // warming
        );
        
        // Apply hue shift with respect to color's current saturation and temperature
        result.h = mixHueNaturally(h, warmTarget, shiftIntensity, s);
        
        // Adjust saturation - increase for cool colors, preserve for already warm colors
        const satAdjustment = temperatureProfile.temperature < 0 
            ? 0.25 * -temperatureProfile.temperature * normalizedValue 
            : 0.1 * normalizedValue;
        result.s = Math.min(100, s + (s * satAdjustment));
        
        // Slight lightness adjustment - warming tends to appear brighter
        if (l < 80 && l > 10) {
            const lightnessAdjust = 0.05 * normalizedValue * (1 - (Math.abs(l - 50) / 50));
            result.l = Math.min(100, l + lightnessAdjust * l);
        }
        
    } else { // Moving towards cool
        // Select cool targets based on color's current temperature and character
        const coolTarget = selectCoolTarget(h, s, l, coolPrimary, coolSecondary);
        
        // Calculate shift intensity for cooling with adaptive response
        const shiftIntensity = calculateShiftIntensity(
            temperatureProfile.temperature,
            -normalizedValue,
            easeInOutQuintic,
            true // cooling
        );
        
        // Apply hue shift with naturalistic mixing
        result.h = mixHueNaturally(h, coolTarget, shiftIntensity, s);
        
        // Saturation adjustments - preserve rich blues, reduce warmth in warm colors
        const satAdjustment = temperatureProfile.temperature > 0
            ? -0.20 * temperatureProfile.temperature * -normalizedValue 
            : (h > 180 && h < 270) ? 0.1 * -normalizedValue : 0;
        result.s = Math.max(0, Math.min(100, s + (s * satAdjustment)));
        
        // Subtle lightness shift - cooling can deepen shadows
        if (l < 90 && l > 20 && s > 20) {
            // More nuanced lightness adjustment for different hue ranges
            const lightnessAdjust = calculateCoolLightnessAdjustment(h, l, s) * -normalizedValue;
            result.l = Math.max(0, l + lightnessAdjust);
        }
    }
    
    // Apply palette-aware adjustments to maintain color relationships
    if (paletteAnalysis.count > 1) {
        applyPaletteAwareAdjustments(result, temperatureProfile, paletteAnalysis, normalizedValue);
    }
    
    return result;
}

/**
 * Calculates a color's temperature profile based on its HSL values
 * @param {number} h Hue
 * @param {number} s Saturation
 * @param {number} l Lightness
 * @return {Object} Temperature profile with temperature value and characteristics
 */
function calculateColorTemperature(h, s, l) {
    // Define warm and cool zones
    const warmZones = [
        { center: 30, weight: 1.0 },    // Red-orange
        { center: 60, weight: 0.9 },    // Yellow-orange
        { center: 90, weight: 0.6 }     // Yellow-green
    ];
    
    const coolZones = [
        { center: 210, weight: 1.0 },   // Blue
        { center: 180, weight: 0.8 },   // Cyan
        { center: 270, weight: 0.9 }    // Purple
    ];
    
    // Calculate weighted temperature (-1 to 1 scale, -1 is coolest, 1 is warmest)
    let temperature = 0;
    
    // Check warm zones
    for (const zone of warmZones) {
        const distance = Math.min(
            Math.abs(h - zone.center),
            Math.abs(h - (zone.center + 360)),
            Math.abs(h - (zone.center - 360))
        );
        
        // Closer colors have more influence
        if (distance < 60) {
            const influence = (1 - (distance / 60)) * zone.weight;
            temperature += influence * (s / 100); // Scale by saturation
        }
    }
    
    // Check cool zones
    for (const zone of coolZones) {
        const distance = Math.min(
            Math.abs(h - zone.center),
            Math.abs(h - (zone.center + 360)),
            Math.abs(h - (zone.center - 360))
        );
        
        // Closer colors have more influence
        if (distance < 60) {
            const influence = (1 - (distance / 60)) * zone.weight;
            temperature -= influence * (s / 100); // Scale by saturation
        }
    }
    
    // Determine additional characteristics
    const isNeutral = Math.abs(temperature) < 0.2 || s < 15;
    const isPastel = s < 50 && l > 70;
    const isEarthy = (h >= 20 && h <= 50) && s < 70 && l < 60;
    
    return {
        temperature: Math.max(-1, Math.min(1, temperature)), // Clamp to -1 to 1
        isNeutral,
        isPastel,
        isEarthy
    };
}

/**
 * Selects the appropriate warm target hue based on color characteristics
 * @param {number} h Current hue
 * @param {number} s Current saturation
 * @param {number} l Current lightness
 * @param {number} warmPrimary Primary warm hue target
 * @param {number} warmSecondary Secondary warm hue target
 * @return {number} Target hue for warming
 */
function selectWarmTarget(h, s, l, warmPrimary, warmSecondary) {
    // For blues, shift toward greens (like adding yellow - a painter technique)
    if (h > 180 && h < 270) {
        return h - 30;
    }
    
    // For dark reds, shift toward deeper oranges
    if ((h >= 330 || h <= 10) && l < 50) {
        return 20;
    }
    
    // For light colors, favor yellow shifts
    if (l > 70) {
        return warmSecondary;
    }
    
    // For greens, shift toward yellow-greens
    if (h >= 90 && h <= 150) {
        return h - 15;
    }
    
    // Default to primary warm target
    return warmPrimary;
}

/**
 * Selects the appropriate cool target hue based on color characteristics
 * @param {number} h Current hue
 * @param {number} s Current saturation
 * @param {number} l Current lightness
 * @param {number} coolPrimary Primary cool hue target
 * @param {number} coolSecondary Secondary cool hue target
 * @return {number} Target hue for cooling
 */
function selectCoolTarget(h, s, l, coolPrimary, coolSecondary) {
    // For reds, shift toward magentas and purples
    if ((h >= 330 || h <= 30) && s > 50) {
        return 315;
    }
    
    // For yellows, shift toward greens then blues
    if (h >= 40 && h <= 80) {
        return 160;
    }
    
    // For shadows and dark colors, favor deeper blues
    if (l < 40) {
        return coolSecondary;
    }
    
    // For oranges, shift toward cool purples
    if (h >= 15 && h <= 45) {
        return 290;
    }
    
    // Default to primary cool target
    return coolPrimary;
}

/**
 * Calculates the intensity of the shift based on current color temperature
 * @param {number} currentTemperature Current temperature value (-1 to 1)
 * @param {number} adjustValue The adjustment value (0 to 1)
 * @param {Function} easeFn Easing function to use
 * @param {boolean} isCooling Whether we're cooling (true) or warming (false)
 * @return {number} Shift intensity (0 to 1)
 */
function calculateShiftIntensity(currentTemperature, adjustValue, easeFn, isCooling) {
    // Base intensity from the adjustment value with easing applied
    let intensity = easeFn(adjustValue);
    
    // Modify based on current temperature and direction
    if (isCooling) {
        // When cooling, already cool colors shift less, warm colors shift more
        intensity *= 0.7 + (0.3 * Math.max(0, currentTemperature));
    } else {
        // When warming, already warm colors shift less, cool colors shift more
        intensity *= 0.7 + (0.3 * Math.max(0, -currentTemperature));
    }
    
    return Math.min(1, intensity);
}

/**
 * Mix two hues with a given factor in a way that simulates natural paint mixing
 * @param {number} h1 Source hue
 * @param {number} h2 Target hue
 * @param {number} factor Mixing factor (0-1)
 * @param {number} saturation Current saturation (affects mixing behavior)
 * @return {number} Mixed hue
 */
function mixHueNaturally(h1, h2, factor, saturation) {
    // Ensure the hues are normalized
    h1 = normalizeHue(h1);
    h2 = normalizeHue(h2);
    
    // Calculate the shortest path to mix hues
    let delta = h2 - h1;
    if (Math.abs(delta) > 180) {
        if (delta > 0) {
            delta = delta - 360;
        } else {
            delta = delta + 360;
        }
    }
    
    // Saturation affects mixing behavior - highly saturated colors
    // maintain their hue more when mixed in real paint
    const saturationFactor = 1 - ((100 - saturation) / 300);
    
    // Variable mixing based on hue regions to simulate pigment behavior
    let mixFactor = factor;
    
    // Red-orange hues have stronger pigments and resist change
    if ((h1 >= 0 && h1 <= 60) || h1 > 330) {
        mixFactor = factor * (0.7 + (0.3 * saturationFactor));
    }
    
    // Blues mix more gradually
    if (h1 >= 180 && h1 <= 270) {
        mixFactor = factor * (0.85 + (0.15 * saturationFactor));
    }
    
    // Mix the hues
    return normalizeHue(h1 + delta * mixFactor);
}

/**
 * Calculate lightness adjustment for cooling colors
 * @param {number} h Hue
 * @param {number} l Lightness
 * @param {number} s Saturation
 * @return {number} Lightness adjustment factor
 */
function calculateCoolLightnessAdjustment(h, l, s) {
    // Shadows in cool colors tend to deepen more
    if (h >= 180 && h <= 270) {
        return -0.08 * (s / 100);
    }
    
    // Warm colors tend to darken slightly more when cooled
    if ((h >= 0 && h <= 60) || h > 330) {
        return -0.12 * (s / 100);
    }
    
    // Default adjustment
    return -0.05 * (s / 100);
}

/**
 * Apply palette-aware adjustments to maintain color relationships
 * @param {Object} resultHsl The HSL color being adjusted
 * @param {Object} temperature Temperature profile of the color
 * @param {Object} paletteAnalysis Analysis of the overall palette
 * @param {number} normalizedValue Normalized adjustment value (-1 to 1)
 */
function applyPaletteAwareAdjustments(resultHsl, temperature, paletteAnalysis, normalizedValue) {
    // Calculate how much this color deviates from the palette average
    const hueDiff = Math.min(
        Math.abs(resultHsl.h - paletteAnalysis.averageHue),
        Math.abs(resultHsl.h - (paletteAnalysis.averageHue + 360)),
        Math.abs(resultHsl.h - (paletteAnalysis.averageHue - 360))
    );
    
    // If the palette has high hue variance, preserve distinctive colors
    if (paletteAnalysis.hueVariance > 60 && hueDiff > 45) {
        // Reduce the effect slightly for distinctive colors to preserve palette diversity
        const preservationFactor = 0.15 * (hueDiff / 180);
        resultHsl.h = mixHue(resultHsl.h, resultHsl.h - (normalizedValue * 10), preservationFactor);
    }
    
    // Preserve neutral grays regardless of warming/cooling
    if (temperature.isNeutral && resultHsl.s < 15) {
        // Allow only slight warming/cooling of neutral colors
        const maxSatChange = 10 * Math.abs(normalizedValue);
        resultHsl.s = Math.min(resultHsl.s, maxSatChange);
    }
}

/**
 * Mix two hues with a given factor
 * @param {number} h1 Source hue
 * @param {number} h2 Target hue
 * @param {number} factor Mixing factor (0-1)
 * @return {number} Mixed hue
 */
function mixHue(h1, h2, factor) {
    // Ensure the hues are normalized
    h1 = normalizeHue(h1);
    h2 = normalizeHue(h2);
    
    // Calculate the shortest path to mix hues
    let delta = h2 - h1;
    if (Math.abs(delta) > 180) {
        if (delta > 0) {
            delta = delta - 360;
        } else {
            delta = delta + 360;
        }
    }
    
    // Mix the hues
    return normalizeHue(h1 + delta * factor);
}

/**
 * Normalize a hue value to be between 0-360
 * @param {number} hue Hue value
 * @return {number} Normalized hue
 */
function normalizeHue(hue) {
    hue = hue % 360;
    return hue < 0 ? hue + 360 : hue;
}