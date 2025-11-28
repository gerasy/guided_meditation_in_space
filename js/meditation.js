/**
 * Meditation session management
 */
const Meditation = {
    /**
     * Start meditation session
     */
    async start() {
        State.resetSession();
        State.meditationStartTime = Date.now();

        UI.setSpherePercent('user-fill', 0);
        UI.setSpherePercent('guide-fill', 0);

        UI.showScreen('meditation-screen');
        document.getElementById('talking-warning').textContent = '';

        Speech.speak("Let's begin. Find a comfortable position and relax.", () => {
            setTimeout(() => this.runRound(), 2000);
        });
    },

    /**
     * Run a single breathing round
     */
    async runRound() {
        State.currentRound++;

        if (State.currentRound > CONFIG.totalRounds) {
            this.end();
            return;
        }

        document.getElementById('round-counter').textContent =
            `Round ${State.currentRound} of ${CONFIG.totalRounds}`;
        document.getElementById('talking-warning').textContent = '';

        // Breathe In
        await this.breatheIn();

        // Hold
        await this.hold();

        // Breathe Out
        await this.breatheOut();

        // Hold
        await this.hold();

        State.totalBreaths++;

        // Adapt timing towards target
        State.currentInhaleDuration = State.currentInhaleDuration +
            (CONFIG.targetInhaleDuration - State.currentInhaleDuration) * CONFIG.adaptationRate;
        State.currentExhaleDuration = State.currentExhaleDuration +
            (CONFIG.targetExhaleDuration - State.currentExhaleDuration) * CONFIG.adaptationRate;

        // Next round
        setTimeout(() => this.runRound(), 500);
    },

    /**
     * Breathe in phase
     */
    breatheIn() {
        return new Promise((resolve) => {
            State.currentPhase = 'in';
            document.getElementById('breathing-phase').textContent = 'Breathe In...';

            Speech.speak("Breathe in");

            const duration = CONFIG.targetInhaleDuration;
            const userDuration = State.currentInhaleDuration;

            UI.animateSphere('guide-fill', 0, 100, duration);
            UI.startUserSphereAnimation(0, 100, userDuration);

            const syncSamples = [];
            const startTime = Date.now();
            let talkingDetectedThisPhase = false;

            const countdownInterval = setInterval(() => {
                const remaining = Math.ceil((duration - (Date.now() - startTime)) / 1000);
                document.getElementById('meditation-timer').textContent = Math.max(0, remaining);
            }, 100);

            const monitor = () => {
                if (Date.now() - startTime < duration) {
                    Audio.extractFeatures();

                    if (Audio.isTalkingDetected()) {
                        document.getElementById('talking-warning').textContent =
                            'Talking detected - please concentrate on breathing';
                        talkingDetectedThisPhase = true;
                    } else if (!talkingDetectedThisPhase) {
                        document.getElementById('talking-warning').textContent = '';
                    }

                    const userProgress = UI.updateUserSphereFromBreathing();
                    const guideProgress = (Date.now() - startTime) / duration;
                    syncSamples.push(Math.abs(userProgress - guideProgress));

                    setTimeout(monitor, 50);
                } else {
                    clearInterval(countdownInterval);
                    UI.setSpherePercent('user-fill', 100);

                    const avgDiff = syncSamples.reduce((a, b) => a + b, 0) / syncSamples.length;
                    const syncScore = Math.max(0, 100 - avgDiff * 200);
                    State.syncScores.push(syncScore);

                    UI.updateFeedback(syncScore);
                    resolve();
                }
            };

            monitor();
        });
    },

    /**
     * Breathe out phase
     */
    breatheOut() {
        return new Promise((resolve) => {
            State.currentPhase = 'out';
            document.getElementById('breathing-phase').textContent = 'Breathe Out...';

            Speech.speak("Breathe out");

            const duration = CONFIG.targetExhaleDuration;
            const userDuration = State.currentExhaleDuration;

            UI.animateSphere('guide-fill', 100, 0, duration);
            UI.startUserSphereAnimation(100, 0, userDuration);

            const syncSamples = [];
            const startTime = Date.now();
            let talkingDetectedThisPhase = false;

            const countdownInterval = setInterval(() => {
                const remaining = Math.ceil((duration - (Date.now() - startTime)) / 1000);
                document.getElementById('meditation-timer').textContent = Math.max(0, remaining);
            }, 100);

            const monitor = () => {
                if (Date.now() - startTime < duration) {
                    Audio.extractFeatures();

                    if (Audio.isTalkingDetected()) {
                        document.getElementById('talking-warning').textContent =
                            'Talking detected - please concentrate on breathing';
                        talkingDetectedThisPhase = true;
                    } else if (!talkingDetectedThisPhase) {
                        document.getElementById('talking-warning').textContent = '';
                    }

                    UI.updateUserSphereFromBreathing();

                    const userProgress = (Date.now() - State.userAnimationStart) / State.userAnimationDuration;
                    const guideProgress = (Date.now() - startTime) / duration;
                    syncSamples.push(Math.abs(userProgress - guideProgress));

                    setTimeout(monitor, 50);
                } else {
                    clearInterval(countdownInterval);
                    UI.setSpherePercent('user-fill', 0);

                    const avgDiff = syncSamples.reduce((a, b) => a + b, 0) / syncSamples.length;
                    const syncScore = Math.max(0, 100 - avgDiff * 200);
                    State.syncScores.push(syncScore);

                    UI.updateFeedback(syncScore);
                    resolve();
                }
            };

            monitor();
        });
    },

    /**
     * Hold phase
     */
    hold() {
        return new Promise((resolve) => {
            State.currentPhase = 'hold';
            document.getElementById('breathing-phase').textContent = 'Hold...';
            document.getElementById('meditation-timer').textContent = '...';
            document.getElementById('talking-warning').textContent = '';
            setTimeout(resolve, CONFIG.holdDuration);
        });
    },

    /**
     * End meditation session
     */
    end() {
        const duration = Math.floor((Date.now() - State.meditationStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        const avgSync = State.syncScores.length > 0
            ? Math.round(State.syncScores.reduce((a, b) => a + b, 0) / State.syncScores.length)
            : 0;

        document.getElementById('stat-rounds').textContent = State.currentRound - 1;
        document.getElementById('stat-duration').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('stat-sync').textContent = `${avgSync}%`;
        document.getElementById('stat-breaths').textContent = State.totalBreaths;

        Speech.speak("Wonderful. You've completed your meditation session. Take a moment to notice how you feel.");

        UI.showScreen('completion-screen');
    },

    /**
     * Force end meditation
     */
    forceEnd() {
        State.currentRound = CONFIG.totalRounds + 1;
        this.end();
    }
};
