import { rgbToHsl } from './colorUtils.js';

// Color dictionary with descriptive words and color associations
const colorDictionary = {
    red: ['Crimson', 'Ruby', 'Scarlet', 'Vermilion', 'Carmine', 'Cardinal', 'Brick'],
    orange: ['Tangerine', 'Amber', 'Rust', 'Copper', 'Bronze', 'Apricot', 'Sunset'],
    yellow: ['Mustard', 'Honey', 'Lemon', 'Canary', 'Gold', 'Marigold', 'Butter'],
    green: ['Emerald', 'Forest', 'Sage', 'Moss', 'Olive', 'Jade', 'Pine'],
    blue: ['Azure', 'Navy', 'Sky', 'Cobalt', 'Ocean', 'Sapphire', 'Denim'],
    purple: ['Lavender', 'Plum', 'Violet', 'Orchid', 'Grape', 'Amethyst', 'Mauve'],
    pink: ['Blush', 'Rose', 'Coral', 'Salmon', 'Flamingo', 'Peony', 'Cherry'],
    neutral: ['Stone', 'Ash', 'Smoke', 'Pebble', 'Clay', 'Slate', 'Fog']
};

// Nature and landscape words to add context
const natureWords = [
    'Meadow', 'Mountain', 'Valley', 'Canyon', 'Forest', 'River', 'Desert', 
    'Horizon', 'Shore', 'Prairie', 'Peak', 'Grove', 'Basin', 'Coast'
];

// Mood and atmosphere words
const moodWords = [
    'Calm', 'Vibrant', 'Serene', 'Intense', 'Soft', 'Bold', 'Gentle', 
    'Warm', 'Cool', 'Dreamy', 'Subtle', 'Vivid', 'Muted', 'Rich'
];

// Categorize a color based on its HSL values
function categorizeColor(color) {
    const hsl = rgbToHsl(color.r, color.g, color.b);
    const { h, s, l } = hsl;

    if (s < 10 || l < 15 || l > 85) return 'neutral';
    if (h >= 345 || h < 15) return 'red';
    if (h >= 15 && h < 45) return 'orange';
    if (h >= 45 && h < 90) return 'yellow';
    if (h >= 90 && h < 150) return 'green';
    if (h >= 150 && h < 210) return 'blue';
    if (h >= 210 && h < 270) return 'purple';
    if (h >= 270 && h < 345) return 'pink';
    
    return 'neutral';
}

export function generatePaletteName(colors) {
    if (!colors || colors.length === 0) return 'Empty Palette';

    // Count color categories
    const colorCounts = {};
    colors.forEach(color => {
        const category = categorizeColor(color);
        colorCounts[category] = (colorCounts[category] || 0) + 1;
    });

    // Determine dominant color categories
    const dominantCategories = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([category]) => category);

    // Select descriptive words from the dominant categories
    const descriptors = dominantCategories.flatMap(category => 
        colorDictionary[category] || colorDictionary.neutral
    );

    // Mix in a nature word or mood word for additional context
    const contextWords = [...natureWords, ...moodWords];
    
    // Create name combinations
    const nameComponents = [
        descriptors[Math.floor(Math.random() * descriptors.length)],
        contextWords[Math.floor(Math.random() * contextWords.length)]
    ];

    // Optional: Add third word for longer names occasionally
    if (Math.random() > 0.5) {
        nameComponents.push(
            contextWords[Math.floor(Math.random() * contextWords.length)]
        );
    }

    return nameComponents.join(' ') + ' Palette';
}