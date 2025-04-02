// Convert HSL color space to RGB
export function hslToRgb(h, s, l) {
    // Ensure input values are in the right range
    h = h % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    // If saturation is 0, the color is a shade of gray
    if (s === 0) {
        const value = Math.round(l * 255);
        return { r: value, g: value, b: value };
    }

    // Helper function
    const hueToRgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hueToRgb(p, q, (h / 360) + 1/3);
    const g = hueToRgb(p, q, h / 360);
    const b = hueToRgb(p, q, (h / 360) - 1/3);

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// Convert RGB color space to HSL
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

// Convert RGB to CSS color string
export function rgbToCssColor(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
}

// Convert RGB to HEX color
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Calculate perceptual distance between two colors using Delta E
export function colorDistance(color1, color2) {
    // Weighted RGB distance, giving more weight to green (human eye is more sensitive to green)
    const rDiff = color1.r - color2.r;
    const gDiff = color1.g - color2.g;
    const bDiff = color1.b - color2.b;

    return Math.sqrt(
        rDiff * rDiff * 0.3 +
        gDiff * gDiff * 0.59 +
        bDiff * bDiff * 0.11
    );
}

// Calculate relative luminance and determine contrast color (black or white)
export function getContrastColor(r, g, b) {
    // Normalize RGB values to 0-1
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // Apply gamma correction (standard for sRGB)
    const gammaCorrect = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const rGamma = gammaCorrect(rNorm);
    const gGamma = gammaCorrect(gNorm);
    const bGamma = gammaCorrect(bNorm);

    // Calculate relative luminance
    const luminance = 0.2126 * rGamma + 0.7152 * gGamma + 0.0722 * bGamma;

    // Use black text for light backgrounds, white text for dark backgrounds
    // Threshold adjusted slightly for better readability on mid-tones
    return luminance > 0.4 ? '#000000' : '#FFFFFF';
}

// Helper function to categorize hue
export function getHueCategory(h) {
    if ((h >= 345 && h <= 360) || (h >= 0 && h < 15)) return 'red';
    if (h >= 15 && h < 45) return 'orange';
    if (h >= 45 && h < 70) return 'yellow';
    if (h >= 70 && h < 160) return 'green';
    if (h >= 160 && h < 250) return 'blue';
    if (h >= 250 && h < 345) return 'violet'; // Combined Indigo/Violet
    return null; // Should not happen if saturation/lightness checks pass
}

// New function to filter out similar colors
function filterSimilarColors(colors, minDistance = 10) {
    if (colors.length <= 1) return colors;
    
    const result = [colors[0]];
    
    for (let i = 1; i < colors.length; i++) {
        let tooSimilar = false;
        
        // Check against all colors we've already kept
        for (let j = 0; j < result.length; j++) {
            if (colorDistance(colors[i], result[j]) < minDistance) {
                tooSimilar = true;
                break;
            }
        }
        
        if (!tooSimilar) {
            result.push(colors[i]);
        }
    }
    
    return result;
}

// Main image analysis function
export function analyzeImage(image, numColors, mode = "dominant", config, activeColorRanges = null) {
    // Create a canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to image size
    canvas.width = image.width;
    canvas.height = image.height;
    
    // Draw image to canvas
    ctx.drawImage(image, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Sample colors from the image, passing active ranges
    const sampledColors = sampleColors(data, canvas.width, canvas.height, config, activeColorRanges);
    
    // For single color count request, return just that count
    if (numColors) {
        return findDominantColors(sampledColors, numColors);
    }
    
    // For pre-calculation, return all possible palettes
    const allPalettes = {};
    for (let i = 3; i <= config.maxColors; i++) {
        allPalettes[i] = findDominantColors(sampledColors, i);
    }
    return allPalettes;
}

function sampleColors(data, width, height, config, activeColorRanges = null) {
    const sampledColors = [];
    const samplingRate = 5; // Sample every 5 pixels
    
    // Create a default active set if none provided (all colors active)
    const defaultRanges = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'neutral']);
    const activeRanges = activeColorRanges instanceof Set && activeColorRanges.size > 0 ? activeColorRanges : defaultRanges;
    
    for (let y = 0; y < height; y += samplingRate) {
        for (let x = 0; x < width; x += samplingRate) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Skip transparent pixels
            if (data[idx + 3] < 128) continue;
            
            // Convert to HSL to filter out very dark, light or desaturated colors
            const hsl = rgbToHsl(r, g, b);

            // Check if the color should be included based on active ranges
            let category = 'neutral'; // Default to neutral
            if (hsl.s >= config.minSaturation && hsl.l >= config.minLightness && hsl.l <= config.maxLightness) {
                category = getHueCategory(hsl.h) || 'neutral'; // Get category for saturated colors
            }

            // Include the color only if its category is in the active set
            if (!activeRanges.has(category)) {
                continue;
            }

            // Also apply the original saturation/lightness filters IF it's not explicitly requested as neutral
            if (category !== 'neutral' && (hsl.s < config.minSaturation || hsl.l < config.minLightness || hsl.l > config.maxLightness)) {
                continue; // Skip low/high sat/light colors unless 'neutral' is explicitly active
            }
            
            sampledColors.push({ r, g, b });
        }
    }
    
    return sampledColors;
}

