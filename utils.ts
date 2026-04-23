import { AudioTrack } from "./types";

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatTimeLong = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    audio.onerror = (e) => reject(e);
    audio.src = window.URL.createObjectURL(file);
  });
};

export const generateTimelineText = (playlist: AudioTrack[]): string => {
  let currentTime = 0;
  let text = '';
  
  playlist.forEach((track) => {
    text += `${formatTimeLong(currentTime)} ${track.name.replace(/\.[^/.]+$/, "")}\n`;
    currentTime += track.duration + 2;
  });
  
  return text;
};