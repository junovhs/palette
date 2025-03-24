export const config = {
    // Number of dominant colors to extract
    numColors: 30,
    
    // Maximum number of colors to extract
    maxColors: 30,
    
    // Adjust these values to fine-tune the color extraction algorithm
    samplingRate: 5, // Higher values = faster but less accurate
    
    // Color analysis settings
    minSaturation: 5, // Minimum saturation percentage to consider a color
    minLightness: 15, // Minimum lightness percentage
    maxLightness: 80, // Maximum lightness percentage
};