// paletteSimplifier.js - New file for palette simplification functions
import { rgbToHsl, hslToRgb, colorDistance } from './colorUtils.js';

/**
 * Simplify a palette by clustering similar colors together
 * @param {Array} colors Array of RGB color objects
 * @param {Object} options Configuration options
 * @return {Array} Simplified palette with reduced colors
 */
export function simplifyPalette(colors, options = {}) {
    if (!colors || colors.length === 0) return [];
    
    // Default options
    const defaults = {
        targetColorCount: 15,
        minColors: 12,
        maxColors: 15,
        preserveExtremesCount: 2, // Preserve darkest and lightest
        iterations: 10
    };
    
    const config = {...defaults, ...options};
    
    // If we have fewer colors than our minimum, just return them
    if (colors.length <= config.minColors) return [...colors];
    
    // 1. Preserve extremes (darkest and lightest colors)
    const colorsWithHsl = colors.map(color => {
        const hsl = rgbToHsl(color.r, color.g, color.b);
        return { color, hsl };
    });
    
    // Sort by lightness
    const sortedByLightness = [...colorsWithHsl].sort((a, b) => a.hsl.l - b.hsl.l);
    
    // Get darkest and lightest colors
    const preservedColors = [];
    
    // Add darkest colors
    for (let i = 0; i < config.preserveExtremesCount; i++) {
        if (i < sortedByLightness.length) {
            preservedColors.push(sortedByLightness[i].color);
        }
    }
    
    // Add lightest colors
    for (let i = 0; i < config.preserveExtremesCount; i++) {
        const index = sortedByLightness.length - 1 - i;
        if (index >= 0 && index >= config.preserveExtremesCount) {
            preservedColors.push(sortedByLightness[index].color);
        }
    }
    
    // 2. Cluster the remaining colors
    const targetClusters = config.targetColorCount - preservedColors.length;
    const remainingColors = colors.filter(color => {
        return !preservedColors.some(pc => 
            pc.r === color.r && pc.g === color.g && pc.b === color.b
        );
    });
    
    // If we don't need to cluster, just return
    if (remainingColors.length <= targetClusters) {
        return [...preservedColors, ...remainingColors];
    }
    
    // K-means clustering
    const clusters = kMeansClustering(remainingColors, targetClusters, config.iterations);
    
    // Get the average color of each cluster
    const clusterCentroids = clusters.map(cluster => {
        if (cluster.length === 0) return null;
        
        let sumR = 0, sumG = 0, sumB = 0;
        
        cluster.forEach(color => {
            sumR += color.r;
            sumG += color.g;
            sumB += color.b;
        });
        
        return {
            r: Math.round(sumR / cluster.length),
            g: Math.round(sumG / cluster.length),
            b: Math.round(sumB / cluster.length)
        };
    }).filter(centroid => centroid !== null);
    
    // 3. Ensure diversity - we could check hue distribution here if needed
    const result = [...preservedColors, ...clusterCentroids];
    
    // Sort by hue for a more pleasing palette
    const resultWithHsl = result.map(color => {
        const hsl = rgbToHsl(color.r, color.g, color.b);
        return { color, hsl };
    });
    
    return resultWithHsl
        .sort((a, b) => a.hsl.h - b.hsl.h)
        .map(item => item.color);
}

/**
 * Perform k-means clustering on colors
 * @param {Array} colors Colors to cluster
 * @param {number} k Number of clusters
 * @param {number} iterations Max iterations
 * @return {Array} Array of clusters (each cluster is an array of colors)
 */
function kMeansClustering(colors, k, iterations = 10) {
    if (colors.length <= k) {
        // If we have fewer colors than clusters, each color gets its own cluster
        return colors.map(color => [color]);
    }
    
    // Initialize clusters with evenly spaced colors
    const sortedColors = [...colors];
    
    // Sort by perceived brightness for more deterministic initialization
    sortedColors.sort((a, b) => {
        const brightnessA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
        const brightnessB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
        return brightnessA - brightnessB;
    });
    
    // Pick centroids at even intervals
    const centroids = [];
    const step = Math.max(1, Math.floor(sortedColors.length / k));
    
    for (let i = 0; i < k; i++) {
        const index = Math.min(i * step, sortedColors.length - 1);
        if (index < sortedColors.length) {
            centroids.push({...sortedColors[index]});
        }
    }
    
    // Initialize empty clusters
    let clusters = Array(centroids.length).fill().map(() => []);
    
    // Run iterations
    for (let iter = 0; iter < iterations; iter++) {
        // Reset clusters
        clusters = Array(centroids.length).fill().map(() => []);
        
        // Assign each color to the nearest centroid
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
        let changed = false;
        
        for (let i = 0; i < centroids.length; i++) {
            if (clusters[i].length === 0) continue;
            
            let sumR = 0, sumG = 0, sumB = 0;
            
            clusters[i].forEach(color => {
                sumR += color.r;
                sumG += color.g;
                sumB += color.b;
            });
            
            const newCentroid = {
                r: Math.round(sumR / clusters[i].length),
                g: Math.round(sumG / clusters[i].length),
                b: Math.round(sumB / clusters[i].length)
            };
            
            // Check if centroid has changed
            if (
                newCentroid.r !== centroids[i].r ||
                newCentroid.g !== centroids[i].g ||
                newCentroid.b !== centroids[i].b
            ) {
                centroids[i] = newCentroid;
                changed = true;
            }
        }
        
        // If no centroids changed, we've converged
        if (!changed) break;
    }
    
    return clusters;
}