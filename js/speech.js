/**
 * Text-to-speech with visual fallback for mobile
 */
const Speech = {
    voicesLoaded: false,

    /**
     * Initialize speech synthesis
     */
    init() {
        if ('speechSynthesis' in window) {
            this.loadVoices();
            window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
    },

    /**
     * Load available voices
     */
    loadVoices() {
        if ('speechSynthesis' in window) {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                this.voicesLoaded = true;
                console.log('Loaded', voices.length, 'voices');
            }
        }
    },

    /**
     * Speak text with callback
     * Falls back gracefully if TTS fails (common on mobile)
     */
    speak(text, callback) {
        // Update visual instruction as fallback
        this.updateVisualInstruction(text);

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.85;
            utterance.pitch = 1;
            utterance.volume = 0.8;

            // Find a suitable voice
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v =>
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Daniel') ||
                v.lang.startsWith('en')
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            // Safe callback handling
            let callbackCalled = false;
            const safeCallback = () => {
                if (!callbackCalled && callback) {
                    callbackCalled = true;
                    callback();
                }
            };

            utterance.onend = safeCallback;
            utterance.onerror = (e) => {
                console.warn('Speech error:', e);
                safeCallback();
            };

            // Fallback timeout for mobile
            const estimatedDuration = Math.max(2000, text.length * 80);
            setTimeout(safeCallback, estimatedDuration);

            try {
                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.warn('Speech failed:', e);
                safeCallback();
            }
        } else {
            console.log('TTS not available:', text);
            if (callback) {
                setTimeout(callback, Math.max(1500, text.length * 60));
            }
        }
    },

    /**
     * Update visual instruction display as TTS fallback
     */
    updateVisualInstruction(text) {
        const instructionEl = document.getElementById('calibration-instruction');
        const phaseEl = document.getElementById('breathing-phase');

        // Only update if we're on the right screen and it's a short instruction
        if (text.length < 50) {
            if (instructionEl && document.getElementById('calibration-screen').classList.contains('active')) {
                // Don't override detailed calibration instructions
            }
            if (phaseEl && document.getElementById('meditation-screen').classList.contains('active')) {
                // Meditation phase updates are handled separately
            }
        }
    }
};
