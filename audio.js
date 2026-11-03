// Columns 1997 - Web Audio Synthesizer
class ColumnsAudio {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.musicPlaying = false;
        this.musicInterval = null;
        this.masterVolume = null;
        this.musicVolume = null;
        this.sfxVolume = null;
        
        // Synthwave music state
        this.musicStep = 0;
        this.musicTempo = 110; // BPM
    }

    init() {
        if (this.ctx) return;
        
        // Initialize AudioContext on first user interaction
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Setup volume nodes
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.masterVolume.connect(this.ctx.destination);

        this.musicVolume = this.ctx.createGain();
        this.musicVolume.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.musicVolume.connect(this.masterVolume);

        this.sfxVolume = this.ctx.createGain();
        this.sfxVolume.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.sfxVolume.connect(this.masterVolume);
    }

    resumeContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterVolume) {
            this.masterVolume.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx ? this.ctx.currentTime : 0);
        }
        return this.muted;
    }

    playMove() {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxVolume);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playCycle() {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxVolume);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playDrop() {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxVolume);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playMatch(combo = 1) {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major scale notes
        const offset = (combo - 1) % notes.length;
        
        // Play an ascending arpeggio based on combo level
        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxVolume);

            osc.type = 'sine';
            const noteFreq = notes[(offset + i) % notes.length] * (1 + Math.floor((offset + i) / notes.length) * 0.5);
            osc.frequency.setValueAtTime(noteFreq, now + i * 0.08);

            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.2, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);

            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.35);
        }
    }

    playStartChime() {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending C major arpeggio
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxVolume);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, now + idx * 0.06);
            filter.frequency.exponentialRampToValueAtTime(300, now + idx * 0.06 + 0.4);

            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.2, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45);

            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.5);
        });
    }

    playGameOver() {
        this.init();
        this.resumeContext();
        if (this.muted) return;

        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(55, now + 1.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 1.5);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc.start(now);
        osc.stop(now + 1.6);
    }

    toggleMusic() {
        this.init();
        this.resumeContext();
        
        if (this.musicPlaying) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return this.musicPlaying;
    }

    startMusic() {
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.musicStep = 0;

        const stepDuration = 60 / this.musicTempo / 2; // Eighth notes
        
        // Synthwave simple bass/melody progression
        const bassProgression = [
            [55.00, 55.00, 55.00, 55.00], // A1
            [48.99, 48.99, 48.99, 48.99], // G1
            [43.65, 43.65, 43.65, 43.65], // F1
            [51.91, 51.91, 51.91, 51.91]  // G#1 / G1 variation
        ];

        const melodyProgression = [
            [220.00, 261.63, 329.63, 261.63], // A3, C4, E4, C4
            [196.00, 246.94, 293.66, 246.94], // G3, B3, D4, B3
            [174.61, 220.00, 261.63, 220.00], // F3, A3, C4, A3
            [196.00, 246.94, 329.63, 392.00]  // G3, B3, E4, G4
        ];

        const playMusicStep = () => {
            if (!this.musicPlaying || this.muted) return;
            const now = this.ctx.currentTime;
            
            const chordIndex = Math.floor(this.musicStep / 8) % bassProgression.length;
            const stepInChord = this.musicStep % 8;
            
            // Bass line - playing steady eighths
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bassOsc.connect(bassGain);
            bassGain.connect(this.musicVolume);
            
            bassOsc.type = 'triangle';
            const bassNote = bassProgression[chordIndex][Math.floor(stepInChord / 2) % 4];
            bassOsc.frequency.setValueAtTime(bassNote, now);
            
            // Plucky bass envelope
            bassGain.gain.setValueAtTime(0.12, now);
            bassGain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.9);
            
            bassOsc.start(now);
            bassOsc.stop(now + stepDuration);

            // Melody synth on selective beats (e.g. beats 0, 3, 5)
            if (stepInChord === 0 || stepInChord === 3 || stepInChord === 5) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                const leadFilter = this.ctx.createBiquadFilter();
                
                leadOsc.connect(leadFilter);
                leadFilter.connect(leadGain);
                leadGain.connect(this.musicVolume);

                leadOsc.type = 'sawtooth';
                const leadNote = melodyProgression[chordIndex][Math.floor(stepInChord / 2) % 4] * 2; // octave up
                leadOsc.frequency.setValueAtTime(leadNote, now);

                leadFilter.type = 'lowpass';
                leadFilter.frequency.setValueAtTime(800, now);
                leadFilter.frequency.exponentialRampToValueAtTime(200, now + stepDuration * 1.5);

                leadGain.gain.setValueAtTime(0.04, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);

                leadOsc.start(now);
                leadOsc.stop(now + stepDuration * 2);
            }

            // High hat synth on off beats (steps 2, 4, 6)
            if (stepInChord % 2 === 1) {
                const bufferSize = this.ctx.sampleRate * 0.04;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const noiseFilter = this.ctx.createBiquadFilter();
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.setValueAtTime(7000, now);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.015, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.musicVolume);

                noise.start(now);
                noise.stop(now + 0.05);
            }

            this.musicStep++;
        };

        // Start scheduler
        const lookAhead = 25.0; // ms
        const scheduleAheadTime = 0.1; // sec
        let nextNoteTime = this.ctx.currentTime;

        const scheduler = () => {
            while (nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
                // Play note
                const oldCurrentTime = this.ctx.currentTime;
                // Simulating playMusicStep bound to exact timing
                playMusicStep();
                nextNoteTime += stepDuration;
            }
            if (this.musicPlaying) {
                this.musicInterval = setTimeout(scheduler, lookAhead);
            }
        };

        scheduler();
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.musicInterval) {
            clearTimeout(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

window.gameAudio = new ColumnsAudio();
