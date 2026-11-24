/**
 * Shared SensorSource pieces usable from both the native stub (sensorSource.ts) and the web stub
 * (sensorSource.web.ts). Kept in a file with a *different* basename than either, since a relative
 * import of './sensorSource' from inside sensorSource.web.ts would resolve back to
 * sensorSource.web.ts itself under Metro's platform-extension resolution (infinite self-import).
 */

export type SensorSide = 'left' | 'right';
export type SensorStatus = 'connected' | 'disconnected' | 'unavailable';

export type SampleListener = (side: SensorSide, value: number, timestampMs: number) => void;
export type StatusListener = (status: SensorStatus) => void;

export interface SensorSource {
  readonly label: string;
  connect(onSample: SampleListener, onStatus?: StatusListener): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * The only source wired into the UI today: two independently-drifting simulated baselines so
 * left/right plausibly diverge session to session. Carried over in spirit from the old
 * CareTech-Web sensors.js adapter, re-typed for RN.
 */
export class SimulatedSource implements SensorSource {
  readonly label = 'Simulated braces';

  private timer: ReturnType<typeof setInterval> | null = null;
  private onSample: SampleListener | null = null;
  private t0 = 0;
  private baseLeft = 1180 + Math.random() * 80;
  private baseRight = 1180 + Math.random() * 80;

  async connect(onSample: SampleListener, onStatus?: StatusListener): Promise<void> {
    this.onSample = onSample;
    this.t0 = Date.now();
    onStatus?.('connected');
    this.timer = setInterval(() => this.tick(), 250);
  }

  private tick(): void {
    const tSec = (Date.now() - this.t0) / 1000;
    const now = Date.now();
    const left = this.baseLeft + 35 * Math.sin(tSec * 1.8) + (Math.random() - 0.5) * 18;
    const right = this.baseRight + 35 * Math.sin(tSec * 1.8 + 0.4) + (Math.random() - 0.5) * 18;
    this.onSample?.('left', Math.round(left), now);
    this.onSample?.('right', Math.round(right), now);
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onSample = null;
  }
}

export function createSimulatedSource(): SensorSource {
  return new SimulatedSource();
}