function findDominantColors(colors, numColors) {
    // If we have few colors, just return them
    if (colors.length <= numColors) return colors;
    
    // Simple k-means clustering to find dominant colors
    const clusters = [];
    const centroids = [];
    
    // Use deterministic initialization for more stable results
    // Instead of random selection, sample evenly across the color space
    const colorsCopy = [...colors]; // Create a copy to avoid modifying original
    
    // Sort colors by luminance (brightness) for more deterministic selection
    colorsCopy.sort((a, b) => {
        // Approximate luminance calculation
        const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
        const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
        return lumA - lumB;
    });
    
    // Pick evenly spaced colors as initial centroids
    const step = Math.max(1, Math.floor(colorsCopy.length / numColors));
    for (let i = 0; i < numColors; i++) {
        const index = Math.min(i * step, colorsCopy.length - 1);
        centroids.push({ ...colorsCopy[index] });
        clusters.push([]);
    }
    
    // Run a few iterations of k-means
    for (let iteration = 0; iteration < 10; iteration++) {
        // Reset clusters
        clusters.forEach(cluster => cluster.length = 0);
        
        // Assign each color to nearest centroid
        colors.forEach(color => {
            let minDistance = Infinity;
            let closestCentroidIndex = 0;
            
            centroids.forEach((centroid, i) => {
                const distance = colorDistance(color, centroid);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroidIndex = i;
                }
            });
            
            clusters[closestCentroidIndex].push(color);
        });
        
        // Update centroids based on cluster means
        for (let i = 0; i < centroids.length; i++) {
            if (clusters[i].length === 0) continue;
            
            let sumR = 0, sumG = 0, sumB = 0;
            clusters[i].forEach(color => {
                sumR += color.r;
                sumG += color.g;
                sumB += color.b;
            });
            
            centroids[i] = {
                r: Math.round(sumR / clusters[i].length),
                g: Math.round(sumG / clusters[i].length),
                b: Math.round(sumB / clusters[i].length)
            };
        }
    }
    
    // Remove any empty clusters and ensure we return exactly numColors
    const result = centroids.filter((_, i) => clusters[i].length > 0);
    
    // Filter out colors that are too similar to each other
    const filteredResult = filterSimilarColors(result);
    
    // If we have too few colors after filtering, try to add more distinct colors
    while (filteredResult.length < numColors && filteredResult.length < colors.length) {
        // Look for colors not in our result yet that are distinct enough
        for (let i = 0; i < colors.length; i++) {
            let tooSimilar = false;
            
            for (let j = 0; j < filteredResult.length; j++) {
                if (colorDistance(colors[i], filteredResult[j]) < 10) {
                    tooSimilar = true;
                    break;
                }
            }
            
            if (!tooSimilar) {
                filteredResult.push(colors[i]);
                if (filteredResult.length >= numColors) break;
            }
        }
        
        // If we can't find any more distinct colors, break to avoid infinite loop
        if (filteredResult.length <= result.length) break;
    }
    
    // If we still have too few colors, duplicate the last one
    while (filteredResult.length < numColors && filteredResult.length > 0) {
        filteredResult.push({...filteredResult[filteredResult.length - 1]});
    }
    
    // Convert to HSL for sorting by hue
    const resultWithHsl = filteredResult.map(color => {
        const hsl = rgbToHsl(color.r, color.g, color.b);
        return { color, hsl };
    });
    
    // Sort by hue for a more pleasing gradient effect
    return resultWithHsl
        .sort((a, b) => a.hsl.h - b.hsl.h)
        .map(item => item.color);
}

