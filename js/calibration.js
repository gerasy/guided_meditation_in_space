/**
 * Calibration routines
 */
const Calibration = {
    /**
     * Run full calibration sequence
     */
    async run() {
        await this.calibrateSilence();
        await this.calibrateTalking();
        await this.calibrateBreathingIn();
        await this.calibrateBreathingOut();

        this.showResults();
        UI.showScreen('ready-screen');
    },

    /**
     * Calibrate silence baseline
     */
    calibrateSilence() {
        return new Promise((resolve) => {
            document.getElementById('cal-silence-dot').classList.add('active');
            UI.updateCalibrationProgress(1, 4);

            Speech.speak("Let's start by calibrating silence. Please remain quiet and still for a few seconds.", async () => {
                document.getElementById('calibration-instruction').textContent =
                    "Stay quiet and still...";

                await new Promise(r => setTimeout(r, 500));
                const samples = await Audio.collectSamples(CONFIG.calibrationDuration);

                State.calibration.silence = Audio.averageFeatures(samples);

                document.getElementById('cal-silence-dot').classList.remove('active');
                document.getElementById('cal-silence-dot').classList.add('complete');

                console.log('Silence calibration:', State.calibration.silence);
                Speech.speak("Good. Silence calibrated.", resolve);
            });
        });
    },

    /**
     * Calibrate talking pattern
     */
    calibrateTalking() {
        return new Promise((resolve) => {
            document.getElementById('cal-talking-dot').classList.add('active');
            UI.updateCalibrationProgress(2, 4);

            Speech.speak("Now, please speak normally for a few seconds. Count from one to ten, or say anything you like.", async () => {
                document.getElementById('calibration-instruction').textContent =
                    "Please speak now... (count 1 to 10)";

                await new Promise(r => setTimeout(r, 500));
                const samples = await Audio.collectSamples(CONFIG.calibrationDuration);

                const avg = Audio.averageFeatures(samples);

                // Calculate slope variance
                const slopes = samples.map(s => s.envelopeSlope);
                const slopeAvg = slopes.reduce((a, b) => a + b, 0) / slopes.length;
                const slopeVariance = slopes.reduce((a, b) => a + Math.pow(b - slopeAvg, 2), 0) / slopes.length;

                State.calibration.talking = {
                    ...avg,
                    envelopeSlopeVariance: slopeVariance
                };

                document.getElementById('cal-talking-dot').classList.remove('active');
                document.getElementById('cal-talking-dot').classList.add('complete');

                console.log('Talking calibration:', State.calibration.talking);
                Speech.speak("Thank you. Now let's measure your breathing.", resolve);
            });
        });
    },

    /**
     * Calibrate breathing in
     */
    calibrateBreathingIn() {
        return new Promise((resolve) => {
            document.getElementById('cal-breathin-dot').classList.add('active');
            UI.updateCalibrationProgress(3, 4);

            Speech.speak("Take a slow, deep breath in through your nose. Start when you're ready and breathe in completely.", () => {
                document.getElementById('calibration-instruction').textContent =
                    "Breathe IN slowly... (we're measuring)";

                let breathStarted = false;
                let breathStartTime = 0;
                let peakEnvelope = 0;
                const featureSamples = [];
                const envelopePattern = [];
                const startTime = Date.now();
                const maxWaitTime = 12000;

                const silenceEnv = State.calibration.silence.envelope;
                const threshold = silenceEnv * 1.5;

                const monitor = () => {
                    Audio.extractFeatures();
                    const f = State.features;

                    const displayLevel = Math.min(1, f.envelope / (State.calibration.talking.envelope + 0.01));
                    UI.setSpherePercent('calibration-fill', displayLevel * 100);

                    if (!breathStarted && f.envelope > threshold) {
                        breathStarted = true;
                        breathStartTime = Date.now();
                    }

                    if (breathStarted) {
                        featureSamples.push({
                            envelope: f.envelope,
                            spectralCentroid: f.spectralCentroid,
                            zeroCrossingRate: f.zeroCrossingRate
                        });
                        envelopePattern.push(f.envelope);

                        if (f.envelope > peakEnvelope) {
                            peakEnvelope = f.envelope;
                        }

                        const timeSinceStart = Date.now() - breathStartTime;
                        if (f.envelope < peakEnvelope * 0.35 && timeSinceStart > 1000) {
                            const duration = Date.now() - breathStartTime;
                            const avg = Audio.averageFeatures(featureSamples);

                            State.calibration.breathingIn = {
                                ...avg,
                                duration: duration,
                                envelopePattern: envelopePattern
                            };

                            document.getElementById('timing-info').textContent =
                                `Inhale: ${(duration / 1000).toFixed(1)}s | Centroid: ${avg.spectralCentroid.toFixed(0)}Hz`;

                            document.getElementById('cal-breathin-dot').classList.remove('active');
                            document.getElementById('cal-breathin-dot').classList.add('complete');

                            console.log('Breathing In calibration:', State.calibration.breathingIn);
                            Speech.speak(`Good. Your inhale was ${(duration / 1000).toFixed(1)} seconds.`, resolve);
                            return;
                        }
                    }

                    if (Date.now() - startTime < maxWaitTime) {
                        setTimeout(monitor, 50);
                    } else {
                        // Timeout - use defaults
                        State.calibration.breathingIn = {
                            envelope: peakEnvelope || 0.1,
                            spectralCentroid: 250,
                            zeroCrossingRate: 0.05,
                            duration: 4000,
                            envelopePattern: []
                        };
                        document.getElementById('cal-breathin-dot').classList.remove('active');
                        document.getElementById('cal-breathin-dot').classList.add('complete');
                        Speech.speak("Using default timing. Let's continue.", resolve);
                    }
                };

                setTimeout(monitor, 500);
            });
        });
    },

    /**
     * Calibrate breathing out
     */
    calibrateBreathingOut() {
        return new Promise((resolve) => {
            document.getElementById('cal-breathout-dot').classList.add('active');
            UI.updateCalibrationProgress(4, 4);

            UI.setSpherePercent('calibration-fill', 100);

            Speech.speak("Now slowly breathe out through your mouth. Start when you're ready.", () => {
                document.getElementById('calibration-instruction').textContent =
                    "Breathe OUT slowly... (we're measuring)";

                let breathStarted = false;
                let breathStartTime = 0;
                let peakEnvelope = 0;
                const featureSamples = [];
                const envelopePattern = [];
                const startTime = Date.now();
                const maxWaitTime = 12000;

                const silenceEnv = State.calibration.silence.envelope;
                const threshold = silenceEnv * 1.5;

                const monitor = () => {
                    Audio.extractFeatures();
                    const f = State.features;

                    if (breathStarted) {
                        const elapsed = Date.now() - breathStartTime;
                        const estimatedDuration = State.calibration.breathingIn.duration || 4000;
                        const percent = Math.max(0, 100 - (elapsed / estimatedDuration) * 100);
                        UI.setSpherePercent('calibration-fill', percent);
                    }

                    if (!breathStarted && f.envelope > threshold) {
                        breathStarted = true;
                        breathStartTime = Date.now();
                    }

                    if (breathStarted) {
                        featureSamples.push({
                            envelope: f.envelope,
                            spectralCentroid: f.spectralCentroid,
                            zeroCrossingRate: f.zeroCrossingRate
                        });
                        envelopePattern.push(f.envelope);

                        if (f.envelope > peakEnvelope) {
                            peakEnvelope = f.envelope;
                        }

                        const timeSinceStart = Date.now() - breathStartTime;
                        if (f.envelope < peakEnvelope * 0.3 && timeSinceStart > 1000) {
                            const duration = Date.now() - breathStartTime;
                            const avg = Audio.averageFeatures(featureSamples);

                            State.calibration.breathingOut = {
                                ...avg,
                                duration: duration,
                                envelopePattern: envelopePattern
                            };

                            UI.setSpherePercent('calibration-fill', 0);

                            document.getElementById('timing-info').textContent =
                                `Exhale: ${(duration / 1000).toFixed(1)}s | Centroid: ${avg.spectralCentroid.toFixed(0)}Hz`;

                            document.getElementById('cal-breathout-dot').classList.remove('active');
                            document.getElementById('cal-breathout-dot').classList.add('complete');

                            console.log('Breathing Out calibration:', State.calibration.breathingOut);
                            Speech.speak(`Your exhale was ${(duration / 1000).toFixed(1)} seconds. Calibration complete.`, resolve);
                            return;
                        }
                    }

                    if (Date.now() - startTime < maxWaitTime) {
                        setTimeout(monitor, 50);
                    } else {
                        State.calibration.breathingOut = {
                            envelope: peakEnvelope || 0.1,
                            spectralCentroid: 200,
                            zeroCrossingRate: 0.05,
                            duration: 4000,
                            envelopePattern: []
                        };
                        document.getElementById('cal-breathout-dot').classList.remove('active');
                        document.getElementById('cal-breathout-dot').classList.add('complete');
                        Speech.speak("Using default timing. Calibration complete.", resolve);
                    }
                };

                setTimeout(monitor, 500);
            });
        });
    },

    /**
     * Show calibration results
     */
    showResults() {
        const measuredIn = State.calibration.breathingIn.duration / 1000;
        const measuredOut = State.calibration.breathingOut.duration / 1000;
        const targetIn = CONFIG.targetInhaleDuration / 1000;
        const targetOut = CONFIG.targetExhaleDuration / 1000;

        document.getElementById('result-inhale').textContent = `${measuredIn.toFixed(1)}s`;
        document.getElementById('result-exhale').textContent = `${measuredOut.toFixed(1)}s`;
        document.getElementById('result-target-in').textContent = `${targetIn.toFixed(1)}s`;
        document.getElementById('result-target-out').textContent = `${targetOut.toFixed(1)}s`;

        // Calculate adaptive durations
        State.currentInhaleDuration = (State.calibration.breathingIn.duration + CONFIG.targetInhaleDuration) / 2;
        State.currentExhaleDuration = (State.calibration.breathingOut.duration + CONFIG.targetExhaleDuration) / 2;

        // Generate hint
        let hint = '';
        const inDiff = targetIn - measuredIn;
        const outDiff = targetOut - measuredOut;

        if (Math.abs(inDiff) < 0.5 && Math.abs(outDiff) < 0.5) {
            hint = "Your breathing pace is close to the target. Great!";
        } else {
            const parts = [];
            if (inDiff > 0.5) {
                parts.push(`breathe in ${inDiff.toFixed(1)}s slower`);
            } else if (inDiff < -0.5) {
                parts.push(`breathe in ${Math.abs(inDiff).toFixed(1)}s faster`);
            }
            if (outDiff > 0.5) {
                parts.push(`breathe out ${outDiff.toFixed(1)}s slower`);
            } else if (outDiff < -0.5) {
                parts.push(`breathe out ${Math.abs(outDiff).toFixed(1)}s faster`);
            }
            hint = `To match the target, try to ${parts.join(' and ')}.`;
        }

        document.getElementById('adjustment-hint').textContent = hint;
        Speech.speak(hint);
    }
};
