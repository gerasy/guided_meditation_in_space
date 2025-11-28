/**
 * Main application - initialization and event handlers
 */
const App = {
    /**
     * Initialize the application
     */
    init() {
        // Create starfield
        UI.createStarfield();

        // Initialize speech
        Speech.init();

        // Setup event listeners
        this.setupEventListeners();

        console.log('Meditation app initialized');
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            // Preload voices on user interaction (mobile)
            if ('speechSynthesis' in window) {
                window.speechSynthesis.getVoices();
            }
            UI.showScreen('permission-screen');
        });

        // Permission button
        document.getElementById('permission-btn').addEventListener('click', async () => {
            const btn = document.getElementById('permission-btn');
            btn.disabled = true;
            btn.textContent = 'Requesting access...';

            try {
                const success = await Audio.init();

                if (success) {
                    await Audio.ensureRunning();
                    UI.showScreen('calibration-screen');
                    setTimeout(() => Calibration.run(), 1500);
                } else {
                    throw new Error('Audio init failed');
                }
            } catch (error) {
                console.error('Permission error:', error);
                document.getElementById('permission-error').style.display = 'block';
                document.getElementById('permission-error').textContent =
                    'Could not access microphone. Please allow microphone access and try again.';
                btn.disabled = false;
                btn.textContent = 'Try Again';
            }
        });

        // Begin meditation button
        document.getElementById('begin-meditation-btn').addEventListener('click', async () => {
            await Audio.ensureRunning();
            Meditation.start();
        });

        // Stop meditation button
        document.getElementById('stop-meditation-btn').addEventListener('click', () => {
            Meditation.forceEnd();
        });

        // Restart button
        document.getElementById('restart-btn').addEventListener('click', async () => {
            await Audio.ensureRunning();
            // Reset adaptive timing
            State.currentInhaleDuration = (State.calibration.breathingIn.duration + CONFIG.targetInhaleDuration) / 2;
            State.currentExhaleDuration = (State.calibration.breathingOut.duration + CONFIG.targetExhaleDuration) / 2;
            UI.showScreen('ready-screen');
        });

        // Debug panel toggle (D key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                UI.toggleDebugPanel();
            }
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
