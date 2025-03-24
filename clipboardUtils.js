// clipboardUtils.js - New file for clipboard functionality

/**
 * Copies the given colors to the clipboard in Hex format.
 * @param {Array} colors Array of RGB color objects
 */
export async function copyPaletteToClipboard(colors) {
    if (!colors || colors.length === 0) return false;
    
    const hexValues = colors.map(color => {
        if (!color) return '#FFFFFF'; // Default to white for null colors
        return rgbToHex(color.r, color.g, color.b);
    });
    
    const textToCopy = hexValues.join('\n');
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        return true;
    } catch (err) {
        console.error('Failed to copy: ', err);
        return false;
    }
}

/**
 * Converts RGB to HEX color
 * @param {number} r Red value (0-255)
 * @param {number} g Green value (0-255)
 * @param {number} b Blue value (0-255)
 * @return {string} Hex color string
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}