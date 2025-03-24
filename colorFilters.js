// Color filter transformations

// Filter definitions with color transformation functions
export const filters = {
    none: {
        name: "None",
        description: "No filter applied",
        transform: (color, strength) => color // Return original color
    },
    sunset: {
        name: "Sunset",
        description: "Warm golden sunset tones",
        transform: (color, strength) => {
            const { r, g, b } = color;
            // Normalize strength to 0-1
            const factor = strength / 100;
            
            // Increase reds and yellows, reduce blues
            return {
                r: Math.min(255, Math.round(r + (factor * 40))),
                g: Math.min(255, Math.round(g + (factor * 15))),
                b: Math.max(0, Math.round(b - (factor * 20)))
            };
        }
    },
    moonlight: {
        name: "Moonlight",
        description: "Cool blue night tones",
        transform: (color, strength) => {
            const { r, g, b } = color;
            const factor = strength / 100;
            
            // Shift towards cool blue tones
            return {
                r: Math.max(0, Math.round(r - (factor * 30))),
                g: Math.max(0, Math.round(g - (factor * 10))),
                b: Math.min(255, Math.round(b + (factor * 35)))
            };
        }
    },
    noir: {
        name: "Noir",
        description: "Black and white film noir",
        transform: (color, strength) => {
            const { r, g, b } = color;
            const factor = strength / 100;
            
            // Convert to grayscale
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Increase contrast
            const contrast = Math.min(255, Math.max(0, 
                Math.round((gray - 128) * (1 + factor * 0.5) + 128)
            ));
            
            // Mix original with noir based on strength
            return {
                r: Math.round(r * (1 - factor) + contrast * factor),
                g: Math.round(g * (1 - factor) + contrast * factor),
                b: Math.round(b * (1 - factor) + contrast * factor)
            };
        }
    },
    campfire: {
        name: "Campfire",
        description: "Warm orange-red campfire glow",
        transform: (color, strength) => {
            const { r, g, b } = color;
            const factor = strength / 100;
            
            // Add warm orange-red glow
            return {
                r: Math.min(255, Math.round(r + (factor * 50))),
                g: Math.max(0, Math.min(255, Math.round(g - (factor * 10) + (r * factor * 0.2)))),
                b: Math.max(0, Math.round(b - (factor * 30)))
            };
        }
    }
};

// Apply filter to a palette of colors
export function applyFilterToPalette(colors, filterName, strength) {
    if (!colors || !colors.length) return [];
    if (!filters[filterName]) return colors;
    
    return colors.map(color => {
        if (!color) return color; // Skip null colors
        return filters[filterName].transform(color, strength);
    });
}

// Apply filter to an image via canvas
export function applyFilterToImage(imageElement, filterName, strength) {
    if (!imageElement || !filters[filterName] || filterName === 'none') return null;
    
    // Create a canvas to modify the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    
    // Draw the original image to the canvas
    ctx.drawImage(imageElement, 0, 0);
    
    // Get image data for manipulation
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply filter to each pixel
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Apply the filter transformation
        const filtered = filters[filterName].transform({ r, g, b }, strength);
        
        // Update pixel data
        data[i] = filtered.r;
        data[i + 1] = filtered.g;
        data[i + 2] = filtered.b;
        // Alpha channel (data[i + 3]) remains unchanged
    }
    
    // Put the modified data back on the canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Return the modified image as a data URL
    return canvas.toDataURL('image/jpeg');
}