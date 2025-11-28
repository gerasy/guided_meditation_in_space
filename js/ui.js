/**
 * UI utilities - screens, spheres, debug panel
 */
const UI = {
    /**
     * Show a specific screen
     */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    /**
     * Create starfield background
     */
    createStarfield() {
        const container = document.getElementById('stars');
        const starCount = 150;

        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.width = `${Math.random() * 3 + 1}px`;
            star.style.height = star.style.width;
            star.style.animationDelay = `${Math.random() * 3}s`;
            container.appendChild(star);
        }
    },

    /**
     * Set sphere fill percentage
     */
    setSpherePercent(fillId, percent) {
        const fill = document.getElementById(fillId);
        if (!fill) return;

        percent = Math.max(0, Math.min(100, percent));
        fill.style.height = `${percent}%`;
        fill.style.borderRadius = percent > 90 ? '90px' : '0 0 90px 90px';
    },

    /**
     * Animate sphere from one percentage to another
     */
    animateSphere(fillId, fromPercent, toPercent, duration, callback) {
        const fill = document.getElementById(fillId);
        if (!fill) return;

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease in-out
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const currentPercent = fromPercent + (toPercent - fromPercent) * eased;
            this.setSpherePercent(fillId, currentPercent);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };

        animate();
    },

    /**
     * Start user sphere animation
     */
    startUserSphereAnimation(fromPercent, toPercent, duration) {
        State.userSpherePercent = fromPercent;
        State.userSphereTarget = toPercent;
        State.userAnimationStart = Date.now();
        State.userAnimationDuration = duration;
    },

    /**
     * Update user sphere based on animation state
     */
    updateUserSphereFromBreathing() {
        const elapsed = Date.now() - State.userAnimationStart;
        const progress = Math.min(elapsed / State.userAnimationDuration, 1);

        // Ease in-out
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentPercent = State.userSpherePercent +
            (State.userSphereTarget - State.userSpherePercent) * eased;

        this.setSpherePercent('user-fill', currentPercent);

        return progress;
    },

    /**
     * Update audio level display
     */
    updateAudioLevel() {
        const fill = document.getElementById('audio-level-fill');
        if (fill) {
            const displayValue = State.features.breathScore * 100;
            fill.style.width = `${Math.min(displayValue, 100)}%`;

            // Color based on confidence
            if (State.features.breathScore > 0.6) {
                fill.style.background = 'linear-gradient(90deg, #4f8, #8f4)';
            } else if (State.features.breathScore > 0.3) {
                fill.style.background = 'linear-gradient(90deg, #ff8, #fa4)';
            } else {
                fill.style.background = 'linear-gradient(90deg, #888, #666)';
            }
        }

        this.updateDebugPanel();
    },

    /**
     * Update debug panel
     */
    updateDebugPanel() {
        const panel = document.getElementById('debug-panel');
        if (!panel || panel.style.display === 'none') return;

        const f = State.features;

        document.getElementById('debug-envelope').textContent = f.envelope.toFixed(3);
        document.getElementById('debug-envelope-bar').style.width = `${Math.min(f.envelope * 500, 100)}%`;

        const slopeEl = document.getElementById('debug-slope');
        slopeEl.textContent = f.envelopeSlope.toFixed(4);
        slopeEl.className = 'debug-value' + (Math.abs(f.envelopeSlope) > 0.005 ? ' warning' : '');

        document.getElementById('debug-centroid').textContent = `${f.spectralCentroid.toFixed(0)} Hz`;
        document.getElementById('debug-zcr').textContent = f.zeroCrossingRate.toFixed(3);

        const scoreEl = document.getElementById('debug-breath-score');
        scoreEl.textContent = `${(f.breathScore * 100).toFixed(0)}%`;
        scoreEl.className = 'debug-value' + (f.breathScore > 0.5 ? ' good' : '');
        document.getElementById('debug-score-bar').style.width = `${f.breathScore * 100}%`;

        document.getElementById('debug-phase').textContent = State.breathPhase;

        const talkingEl = document.getElementById('debug-talking');
        const talking = Audio.isTalkingDetected();
        talkingEl.textContent = talking ? 'YES' : 'No';
        talkingEl.className = 'debug-value' + (talking ? ' warning' : ' good');
    },

    /**
     * Toggle debug panel
     */
    toggleDebugPanel() {
        const panel = document.getElementById('debug-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    },

    /**
     * Update calibration progress
     */
    updateCalibrationProgress(step, total) {
        const progress = (step / total) * 100;
        document.getElementById('calibration-progress').style.width = `${progress}%`;
        document.getElementById('calibration-progress-text').textContent = `Step ${step} of ${total}`;
    },

    /**
     * Update feedback message
     */
    updateFeedback(score) {
        const feedback = document.getElementById('feedback');
        if (score > 80) {
            feedback.textContent = 'Excellent! Keep it up!';
            feedback.style.color = '#8f8';
        } else if (score > 60) {
            feedback.textContent = 'Good rhythm!';
            feedback.style.color = '#afc';
        } else if (score > 40) {
            feedback.textContent = 'Try to match the guide';
            feedback.style.color = '#ffa';
        } else {
            feedback.textContent = 'Follow the blue sphere';
            feedback.style.color = '#faa';
        }
    }
};
