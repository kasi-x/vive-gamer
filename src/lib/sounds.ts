// Web Audio API効果音マネージャー（外部ファイル不要）

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private play(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playChord(freqs: number[], duration: number, type: OscillatorType = "sine", volume = 0.1) {
    freqs.forEach((f) => this.play(f, duration, type, volume));
  }

  correct() {
    this.play(523, 0.1, "sine", 0.12);
    setTimeout(() => this.play(659, 0.1, "sine", 0.12), 80);
    setTimeout(() => this.play(784, 0.15, "sine", 0.15), 160);
  }

  firstGuess() {
    this.play(784, 0.08, "sine", 0.15);
    setTimeout(() => this.play(988, 0.08, "sine", 0.15), 60);
    setTimeout(() => this.play(1175, 0.08, "sine", 0.15), 120);
    setTimeout(() => this.play(1318, 0.2, "sine", 0.18), 180);
  }

  wrong() {
    this.play(200, 0.15, "square", 0.08);
  }

  aiCorrect() {
    this.play(400, 0.2, "sawtooth", 0.08);
    setTimeout(() => this.play(300, 0.3, "sawtooth", 0.06), 150);
  }

  timerTick() {
    this.play(880, 0.05, "sine", 0.06);
  }

  roundStart() {
    this.playChord([523, 659, 784], 0.3, "sine", 0.08);
  }

  gameEnd() {
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      setTimeout(() => this.play(f, 0.2, "sine", 0.12), i * 150);
    });
  }

  combo() {
    this.play(1047, 0.1, "sine", 0.1);
    setTimeout(() => this.play(1175, 0.15, "sine", 0.12), 80);
  }

  inkDepleted() {
    this.play(150, 0.4, "sawtooth", 0.1);
  }

  splatHit() {
    // 低音ドスッ + ノイズ風
    this.play(120, 0.15, "square", 0.12);
    setTimeout(() => this.play(80, 0.2, "sawtooth", 0.08), 50);
  }

  vsIntro() {
    // 対戦開始の迫力ある和音
    this.playChord([261, 329, 392], 0.15, "square", 0.08);
    setTimeout(() => this.playChord([349, 440, 523], 0.3, "square", 0.1), 150);
  }

  buzzIn() {
    // ブザー音（早押し正解時）
    this.play(880, 0.05, "sine", 0.15);
    setTimeout(() => this.play(1175, 0.12, "sine", 0.18), 60);
  }
}

export const soundManager = typeof window !== "undefined" ? new SoundManager() : null!;
