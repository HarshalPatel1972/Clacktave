// Chord Synth — Web Audio API chord synthesis for keystroke sub-layer

const CHORD_INTERVALS: Record<string, number[]> = {
  'I':  [0, 4, 7],    // Major
  'IV': [5, 9, 12],
  'V':  [7, 11, 14],
  'vi': [9, 12, 16],  // Minor
};

const PROGRESSION = ['I', 'V', 'vi', 'IV']; // The world's most popular progression
const ROOT_FREQ = 261.63; // C4

export class ChordSynth {
  private ctx: AudioContext | null = null;
  private step: number = 0;
  private noteIndex: number = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playNote() {
    if (!this.ctx) this.init();
    const ctx = this.ctx!;

    // Current chord in progression
    const chordName = PROGRESSION[Math.floor(this.step / 8) % PROGRESSION.length];
    const intervals = CHORD_INTERVALS[chordName];

    // Pick one note from the chord (cycles through root, third, fifth)
    const semitone = intervals[this.noteIndex % intervals.length];
    const freq = ROOT_FREQ * Math.pow(2, semitone / 12);

    // Triangle wave — softer than sine, warmer than square
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // ADSR: attack 0ms, sustain 80ms, release 300ms
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    this.noteIndex++;
    this.step++;
  }

  destroy() {
    this.ctx?.close();
    this.ctx = null;
  }
}
