export interface AudioTrack {
  id: string;
  file: File;
  name: string;
  duration: number; // in seconds
}

export type SpectrumStyle = 'none' | 'bar' | 'mirror-bar' | 'mini-bar' | 'circle' | 'line' | 'wave';
export type FilterPreset = 'original' | 'cinematic' | 'vintage' | 'noir' | 'dreamy' | 'vivid';
export type ParticleEffect = 'none' | 'rain' | 'snow' | 'sparkle' | 'heart' | 'embers' | 'fireflies' | 'petals' | 'dust' | 'fog' | 'bokeh' | 'confetti';
export type ScreenEffect = 'none' | 'glitch' | 'grain' | 'bloom' | 'vhs' | 'light-leak' | 'lens-flare' | 'light-sweep';

export interface VisualSettings {
  // Spectrum Style
  spectrumStyle: SpectrumStyle;
  spectrumColor: string;
  spectrumColorMode: 'fixed' | 'rainbow'; // New setting
  spectrumCenter: boolean; // Center alignment toggle
  spectrumPosition: { x: number; y: number }; // 0-100%
  
  // Spectrum Details
  spectrumWidth: number; // 10-100%
  barWidth: number; // px
  spectrumOpacity: number; // 0-1
  spectrumSensitivity: number; // 0.1 to 2.0
  frequencyRange: number; // Number of bars/points (e.g., 64, 128, 256)
  maxHeight: number; // Scale factor for height
  spectrumThickness: number; // Line thickness

  // Background
  backgroundImage: File | null;
  filterPreset: FilterPreset;
  filterIntensity: number; // 0-1 (Strength of the filter)
  bgFilterBlur: number;
  bgFilterBrightness: number;
  vignette: number;

  // Particles (Overlay)
  particleEffect: ParticleEffect;
  particleDensity: number; // Count
  particleOpacity: number;
  particleSpeed: number;
  particleSize: number;
  particleColor: string; // Hex or 'auto'
  particleColorMode: 'fixed' | 'rainbow'; // New setting for particles

  // Screen Effects (Post-Processing)
  screenEffect: ScreenEffect;
  screenEffectIntensity: number; // 0-1

  // Logo
  logoImage: File | null;
  logoPosition: { x: number; y: number };
  logoSize: number;
  logoRemoveBg: boolean; // Auto remove background
  logoThreshold: number; // Tolerance for bg removal
}

export interface EncodingSettings {
  loopCount: 1 | 2 | 3;
  audioBitrate: 96000 | 128000 | 192000;
}

export interface SetupImages {
  backgroundImage: File | null;
  logoImage: File | null;
}

export interface AppState {
  playlist: AudioTrack[];
  visualSettings: VisualSettings;
  outputQuality: '720p' | '1080p';
}