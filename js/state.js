/**
 * Application state management
 */
const State = {
    // Audio
    audioContext: null,
    analyser: null,
    microphone: null,
    frequencyData: null,
    timeData: null,
    isListening: false,

    // Audio features (current frame)
    features: {
        envelope: 0,
        envelopeSlope: 0,
        spectralCentroid: 0,
        zeroCrossingRate: 0,
        breathScore: 0
    },

    // Feature history for analysis
    featureHistory: [],

    // Calibration profiles
    calibration: {
        silence: {
            envelope: 0,
            spectralCentroid: 0,
            zeroCrossingRate: 0
        },
        talking: {
            envelope: 0,
            spectralCentroid: 0,
            zeroCrossingRate: 0,
            envelopeSlopeVariance: 0
        },
        breathingIn: {
            envelope: 0,
            spectralCentroid: 0,
            zeroCrossingRate: 0,
            duration: 0,
            envelopePattern: []
        },
        breathingOut: {
            envelope: 0,
            spectralCentroid: 0,
            zeroCrossingRate: 0,
            duration: 0,
            envelopePattern: []
        }
    },

    // Breathing detection
    breathPhase: 'idle',
    breathStartTime: 0,
    lastBreathDuration: 0,
    breathConfidence: 0,

    // User sphere animation
    userSpherePercent: 0,
    userSphereTarget: 0,
    userAnimationStart: 0,
    userAnimationDuration: 4000,

    // Adaptive timing
    currentInhaleDuration: 4000,
    currentExhaleDuration: 4000,

    // Session
    currentPhase: 'idle',
    currentRound: 0,
    meditationStartTime: 0,
    syncScores: [],
    totalBreaths: 0,

    // Reset session state
    resetSession() {
        this.currentRound = 0;
        this.syncScores = [];
        this.totalBreaths = 0;
        this.meditationStartTime = 0;
        this.currentPhase = 'idle';
    },

    // Reset calibration
    resetCalibration() {
        this.calibration = {
            silence: { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0 },
            talking: { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0, envelopeSlopeVariance: 0 },
            breathingIn: { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0, duration: 0, envelopePattern: [] },
            breathingOut: { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0, duration: 0, envelopePattern: [] }
        };
    }
};
