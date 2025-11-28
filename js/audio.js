/**
 * Audio processing and breath detection
 */
const Audio = {
    // Debouncing state
    talkingFrameCount: 0,
    TALKING_FRAMES_REQUIRED: 5,
    phaseStableFrames: 0,
    PHASE_STABLE_REQUIRED: 3,

    /**
     * Initialize audio capture
     */
    async init() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: { ideal: 44100 },
                    channelCount: { ideal: 1 }
                }
            });

            State.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Resume AudioContext (required on mobile/iOS)
            if (State.audioContext.state === 'suspended') {
                await State.audioContext.resume();
            }

            State.analyser = State.audioContext.createAnalyser();
            State.analyser.fftSize = CONFIG.fftSize;
            State.analyser.smoothingTimeConstant = 0.5;

            State.microphone = State.audioContext.createMediaStreamSource(stream);
            State.microphone.connect(State.analyser);

            State.frequencyData = new Uint8Array(State.analyser.frequencyBinCount);
            State.timeData = new Float32Array(State.analyser.fftSize);
            State.isListening = true;

            // Start monitoring
            this.monitor();

            console.log('Audio initialized. Sample rate:', State.audioContext.sampleRate);
            return true;
        } catch (error) {
            console.error('Audio init error:', error);
            return false;
        }
    },

    /**
     * Ensure audio context is running (needed for mobile)
     */
    async ensureRunning() {
        if (State.audioContext && State.audioContext.state === 'suspended') {
            try {
                await State.audioContext.resume();
                console.log('AudioContext resumed');
            } catch (e) {
                console.error('Failed to resume AudioContext:', e);
            }
        }
    },

    /**
     * Extract audio features from current frame
     */
    extractFeatures() {
        if (!State.analyser || !State.isListening) {
            return State.features;
        }

        State.analyser.getByteFrequencyData(State.frequencyData);
        State.analyser.getFloatTimeDomainData(State.timeData);

        const sampleRate = State.audioContext.sampleRate;
        const prevEnvelope = State.features.envelope;

        // 1. ENVELOPE (RMS amplitude) - focus on breathing frequencies
        const binSize = sampleRate / CONFIG.fftSize;
        const lowBin = Math.floor(80 / binSize);
        const highBin = Math.floor(600 / binSize);

        let sum = 0;
        let weightedSum = 0;
        let totalWeight = 0;

        for (let i = lowBin; i < highBin && i < State.frequencyData.length; i++) {
            const magnitude = State.frequencyData[i] / 255;
            sum += magnitude * magnitude;

            const freq = i * binSize;
            weightedSum += freq * magnitude;
            totalWeight += magnitude;
        }

        const rms = Math.sqrt(sum / (highBin - lowBin));

        // Smooth the envelope
        State.features.envelope = State.features.envelope * (1 - CONFIG.smoothingFactor) +
                                  rms * CONFIG.smoothingFactor;

        // 2. ENVELOPE SLOPE
        State.features.envelopeSlope = State.features.envelope - prevEnvelope;

        // 3. SPECTRAL CENTROID
        State.features.spectralCentroid = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // 4. ZERO CROSSING RATE
        let zeroCrossings = 0;
        for (let i = 1; i < State.timeData.length; i++) {
            if ((State.timeData[i] >= 0 && State.timeData[i - 1] < 0) ||
                (State.timeData[i] < 0 && State.timeData[i - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        State.features.zeroCrossingRate = zeroCrossings / State.timeData.length;

        // Store in history
        State.featureHistory.push({
            envelope: State.features.envelope,
            envelopeSlope: State.features.envelopeSlope,
            spectralCentroid: State.features.spectralCentroid,
            zeroCrossingRate: State.features.zeroCrossingRate,
            timestamp: Date.now()
        });

        if (State.featureHistory.length > CONFIG.featureHistoryLength) {
            State.featureHistory.shift();
        }

        // 5. Calculate BREATH SCORE
        State.features.breathScore = this.calculateBreathScore();

        return State.features;
    },

    /**
     * Calculate combined breath score (0-1)
     */
    calculateBreathScore() {
        const cal = State.calibration;
        const f = State.features;

        if (cal.silence.envelope === 0) return 0;

        let score = 0;

        // 1. Envelope score
        const envelopeAboveSilence = f.envelope > cal.silence.envelope * 1.3;
        const envelopeBelowTalking = f.envelope < cal.talking.envelope * 0.8;

        if (envelopeAboveSilence && envelopeBelowTalking) {
            const breathEnv = Math.max(cal.breathingIn.envelope, cal.breathingOut.envelope);
            const normalizedEnv = Math.min(1, f.envelope / (breathEnv + 0.01));
            score += CONFIG.weights.envelope * normalizedEnv;
        }

        // 2. Envelope slope score
        const slopeVariance = this.getRecentSlopeVariance();
        const talkingSlopeVar = cal.talking.envelopeSlopeVariance || 0.01;
        const slopeScore = Math.max(0, 1 - (slopeVariance / talkingSlopeVar));
        score += CONFIG.weights.envelopeSlope * slopeScore;

        // 3. Spectral centroid score
        const breathCentroid = Math.max(cal.breathingIn.spectralCentroid, cal.breathingOut.spectralCentroid) || 300;
        const talkingCentroid = cal.talking.spectralCentroid || 500;

        if (f.spectralCentroid > 0 && f.spectralCentroid < talkingCentroid) {
            const centroidScore = 1 - (f.spectralCentroid / talkingCentroid);
            score += CONFIG.weights.spectralCentroid * Math.max(0, centroidScore);
        }

        // 4. Zero crossing rate score
        const breathZCR = Math.max(cal.breathingIn.zeroCrossingRate, cal.breathingOut.zeroCrossingRate) || 0.05;
        const talkingZCR = cal.talking.zeroCrossingRate || 0.15;

        if (f.zeroCrossingRate < talkingZCR) {
            const zcrScore = 1 - (f.zeroCrossingRate / talkingZCR);
            score += CONFIG.weights.zeroCrossingRate * Math.max(0, zcrScore);
        }

        return Math.max(0, Math.min(1, score));
    },

    /**
     * Get variance of recent envelope slopes
     */
    getRecentSlopeVariance() {
        if (State.featureHistory.length < 5) return 0;

        const slopes = State.featureHistory.slice(-10).map(f => f.envelopeSlope);
        const avg = slopes.reduce((a, b) => a + b, 0) / slopes.length;
        return slopes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / slopes.length;
    },

    /**
     * Detect if user is talking (with debouncing)
     */
    isTalkingDetected() {
        const f = State.features;
        const cal = State.calibration;

        if (cal.talking.envelope === 0) return false;

        const highEnvelope = f.envelope > cal.talking.envelope * 0.5;
        const highCentroid = f.spectralCentroid > (cal.talking.spectralCentroid || 400) * 0.6;
        const highZCR = f.zeroCrossingRate > (cal.talking.zeroCrossingRate || 0.1) * 0.5;
        const highSlopeVariance = this.getRecentSlopeVariance() > (cal.talking.envelopeSlopeVariance || 0.005) * 0.3;

        const talkingIndicators = [highEnvelope, highCentroid, highZCR, highSlopeVariance];
        const talkingCount = talkingIndicators.filter(Boolean).length;

        if (talkingCount >= 3) {
            this.talkingFrameCount++;
        } else {
            this.talkingFrameCount = Math.max(0, this.talkingFrameCount - 1);
        }

        return this.talkingFrameCount >= this.TALKING_FRAMES_REQUIRED;
    },

    /**
     * Detect breath phase transitions (with hysteresis)
     */
    detectBreathPhase() {
        const f = State.features;
        const cal = State.calibration;
        const prevPhase = State.breathPhase;

        const silenceThreshold = (cal.silence.envelope || 0.01) * 2;
        const isActive = f.envelope > silenceThreshold;

        const slopeThreshold = 0.003;
        const isRising = f.envelopeSlope > slopeThreshold;
        const isFalling = f.envelopeSlope < -slopeThreshold;

        let targetPhase = prevPhase;

        if (!isActive) {
            targetPhase = 'idle';
        } else if (isRising) {
            targetPhase = 'rising';
        } else if (isFalling) {
            targetPhase = 'falling';
        }

        // Apply hysteresis
        if (targetPhase === prevPhase) {
            this.phaseStableFrames = 0;
        } else {
            this.phaseStableFrames++;
            if (this.phaseStableFrames >= this.PHASE_STABLE_REQUIRED) {
                if (prevPhase === 'idle' && targetPhase === 'rising') {
                    State.breathStartTime = Date.now();
                }
                if (prevPhase === 'falling' && targetPhase === 'idle') {
                    State.lastBreathDuration = Date.now() - State.breathStartTime;
                }
                State.breathPhase = targetPhase;
                this.phaseStableFrames = 0;
            }
        }

        State.breathConfidence = f.breathScore;
        return State.breathPhase;
    },

    /**
     * Main audio monitoring loop
     */
    monitor() {
        if (!State.isListening) return;

        this.extractFeatures();
        this.detectBreathPhase();
        UI.updateAudioLevel();

        requestAnimationFrame(() => this.monitor());
    },

    /**
     * Collect feature samples over duration
     */
    collectSamples(durationMs) {
        return new Promise((resolve) => {
            const samples = [];
            const startTime = Date.now();

            const collect = () => {
                if (Date.now() - startTime < durationMs) {
                    this.extractFeatures();
                    samples.push({
                        envelope: State.features.envelope,
                        spectralCentroid: State.features.spectralCentroid,
                        zeroCrossingRate: State.features.zeroCrossingRate,
                        envelopeSlope: State.features.envelopeSlope
                    });
                    setTimeout(collect, 50);
                } else {
                    resolve(samples);
                }
            };

            collect();
        });
    },

    /**
     * Calculate average features from samples
     */
    averageFeatures(samples) {
        if (samples.length === 0) {
            return { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0 };
        }

        const sum = samples.reduce((acc, s) => ({
            envelope: acc.envelope + s.envelope,
            spectralCentroid: acc.spectralCentroid + s.spectralCentroid,
            zeroCrossingRate: acc.zeroCrossingRate + s.zeroCrossingRate
        }), { envelope: 0, spectralCentroid: 0, zeroCrossingRate: 0 });

        return {
            envelope: sum.envelope / samples.length,
            spectralCentroid: sum.spectralCentroid / samples.length,
            zeroCrossingRate: sum.zeroCrossingRate / samples.length
        };
    }
};