function findChromaticDistributedColors(colors, numColors) {
    if (colors.length <= numColors) return colors;
    
    // Convert colors to HSL for organizing by hue
    const colorsWithHsl = colors.map(color => {
        const { r, g, b } = color;
        const hsl = rgbToHsl(r, g, b);
        return { color, hsl };
    });
    
    // Define hue ranges (color categories) with more balanced ranges
    const hueRanges = [
        { name: 'Red', min: 355, max: 10, wrap: true }, // Red wraps around
        { name: 'Orange', min: 10, max: 40 },
        { name: 'Yellow', min: 40, max: 65 },
        { name: 'Yellow-Green', min: 65, max: 90 },
        { name: 'Green', min: 90, max: 150 },
        { name: 'Cyan', min: 150, max: 190 },
        { name: 'Blue', min: 190, max: 255 },
        { name: 'Purple', min: 255, max: 290 },
        { name: 'Magenta', min: 290, max: 330 },
        { name: 'Pink', min: 330, max: 355 }
    ];
    
    // Group colors by hue range
    const groupedColors = {};
    const hueRangeNames = [];
    
    // Initialize groups for all hue ranges
    hueRanges.forEach(range => {
        if (!hueRangeNames.includes(range.name)) {
            hueRangeNames.push(range.name);
            groupedColors[range.name] = [];
        }
    });
    
    // Add "Grayscale" category for desaturated colors
    hueRangeNames.push('Grayscale');
    groupedColors['Grayscale'] = [];
    
    // Assign colors to groups
    colorsWithHsl.forEach(item => {
        const hue = item.hsl.h;
        const sat = item.hsl.s;
        
        // Low saturation colors go to grayscale category
        if (sat < 15) {
            groupedColors['Grayscale'].push(item);
            return;
        }
        
        let assigned = false;
        
        // Find which range this color belongs to
        for (const range of hueRanges) {
            if (range.wrap && (hue >= range.min || hue < range.max)) {
                groupedColors[range.name].push(item);
                assigned = true;
                break;
            } else if (!range.wrap && (hue >= range.min && hue < range.max)) {
                groupedColors[range.name].push(item);
                assigned = true;
                break;
            }
        }
        
        if (!assigned) {
            groupedColors['Grayscale'].push(item);
        }
    });
    
    // For smaller palettes (3-9), prioritize major color groups
    const priorityOrder = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Magenta', 'Pink', 'Grayscale'];
    
    // Calculate color distribution
    let selectedColors = [];
    
    if (numColors < 10) {
        // For smaller palettes, prioritize most representative colors from major hue groups
        // Sort each group by saturation and lightness (to find most vivid examples)
        hueRangeNames.forEach(name => {
            if (groupedColors[name].length > 0) {
                // Sort by saturation, but also consider lightness
                const aMidLDist = Math.abs(groupedColors[name][0].hsl.l - 50);
                const bMidLDist = Math.abs(groupedColors[name][1].hsl.l - 50);
                groupedColors[name].sort((a, b) => {
                    // Prioritize saturation, but also consider lightness
                    const aMidLDist = Math.abs(a.hsl.l - 50);
                    const bMidLDist = Math.abs(b.hsl.l - 50);
                    return (b.hsl.s - a.hsl.s) || (aMidLDist - bMidLDist);
                });
            }
        });
        
        // Take most representative colors from each group based on priority
        for (let i = 0; selectedColors.length < numColors && i < priorityOrder.length; i++) {
            const name = priorityOrder[i];
            if (groupedColors[name].length > 0) {
                selectedColors.push(groupedColors[name][0]);
                groupedColors[name].shift();
            }
        }
        
        // If we still need more colors, keep taking from groups that have colors left
        while (selectedColors.length < numColors) {
            let added = false;
            for (let i = 0; i < priorityOrder.length && selectedColors.length < numColors; i++) {
                const name = priorityOrder[i];
                if (groupedColors[name].length > 0) {
                    selectedColors.push(groupedColors[name][0]);
                    groupedColors[name].shift();
                    added = true;
                }
            }
            if (!added) break; // No more colors available
        }
    } else {
        // For larger palettes, distribute colors more evenly across the hue ranges
        
        // Calculate how many colors to take from each range, ensuring good distribution
        const totalNonEmptyGroups = hueRangeNames.filter(name => groupedColors[name].length > 0).length;
        let colorsPerGroup = Math.floor(numColors / totalNonEmptyGroups);
        let remainingSlots = numColors - (colorsPerGroup * totalNonEmptyGroups);
        
        // Sort each group by a combination of saturation and value (lightness)
        // This ensures we get a good range of values within each hue
        hueRangeNames.forEach(name => {
            if (groupedColors[name].length > 0) {
                // Create value buckets within each hue group (dark, mid, light)
                const darkColors = groupedColors[name].filter(c => c.hsl.l < 30);
                const midColors = groupedColors[name].filter(c => c.hsl.l >= 30 && c.hsl.l <= 70);
                const lightColors = groupedColors[name].filter(c => c.hsl.l > 70);
                
                // Sort each bucket by saturation
                darkColors.sort((a, b) => b.hsl.s - a.hsl.s);
                midColors.sort((a, b) => b.hsl.s - a.hsl.s);
                lightColors.sort((a, b) => b.hsl.s - a.hsl.s);
                
                // Reconstruct the group with value distribution
                groupedColors[name] = [];
                
                // Calculate ratio based on what's available
                const total = darkColors.length + midColors.length + lightColors.length;
                let darkRatio = total > 0 ? darkColors.length / total : 0;
                let midRatio = total > 0 ? midColors.length / total : 0;
                let lightRatio = total > 0 ? lightColors.length / total : 0;
                
                // Take some from each bucket based on the ratio and available slots
                if (colorsPerGroup > 0) {
                    const darkCount = Math.round(darkRatio * colorsPerGroup);
                    const midCount = Math.round(midRatio * colorsPerGroup);
                    const lightCount = colorsPerGroup - darkCount - midCount;
                    
                    groupedColors[name] = [
                        ...darkColors.slice(0, darkCount),
                        ...midColors.slice(0, midCount),
                        ...lightColors.slice(0, lightCount)
                    ];
                    
                    // If we couldn't fill all slots from the ideal distribution, add more from any bucket
                    const remaining = colorsPerGroup - groupedColors[name].length;
                    if (remaining > 0) {
                        const allSorted = [...darkColors, ...midColors, ...lightColors].sort((a, b) => b.hsl.s - a.hsl.s);
                        groupedColors[name].push(...allSorted.slice(0, remaining));
                    }
                }
            }
        });
        
        // First pass: take colorsPerGroup from each non-empty group
        for (const name of priorityOrder) {
            const group = groupedColors[name];
            if (group.length > 0) {
                const toTake = Math.min(colorsPerGroup, group.length);
                selectedColors.push(...group.slice(0, toTake));
            }
        }
        
        // Second pass: distribute remaining slots giving priority to underrepresented hues
        
        const takeOrder = ['Yellow', 'Cyan', 'Green', 'Purple', 'Blue', 'Orange', 'Magenta', 'Pink', 'Red', 'Grayscale'];
        for (const name of takeOrder) {
            if (remainingSlots <= 0) break;
            const group = groupedColors[name];
            if (group.length > colorsPerGroup) {
                const extra = Math.min(remainingSlots, group.length - colorsPerGroup);
                selectedColors.push(...group.slice(colorsPerGroup, colorsPerGroup + extra));
                remainingSlots -= extra;
            }
        }
    }
    
    // Return original RGB colors, sorted by hue for smooth gradient
    return selectedColors
        .sort((a, b) => a.hsl.h - b.hsl.h)
        .map(item => item.color);
}