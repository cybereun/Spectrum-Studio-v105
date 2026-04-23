import { VisualSettings } from './types';

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  // Spectrum Defaults
  spectrumStyle: 'bar',
  spectrumColor: '#ffffff',
  spectrumColorMode: 'fixed',
  spectrumCenter: true,
  spectrumPosition: { x: 50, y: 50 },
  spectrumWidth: 80,
  barWidth: 5,
  spectrumOpacity: 1.0,
  spectrumSensitivity: 1.2,
  frequencyRange: 64,
  maxHeight: 1.0,
  spectrumThickness: 2,
  
  // Background Defaults
  backgroundImage: null,
  filterPreset: 'original',
  filterIntensity: 1.0,
  bgFilterBlur: 0,
  bgFilterBrightness: 0.5, // Slightly darker by default for text visibility
  vignette: 0.3,

  // Particle Defaults
  particleEffect: 'none',
  particleDensity: 50,
  particleOpacity: 0.7,
  particleSpeed: 1.0,
  particleSize: 3,
  particleColor: '#ffffff',
  particleColorMode: 'fixed',

  // Screen FX Defaults
  screenEffect: 'none',
  screenEffectIntensity: 0.5,

  // Logo Defaults
  logoImage: null,
  logoPosition: { x: 90, y: 10 },
  logoSize: 15,
  logoRemoveBg: false,
  logoThreshold: 10,
};

export const CANVAS_RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};