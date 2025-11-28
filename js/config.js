/**
 * Configuration constants for the meditation app
 */
const CONFIG = {
    // Breathing timing (milliseconds)
    targetInhaleDuration: 4000,
    targetExhaleDuration: 4000,
    holdDuration: 1000,
    totalRounds: 5,

    // Calibration
    calibrationDuration: 6000,
    adaptationRate: 0.5,

    // Audio analysis
    fftSize: 2048,
    smoothingFactor: 0.3,
    featureHistoryLength: 30,

    // Breath detection weights (sum to 1.0)
    weights: {
        envelope: 0.35,
        envelopeSlope: 0.25,
        spectralCentroid: 0.20,
        zeroCrossingRate: 0.20
    }
};

// Freeze config to prevent accidental modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.weights);
