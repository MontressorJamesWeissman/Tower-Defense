// Bastion Protocol — procedural audio engine built on Tone.js.
//
// No audio files: every sound is synthesised. SFX route through an sfx bus,
// music through a music bus, both under a master gain mapped to user settings.
// All Tone calls are guarded so a suspended/again-unavailable context never
// crashes gameplay.

import * as Tone from "tone";
import { settings, onSettingsChange } from "../state/settings";
import { Charge } from "../logic/elements";
import {
  SHOTS,
  IMPACT_NOTE,
  REACTION_CHORDS,
  CUES,
  FANFARES,
  MUSIC,
  CueDef,
  Voice,
  MusicTrackDef,
} from "./audioConfig";

export type MusicName = "menu" | "setup" | "assault";

/** One procedurally-sequenced music loop, with its own gain for crossfading. */
class MusicTrack {
  readonly gain: Tone.Gain;
  private readonly pad: Tone.PolySynth;
  private readonly arp: Tone.Synth;
  private readonly kick?: Tone.MembraneSynth;
  private readonly loops: Tone.Loop[] = [];
  private padIdx = 0;
  private arpIdx = 0;

  constructor(musicBus: Tone.Gain, def: MusicTrackDef) {
    this.gain = new Tone.Gain(0).connect(musicBus);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.5, decay: 1, sustain: 0.7, release: 3 },
      volume: -16,
    }).connect(this.gain);
    this.arp = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.08, release: 0.3 },
      volume: -14,
    }).connect(this.gain);

    const padLoop = new Tone.Loop((time) => {
      const chord = def.pad[this.padIdx % def.pad.length];
      this.padIdx++;
      try {
        this.pad.triggerAttackRelease(chord, "1m", time);
      } catch {
        /* timing */
      }
    }, "1m");

    const arpLoop = new Tone.Loop((time) => {
      const n = def.arp[this.arpIdx % def.arp.length];
      this.arpIdx++;
      try {
        this.arp.triggerAttackRelease(n, def.arpSubdivision, time);
      } catch {
        /* timing */
      }
    }, def.arpSubdivision);

    this.loops.push(padLoop, arpLoop);

    if (def.kick) {
      this.kick = new Tone.MembraneSynth({ volume: -8 }).connect(this.gain);
      const k = this.kick;
      this.loops.push(
        new Tone.Loop((time) => {
          try {
            k.triggerAttackRelease("C1", "8n", time);
          } catch {
            /* timing */
          }
        }, "4n"),
      );
    }

    for (const l of this.loops) l.start(0);
  }

  fade(to: number, seconds: number): void {
    this.gain.gain.rampTo(to, seconds);
  }

  dispose(): void {
    for (const l of this.loops) l.dispose();
    this.pad.dispose();
    this.arp.dispose();
    this.kick?.dispose();
    this.gain.dispose();
  }
}

class AudioManagerImpl {
  private started = false;
  private master!: Tone.Gain;
  private sfxBus!: Tone.Gain;
  private musicBus!: Tone.Gain;

  // SFX instruments, one per voice.
  private fm!: Tone.PolySynth;
  private bell!: Tone.PolySynth;
  private pluck!: Tone.PluckSynth;
  private metal!: Tone.MetalSynth;
  private membrane!: Tone.MembraneSynth;
  private noise!: Tone.NoiseSynth;
  private click!: Tone.Synth;

  private readonly lastTime: Partial<Record<Voice, number>> = {};

  private currentMusic: MusicName | null = null;
  private pendingMusic: MusicName | null = null;
  private readonly tracks: Partial<Record<MusicName, MusicTrack>> = {};

  // File-based audio (populated by the loader). Empty until the user supplies
  // real audio files; everything falls back to the synth engine below.
  private audioFiles: Record<string, string> = {};
  private readonly fileTracks: Partial<Record<MusicName, { gain: Tone.Gain; player: Tone.Player }>> = {};
  private readonly sfxPlayers = new Map<string, Tone.Player>();

  /** Called by the loader with a map of available audio key -> full URL. */
  setAudioFiles(map: Record<string, string>): void {
    this.audioFiles = map;
  }

  /** Resume the AudioContext (must be called from a user gesture) and build the graph. */
  async unlock(): Promise<void> {
    if (this.started) return;
    try {
      await Tone.start();
      this.build();
      this.started = true;
      this.applyVolumes();
      onSettingsChange(() => this.applyVolumes());
      if (this.pendingMusic) {
        const m = this.pendingMusic;
        this.pendingMusic = null;
        this.startMusic(m);
      }
    } catch {
      /* audio unavailable — game stays silent */
    }
  }

  private build(): void {
    this.master = new Tone.Gain(settings.master).toDestination();
    this.sfxBus = new Tone.Gain(settings.sfx).connect(this.master);
    this.musicBus = new Tone.Gain(settings.music).connect(this.master);

    this.fm = new Tone.PolySynth(Tone.FMSynth, { volume: -10 }).connect(this.sfxBus);
    this.bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 14,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 },
      volume: -14,
    }).connect(this.sfxBus);
    this.pluck = new Tone.PluckSynth({ volume: -6 }).connect(this.sfxBus);
    this.metal = new Tone.MetalSynth({ volume: -24 }).connect(this.sfxBus);
    this.membrane = new Tone.MembraneSynth({ volume: -10 }).connect(this.sfxBus);
    const noiseFilter = new Tone.Filter(900, "lowpass").connect(this.sfxBus);
    this.noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.3 },
      volume: -16,
    }).connect(noiseFilter);
    this.click = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 },
      volume: -18,
    }).connect(this.sfxBus);
  }

  private applyVolumes(): void {
    if (!this.started) return;
    this.master.gain.rampTo(settings.master, 0.05);
    this.sfxBus.gain.rampTo(settings.sfx, 0.05);
    this.musicBus.gain.rampTo(settings.music, 0.05);
  }

  /** Monotonically-increasing time for a voice so mono synths never double-trigger. */
  private timeFor(voice: Voice): number {
    const now = Tone.now();
    const next = Math.max(now, (this.lastTime[voice] ?? 0) + 0.002);
    this.lastTime[voice] = next;
    return next;
  }

  private trigger(def: CueDef): void {
    if (!this.started) return;
    const t = this.timeFor(def.voice);
    const vel = def.velocity ?? 0.5;
    try {
      switch (def.voice) {
        case "fm":
          this.fm.triggerAttackRelease(def.note ?? "C4", def.duration, t, vel);
          break;
        case "bell":
          this.bell.triggerAttackRelease(def.note ?? "C5", def.duration, t, vel);
          break;
        case "pluck":
          this.pluck.triggerAttackRelease(def.note ?? "C4", def.duration, t);
          break;
        case "metal":
          this.metal.triggerAttackRelease(def.note ?? "C5", def.duration, t, vel);
          break;
        case "membrane":
          this.membrane.triggerAttackRelease(def.note ?? "C2", def.duration, t, vel);
          break;
        case "noise":
          this.noise.triggerAttackRelease(def.duration, t, vel);
          break;
        case "click":
          this.click.triggerAttackRelease(def.note ?? "C5", def.duration, t, vel);
          break;
      }
    } catch {
      /* swallow timing errors from rapid retriggers */
    }
  }

  /** Lazily create/cache a Tone.Player for an available SFX file key. */
  private sfxPlayer(key: string): Tone.Player | null {
    const url = this.audioFiles[key];
    if (!url) return null;
    let p = this.sfxPlayers.get(key);
    if (!p) {
      p = new Tone.Player(url).connect(this.sfxBus);
      this.sfxPlayers.set(key, p);
    }
    return p;
  }

  /** Play a file-based SFX if supplied; otherwise the synthesized fallback cue. */
  private sfxFileOrCue(key: string, cue: () => void): void {
    if (!this.started) return;
    const p = this.sfxPlayer(key);
    if (p && p.loaded) {
      try {
        p.start();
        return;
      } catch {
        /* fall through to synth */
      }
    }
    cue();
  }

  // --- Public cue API --------------------------------------------------------

  playShot(charge: Charge): void {
    this.sfxFileOrCue(`audio.sfx.shot.${charge.toLowerCase()}`, () => this.trigger(SHOTS[charge]));
  }

  playImpact(charge: Charge): void {
    this.sfxFileOrCue("audio.sfx.impact", () =>
      this.trigger({ voice: "membrane", note: IMPACT_NOTE[charge], duration: "16n", velocity: 0.45 }),
    );
  }

  playReaction(reactionKind: string): void {
    if (!this.started) return;
    this.sfxFileOrCue("audio.sfx.reaction", () => {
      const chord = REACTION_CHORDS[reactionKind] ?? REACTION_CHORDS.ChargeSwap;
      const t = this.timeFor("bell");
      try {
        this.bell.triggerAttackRelease(chord, "8n", t, 0.5);
      } catch {
        /* timing */
      }
    });
  }

  playDeath(): void {
    this.sfxFileOrCue("audio.sfx.death", () => this.trigger(CUES.death));
  }
  playCoreDamage(): void {
    this.sfxFileOrCue("audio.sfx.core", () => this.trigger(CUES.coreDamage));
  }
  playAbility(): void {
    this.sfxFileOrCue("audio.sfx.ability", () => this.trigger(CUES.ability));
  }

  playUI(kind: "hover" | "click" | "confirm" | "denied"): void {
    switch (kind) {
      case "hover":
        this.sfxFileOrCue("audio.sfx.ui.hover", () => this.trigger(CUES.uiHover));
        break;
      case "click":
        this.sfxFileOrCue("audio.sfx.ui.click", () => this.trigger(CUES.uiClick));
        break;
      case "confirm":
        this.trigger(CUES.uiConfirm);
        break;
      case "denied":
        this.trigger(CUES.uiDenied);
        break;
    }
  }

  playFanfare(kind: "start" | "clear"): void {
    if (!this.started) return;
    const notes = FANFARES[kind];
    const base = Tone.now();
    notes.forEach((n, i) => {
      try {
        this.bell.triggerAttackRelease(n, "16n", base + i * 0.09, 0.5);
      } catch {
        /* timing */
      }
    });
  }

  // --- Music -----------------------------------------------------------------

  startMusic(name: MusicName): void {
    if (!this.started) {
      this.pendingMusic = name;
      return;
    }
    if (this.currentMusic === name) return;
    const prev = this.currentMusic;

    const fileUrl = this.audioFiles[`audio.music.${name}`];
    if (fileUrl) {
      this.startFileMusic(name, fileUrl);
    } else {
      this.startSynthMusic(name);
    }

    if (prev) this.fadeOutMusic(prev);
    this.currentMusic = name;
  }

  private startSynthMusic(name: MusicName): void {
    const def = MUSIC[name];
    let track = this.tracks[name];
    if (!track) {
      track = new MusicTrack(this.musicBus, def);
      this.tracks[name] = track;
    }
    const transport = Tone.getTransport();
    transport.bpm.rampTo(def.bpm, 1.0);
    if (transport.state !== "started") transport.start();
    track.fade(1, 1.2);
  }

  private startFileMusic(name: MusicName, url: string): void {
    let ft = this.fileTracks[name];
    if (!ft) {
      const gain = new Tone.Gain(0).connect(this.musicBus);
      const player = new Tone.Player({ url, loop: true });
      player.connect(gain);
      ft = { gain, player };
      this.fileTracks[name] = ft;
    }
    const start = () => {
      try {
        if (ft!.player.state !== "started") ft!.player.start();
      } catch {
        /* not ready */
      }
    };
    if (ft.player.loaded) start();
    else ft.player.load(url).then(start).catch(() => undefined);
    ft.gain.gain.rampTo(1, 1.2);
  }

  private fadeOutMusic(name: MusicName): void {
    this.tracks[name]?.fade(0, 1.2);
    this.fileTracks[name]?.gain.gain.rampTo(0, 1.2);
  }

  stopMusic(): void {
    if (!this.started) {
      this.pendingMusic = null;
      return;
    }
    for (const t of Object.values(this.tracks)) t?.fade(0, 0.8);
    for (const f of Object.values(this.fileTracks)) f?.gain.gain.rampTo(0, 0.8);
    this.currentMusic = null;
  }
}

export const audio = new AudioManagerImpl();
