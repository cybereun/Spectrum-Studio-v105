import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { VisualSettings } from '../types';
import { parseGIF, decompressFrames } from 'gifuct-js';

interface VisualizerCanvasProps {
  analyser: AnalyserNode | null;
  settings: VisualSettings;
  width: number;
  height: number;
  isPlaying: boolean;
  isRendering?: boolean;
  fps?: number; // Target FPS
}

export interface VisualizerCanvasRef {
  drawOfflineFrame: (time: number, frequencyData: Uint8Array) => Promise<void>;
  getCanvas: () => HTMLCanvasElement | null;
}

export const VisualizerCanvas = forwardRef<VisualizerCanvasRef, VisualizerCanvasProps>(({
  analyser,
  settings,
  width,
  height,
  isPlaying,
  isRendering = false,
  fps = 30
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const animationRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const colorCycleRef = useRef<number>(0);
  
  // Resources
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null); // Add Video Ref
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  
  // GIF State
  const gifFramesRef = useRef<{ img: HTMLCanvasElement; delay: number }[]>([]);
  const gifTotalDurationRef = useRef<number>(0);

  // Particle System State
  const particlesRef = useRef<Array<{
    x: number; 
    y: number; 
    speedX: number;
    speedY: number; 
    size: number; 
    opacity: number;
    angle: number;
    color?: string;
    rotationSpeed?: number;
    pulseSpeed?: number;
    rotation?: number;
    wobble?: number;
  }>>([]);

  // --- External Access for Offline Rendering ---
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    drawOfflineFrame: async (time: number, frequencyData: Uint8Array) => {
      // 1. Manually update physics state for fixed time step
      colorCycleRef.current += 1;
      
      // Update particles with a fixed delta time (ms) based on target FPS
      const dt = 1000 / fps;
      updateParticles(dt);

      // 2. Handle Video Seeking if Background is Video
      if (bgVideoRef.current && bgVideoRef.current.duration) {
          const videoTime = (time / 1000) % bgVideoRef.current.duration;
          
          // Only seek if significantly different (optimization)
          if (Math.abs(bgVideoRef.current.currentTime - videoTime) > 0.05) {
              bgVideoRef.current.currentTime = videoTime;
              
              // Wait for seek to complete to prevent gray frames
              await new Promise<void>((resolve) => {
                  const vid = bgVideoRef.current;
                  if (!vid) { resolve(); return; }
                  
                  const onSeeked = () => {
                      resolve();
                  };
                  // Race condition safety: if it's already ready
                  if (vid.readyState >= 3 && Math.abs(vid.currentTime - videoTime) < 0.1) {
                      resolve();
                  } else {
                      vid.addEventListener('seeked', onSeeked, { once: true });
                      // Fallback timeout prevents hanging
                      setTimeout(resolve, 500); 
                  }
              });
          }
      }

      // 3. Draw
      drawScene(canvasRef.current, frequencyData, time);
    }
  }));

  // Initialize Data Array when analyser changes
  useEffect(() => {
    if (analyser) {
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, [analyser]);

  // Load Background (Image OR Video)
  useEffect(() => {
    // Cleanup previous
    bgImageRef.current = null;
    if (bgVideoRef.current) {
        bgVideoRef.current.pause();
        bgVideoRef.current.removeAttribute('src');
        bgVideoRef.current.load();
        bgVideoRef.current = null;
    }

    if (settings.backgroundImage) {
      if (settings.backgroundImage.type.startsWith('video/')) {
          const vid = document.createElement('video');
          vid.src = URL.createObjectURL(settings.backgroundImage);
          vid.loop = true;
          vid.muted = true;
          vid.playsInline = true;
          // If not rendering, play it for preview
          if (!isRendering) {
              vid.play().catch(() => {});
          } else {
              vid.pause();
          }
          bgVideoRef.current = vid;
      } else {
          const img = new Image();
          img.src = URL.createObjectURL(settings.backgroundImage);
          img.onload = () => { bgImageRef.current = img; };
      }
    }
  }, [settings.backgroundImage, isRendering]);

  // Load Logo
  useEffect(() => {
    if (settings.logoImage) {
      const img = new Image();
      img.src = URL.createObjectURL(settings.logoImage);
      img.onload = () => { logoImageRef.current = img; };
    } else {
      logoImageRef.current = null;
    }
  }, [settings.logoImage]);

  // Load & Parse GIF
  useEffect(() => {
    if (settings.logoImage && settings.logoImage.type === 'image/gif') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            if (!buffer) return;
            
            try {
                const gif = parseGIF(buffer);
                const frames = decompressFrames(gif, true);
                
                const loadedFrames: { img: HTMLCanvasElement; delay: number }[] = [];
                let totalTime = 0;
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = gif.lsd.width;
                tempCanvas.height = gif.lsd.height;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                
                if (!tempCtx) return;

                frames.forEach((frame) => {
                    const { top, left, width, height } = frame.dims;
                    if (width > 0 && height > 0) {
                        const patchData = new ImageData(frame.patch, width, height);
                        tempCtx.putImageData(patchData, left, top);
                    }
                    
                    const frameCanvas = document.createElement('canvas');
                    frameCanvas.width = gif.lsd.width;
                    frameCanvas.height = gif.lsd.height;
                    const frameCtx = frameCanvas.getContext('2d');
                    if (frameCtx) {
                        frameCtx.drawImage(tempCanvas, 0, 0);
                        loadedFrames.push({
                            img: frameCanvas,
                            delay: frame.delay || 100 
                        });
                        totalTime += (frame.delay || 100);
                    }

                    if (frame.disposalType === 2) {
                         tempCtx.clearRect(left, top, width, height);
                    }
                });

                gifFramesRef.current = loadedFrames;
                gifTotalDurationRef.current = totalTime;
            } catch (err) {
                console.error("Failed to parse GIF", err);
                gifFramesRef.current = [];
            }
        };
        reader.readAsArrayBuffer(settings.logoImage);
    } else {
        gifFramesRef.current = [];
        gifTotalDurationRef.current = 0;
    }
  }, [settings.logoImage]);

  // Particle System Logic
  const initParticles = () => {
    particlesRef.current = [];
    if (settings.particleEffect !== 'none') {
      const count = Math.floor(settings.particleDensity * 2); 
      for (let i = 0; i < count; i++) {
        const p: any = {
          x: Math.random() * width,
          y: Math.random() * height,
          size: (Math.random() * 5 + 2) * (settings.particleSize / 2),
          opacity: Math.random() * settings.particleOpacity,
          angle: Math.random() * Math.PI * 2,
        };
        // Init logic based on type
        if (settings.particleEffect === 'snow') {
           p.speedY = (Math.random() * 2 + 1) * settings.particleSpeed;
           p.speedX = (Math.random() - 0.5) * 0.5;
        } else if (settings.particleEffect === 'fog') {
           p.speedX = (Math.random() * 0.5 + 0.1) * settings.particleSpeed;
           p.speedY = 0;
           p.size = p.size * 20;
           p.opacity = p.opacity * 0.3;
        } else if (settings.particleEffect === 'petals') {
           p.speedY = (Math.random() * 1.5 + 0.5) * settings.particleSpeed;
           p.speedX = (Math.random() - 0.5) * 1.5;
           p.rotation = Math.random() * 360;
           p.rotationSpeed = (Math.random() - 0.5) * 2;
        } else if (settings.particleEffect === 'fireflies') {
           p.speedX = (Math.random() - 0.5) * settings.particleSpeed;
           p.speedY = (Math.random() - 0.5) * settings.particleSpeed;
           p.opacity = Math.random(); 
           p.pulseSpeed = 0.05;
        } else if (settings.particleEffect === 'dust') {
           p.speedX = (Math.random() - 0.5) * 0.5 * settings.particleSpeed;
           p.speedY = (Math.random() - 0.5) * 0.5 * settings.particleSpeed;
           p.size = Math.random() * 2;
        } else if (settings.particleEffect === 'bokeh') {
           p.speedX = (Math.random() - 0.5) * 0.2 * settings.particleSpeed;
           p.speedY = (Math.random() - 0.5) * 0.2 * settings.particleSpeed;
           p.size = Math.random() * 30 + 10;
           p.opacity = Math.random() * 0.3;
        } else if (settings.particleEffect === 'confetti') {
           p.speedY = (Math.random() * 3 + 2) * settings.particleSpeed;
           p.speedX = (Math.random() - 0.5) * 2;
           p.rotation = Math.random() * 360;
           p.rotationSpeed = (Math.random() - 0.5) * 5;
           const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];
           p.color = colors[Math.floor(Math.random() * colors.length)];
        } else {
           p.speedY = (Math.random() * 2 + 0.5) * settings.particleSpeed;
           p.speedX = 0;
           p.wobble = Math.random() * Math.PI * 2;
        }
        particlesRef.current.push(p);
      }
    }
  };

  useEffect(() => {
    initParticles();
  }, [settings.particleEffect, settings.particleDensity, width, height]);

  const updateParticles = (deltaTimeMs: number) => {
    const timeScale = deltaTimeMs / 16.66; 

    particlesRef.current.forEach(p => {
       if (settings.particleEffect === 'snow' || settings.particleEffect === 'rain' || settings.particleEffect === 'petals' || settings.particleEffect === 'confetti') {
           p.y += p.speedY * timeScale;
           p.x += p.speedX * timeScale;
           if (p.y > height) { p.y = -10; p.x = Math.random() * width; }
       } else if (settings.particleEffect === 'embers') {
           p.y -= p.speedY * timeScale;
           if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
       } else if (settings.particleEffect === 'fog') {
           p.x += p.speedX * timeScale;
           if (p.x > width) { p.x = -p.size; }
       } else {
           p.x += p.speedX * timeScale;
           p.y += p.speedY * timeScale;
           if (p.x < 0 || p.x > width) p.speedX *= -1;
           if (p.y < 0 || p.y > height) p.speedY *= -1;
       }
       
       if (settings.particleEffect === 'heart') {
          p.wobble = (p.wobble || 0) + (0.05 * timeScale);
       }
       
       if (p.rotationSpeed) p.angle += p.rotationSpeed * 0.01 * timeScale;
       if (p.pulseSpeed) {
          p.opacity += p.pulseSpeed * timeScale;
          if (p.opacity > 1 || p.opacity < 0.2) p.pulseSpeed *= -1;
       }
    });
  };

  const drawScene = (canvas: HTMLCanvasElement | null, dataArray: Uint8Array | null, time: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    // 1. Clear
    ctx.clearRect(0, 0, width, height);

    // 2. Background (Video or Image)
    const bgSource = bgVideoRef.current || bgImageRef.current;
    
    if (bgSource) {
        ctx.save();
        const blur = `blur(${settings.bgFilterBlur}px)`;
        const brightness = `brightness(${settings.bgFilterBrightness})`;
        let presetFilter = '';
        const intensity = settings.filterIntensity;
        switch (settings.filterPreset) {
            case 'cinematic': presetFilter = `contrast(${100 + 20 * intensity}%) saturate(${100 + 10 * intensity}%)`; break;
            case 'vintage': presetFilter = `sepia(${50 * intensity}%) contrast(${90 * intensity}%)`; break;
            case 'noir': presetFilter = `grayscale(${100 * intensity}%) contrast(${120 * intensity}%)`; break;
            case 'dreamy': presetFilter = `brightness(${100 + 10 * intensity}%) saturate(${100 + 20 * intensity}%)`; break;
            case 'vivid': presetFilter = `saturate(${100 + 50 * intensity}%) contrast(${110 * intensity}%)`; break;
            default: presetFilter = '';
        }
        ctx.filter = `${blur} ${brightness} ${presetFilter}`;
        
        // Handle Video Element vs Image Element dimensions
        const srcW = (bgSource instanceof HTMLVideoElement) ? bgSource.videoWidth : bgSource.width;
        const srcH = (bgSource instanceof HTMLVideoElement) ? bgSource.videoHeight : bgSource.height;
        
        if (srcW > 0 && srcH > 0) {
            const scale = Math.max(width / srcW, height / srcH);
            const x = (width / 2) - (srcW / 2) * scale;
            const y = (height / 2) - (srcH / 2) * scale;
            ctx.drawImage(bgSource, x, y, srcW * scale, srcH * scale);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);
    }

    // 3. Vignette
    if (settings.vignette > 0) {
        const gradient = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height * 1.2);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${settings.vignette})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,width,height);
    }

    // 4. Logo
    let logoRect = { x: 0, y: 0, w: 0, h: 0 };
    let currentLogoImg: HTMLImageElement | HTMLCanvasElement | null = null;
    
    // Determine which image to draw (GIF or Static)
    if (gifFramesRef.current.length > 0 && gifTotalDurationRef.current > 0) {
        const loopTime = time % gifTotalDurationRef.current;
        let accum = 0;
        for (const frame of gifFramesRef.current) {
            accum += frame.delay;
            if (loopTime < accum) {
                currentLogoImg = frame.img;
                break;
            }
        }
        if (!currentLogoImg) currentLogoImg = gifFramesRef.current[0].img;
    } else {
        currentLogoImg = logoImageRef.current;
    }

    if (currentLogoImg) {
        const logoW = (currentLogoImg.width * settings.logoSize) / 100;
        const logoH = (currentLogoImg.height * settings.logoSize) / 100;
        const logoX = (settings.logoPosition.x / 100) * (width - logoW);
        const logoY = (settings.logoPosition.y / 100) * (height - logoH);
        logoRect = { x: logoX, y: logoY, w: logoW, h: logoH };
        
        if (settings.logoRemoveBg && !(currentLogoImg instanceof HTMLCanvasElement)) {
             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = logoW;
             tempCanvas.height = logoH;
             const tempCtx = tempCanvas.getContext('2d');
             if (tempCtx) {
                tempCtx.drawImage(currentLogoImg, 0, 0, logoW, logoH);
                const imgData = tempCtx.getImageData(0, 0, logoW, logoH);
                const data = imgData.data;
                const keyR = data[0], keyG = data[1], keyB = data[2];
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    const dist = Math.sqrt((r-keyR)**2 + (g-keyG)**2 + (b-keyB)**2);
                    if (dist < settings.logoThreshold * 3) data[i+3] = 0;
                }
                tempCtx.putImageData(imgData, 0, 0);
                ctx.drawImage(tempCanvas, logoX, logoY);
             }
        } else {
            ctx.drawImage(currentLogoImg, logoX, logoY, logoW, logoH);
        }
    }

    // 5. Particles
    if (settings.particleEffect !== 'none' && particlesRef.current.length > 0) {
        let baseParticleColor = settings.particleColor;
        if (settings.particleColorMode === 'rainbow') {
            const hue = (colorCycleRef.current) % 360;
            baseParticleColor = `hsl(${hue}, 100%, 70%)`;
        }
        ctx.fillStyle = baseParticleColor;
        const defaultColor = baseParticleColor;

        particlesRef.current.forEach(p => {
          ctx.save();
          ctx.globalAlpha = p.opacity * settings.particleOpacity;
          
          if (settings.particleEffect === 'confetti') {
              if (settings.particleColorMode === 'rainbow') {
                 ctx.fillStyle = `hsl(${(p.angle * 57 + colorCycleRef.current) % 360}, 100%, 50%)`;
              } else {
                 ctx.fillStyle = p.color || defaultColor;
              }
              ctx.translate(p.x, p.y);
              ctx.rotate(p.angle);
              ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
          } else if (settings.particleEffect === 'petals') {
              if (settings.particleColorMode === 'fixed' && settings.particleColor === '#ffffff') ctx.fillStyle = '#ffb7c5';
              else ctx.fillStyle = defaultColor;
              ctx.translate(p.x, p.y);
              ctx.rotate(p.angle);
              ctx.beginPath();
              ctx.ellipse(0, 0, p.size, p.size/2, 0, 0, Math.PI * 2);
              ctx.fill();
          } else if (settings.particleEffect === 'fog') {
              const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
              grad.addColorStop(0, `rgba(200, 200, 200, ${0.4 * settings.particleOpacity})`);
              grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.fillStyle = grad;
              ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          } else if (settings.particleEffect === 'fireflies') {
              if (settings.particleColorMode === 'fixed' && settings.particleColor === '#ffffff') ctx.fillStyle = '#ccff00';
              else ctx.fillStyle = defaultColor;
              ctx.globalAlpha = p.opacity * settings.particleOpacity;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 5;
              ctx.shadowColor = ctx.fillStyle as string;
              ctx.fill();
          } else if (settings.particleEffect === 'rain') {
             ctx.fillStyle = defaultColor;
             ctx.fillRect(p.x, p.y, 1, p.size * 5);
          } else if (settings.particleEffect === 'snow') {
             ctx.fillStyle = defaultColor;
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size/2, 0, Math.PI * 2);
             ctx.fill();
          } else if (settings.particleEffect === 'embers') {
             if (settings.particleColorMode === 'fixed' && settings.particleColor === '#ffffff') ctx.fillStyle = '#ff4500';
             else ctx.fillStyle = defaultColor;
             ctx.shadowBlur = 10;
             ctx.shadowColor = ctx.fillStyle as string;
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.fill();
          } else if (settings.particleEffect === 'heart') {
             if (settings.particleColorMode === 'fixed' && settings.particleColor === '#ffffff') ctx.fillStyle = '#ff69b4';
             else ctx.fillStyle = defaultColor;
             
             ctx.translate(p.x, p.y);
             ctx.rotate(Math.sin(p.wobble || 0) * 0.2); 

             const s = p.size;
             ctx.beginPath();
             ctx.moveTo(0, -s * 0.2);
             ctx.bezierCurveTo(-s * 0.5, -s * 0.6, -s, -s * 0.2, -s, s * 0.2);
             ctx.bezierCurveTo(-s, s * 0.6, -s * 0.5, s * 0.8, 0, s * 1.2);
             ctx.bezierCurveTo(s * 0.5, s * 0.8, s, s * 0.6, s, s * 0.2);
             ctx.bezierCurveTo(s, -s * 0.2, s * 0.5, -s * 0.6, 0, -s * 0.2);
             ctx.fill();
          } else {
             ctx.fillStyle = defaultColor;
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.fill();
          }
          ctx.restore();
        });
    }

    // 6. Spectrum
    if (settings.spectrumStyle !== 'none' && dataArray) {
        ctx.fillStyle = settings.spectrumColor;
        ctx.strokeStyle = settings.spectrumColor;
        ctx.lineWidth = settings.spectrumThickness;
        ctx.globalAlpha = settings.spectrumOpacity;
        
        const centerX = settings.spectrumCenter ? width / 2 : (settings.spectrumPosition.x / 100) * width;
        const centerY = settings.spectrumCenter ? height / 2 : (settings.spectrumPosition.y / 100) * height;
        const barCount = settings.frequencyRange; 
        const renderWidth = (settings.spectrumWidth / 100) * width;
        
        const getRainbowColor = (index: number, total: number) => {
             const hue = (index / total * 360 + colorCycleRef.current * 0.5) % 360;
             return `hsl(${hue}, 100%, 50%)`;
        };
        
        if (settings.spectrumStyle === 'bar') {
             const spacing = renderWidth / barCount;
             const startX = centerX - (renderWidth / 2);

             for(let i = 0; i < barCount; i++) {
                const val = dataArray[i * 2] || 0;
                const h = val * settings.spectrumSensitivity * settings.maxHeight;
                if (settings.spectrumColorMode === 'rainbow') ctx.fillStyle = getRainbowColor(i, barCount);
                
                const x = startX + (i * spacing) + (spacing - settings.barWidth) / 2;
                ctx.fillRect(x, centerY - h, settings.barWidth, h);
             }
        } 
        else if (settings.spectrumStyle === 'mirror-bar') {
             const spacing = renderWidth / barCount;
             const startX = centerX - (renderWidth / 2);

             for(let i = 0; i < barCount; i++) {
                const val = dataArray[i * 2] || 0;
                const h = val * settings.spectrumSensitivity * settings.maxHeight * 0.7; 
                if (settings.spectrumColorMode === 'rainbow') ctx.fillStyle = getRainbowColor(i, barCount);
                
                const x = startX + (i * spacing) + (spacing - settings.barWidth) / 2;
                ctx.fillRect(x, centerY - h, settings.barWidth, h);
                ctx.fillRect(x, centerY, settings.barWidth, h);
             }
        }
        else if (settings.spectrumStyle === 'mini-bar') {
             let startX = 0;
             let startY = 0;
             if (settings.spectrumCenter) {
                 const spacing = settings.barWidth + 4;
                 const bands = 6;
                 const totalW = bands * spacing;
                 startX = (width / 2) - (totalW / 2);
                 startY = height / 2;
             } else {
                 startX = logoRect.x + logoRect.w + 20;
                 startY = logoRect.y + logoRect.h / 2;
             }
             const bands = 6;
             const spacing = settings.barWidth + 4; 
             for(let i = 0; i < bands; i++) {
                 const val = dataArray[i * 10] || 0;
                 const h = val * settings.spectrumSensitivity * 0.5 * settings.maxHeight;
                 if (settings.spectrumColorMode === 'rainbow') ctx.fillStyle = getRainbowColor(i, bands);
                 ctx.fillRect(startX + (i * spacing), startY - h/2, settings.barWidth, h);
             }
        }
        else if (settings.spectrumStyle === 'line') {
             ctx.beginPath();
             const sliceW = renderWidth / barCount;
             const startX = centerX - (renderWidth / 2);
             if (settings.spectrumColorMode === 'rainbow') {
                 const grad = ctx.createLinearGradient(startX, centerY, startX + renderWidth, centerY);
                 for (let k = 0; k <= 1; k+=0.1) grad.addColorStop(k, `hsl(${(k * 360 + colorCycleRef.current) % 360}, 100%, 50%)`);
                 ctx.strokeStyle = grad;
             }
             for(let i = 0; i < barCount; i++) {
                 const val = dataArray[i] || 0;
                 const h = val * settings.spectrumSensitivity * settings.maxHeight;
                 const x = startX + i * sliceW;
                 const y = centerY - h; 
                 if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
             }
             ctx.stroke();
        }
        else if (settings.spectrumStyle === 'wave') {
             const lines = 3;
             const startX = centerX - (renderWidth / 2);

             for(let l = 0; l < lines; l++) {
                 ctx.beginPath();
                 if (settings.spectrumColorMode === 'rainbow') {
                     const hue = (colorCycleRef.current + l * 30) % 360;
                     ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${settings.spectrumOpacity * (1 - l * 0.2)})`;
                 } else {
                     ctx.globalAlpha = settings.spectrumOpacity * (1 - l * 0.2);
                 }
                 for(let i = 0; i < barCount; i++) {
                     const val = dataArray[i] || 0;
                     const v = (dataArray[i + (l * 5)] || 0) / 128.0;
                     const y = v * (height/4) * settings.spectrumSensitivity * settings.maxHeight;
                     const actualY = centerY + (y - (height/8)) + (l * 20);
                     
                     const x = startX + i * (renderWidth / (barCount - 1));

                     if (i === 0) ctx.moveTo(x, actualY); else ctx.lineTo(x, actualY);
                 }
                 ctx.stroke();
             }
        }
        else if (settings.spectrumStyle === 'circle') {
             // Use spectrumWidth setting to control radius relative to screen size
             const maxDimension = Math.min(width, height);
             const radius = (settings.spectrumWidth / 100) * (maxDimension / 2) * 0.8; 
             
             const step = (Math.PI * 2) / barCount;
             for (let i = 0; i < barCount; i++) {
                 const value = dataArray[i * 2]; 
                 const h = value * settings.spectrumSensitivity * 0.5 * settings.maxHeight;
                 if (settings.spectrumColorMode === 'rainbow') ctx.fillStyle = getRainbowColor(i, barCount);
                 ctx.save();
                 ctx.translate(centerX, centerY);
                 ctx.rotate(i * step);
                 ctx.fillRect(0, radius, settings.spectrumThickness, h);
                 ctx.restore();
             }
        }
        
        ctx.globalAlpha = 1.0;
    }

    // 7. Screen Effects (Post-Processing)
    if (settings.screenEffect !== 'none') {
       const intensity = settings.screenEffectIntensity;
       const t = time * 0.001; 

       if (settings.screenEffect === 'grain') {
           ctx.save();
           ctx.globalCompositeOperation = 'overlay';
           ctx.globalAlpha = intensity * 0.3;
           for (let i = 0; i < width; i += 4) {
               for (let j = 0; j < height; j += 4) {
                   if (Math.random() > 0.5) {
                       ctx.fillStyle = '#000';
                       ctx.fillRect(i, j, 2, 2);
                   }
               }
           }
           ctx.restore();
       } 
       else if (settings.screenEffect === 'glitch') {
           if (Math.random() < intensity * 0.5) {
               const sliceH = Math.random() * 50 + 10;
               const sliceY = Math.random() * height;
               const offset = (Math.random() - 0.5) * 20 * intensity;
               try {
                   ctx.drawImage(canvas, 0, sliceY, width, sliceH, offset, sliceY, width, sliceH);
                   ctx.save();
                   ctx.globalCompositeOperation = 'color-dodge';
                   ctx.globalAlpha = 0.5;
                   ctx.fillStyle = 'rgba(255,0,0,0.5)';
                   ctx.fillRect(0, sliceY, width, sliceH);
                   ctx.restore();
               } catch(e) {}
           }
       }
       else if (settings.screenEffect === 'bloom') {
           ctx.save();
           ctx.globalCompositeOperation = 'screen';
           ctx.filter = `blur(${20 * intensity}px)`;
           ctx.globalAlpha = intensity * 0.5;
           ctx.drawImage(canvas, 0, 0);
           ctx.restore();
       }
       else if (settings.screenEffect === 'vhs') {
           ctx.save();
           ctx.globalAlpha = 0.1 * intensity;
           ctx.fillStyle = '#000';
           for (let y = 0; y < height; y += 4) {
               ctx.fillRect(0, y, width, 2);
           }
           ctx.restore();
       }
       else if (settings.screenEffect === 'light-leak') {
           ctx.save();
           ctx.globalCompositeOperation = 'screen';
           const leakCount = 3;
           for(let i=0; i<leakCount; i++) {
               const speed = 0.5;
               const x = (Math.sin(t * speed + i * 2) * 0.5 + 0.5) * width;
               const y = (Math.cos(t * speed * 0.7 + i) * 0.5 + 0.5) * height;
               const size = Math.max(width, height) * (0.25 + Math.sin(t + i) * 0.1);
               const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
               const alpha = intensity * (0.3 + Math.sin(t * 2 + i) * 0.1);
               if (i===0) {
                   grad.addColorStop(0, `rgba(255, 100, 50, ${alpha})`);
                   grad.addColorStop(1, 'rgba(255, 100, 50, 0)');
               } else if (i===1) {
                   grad.addColorStop(0, `rgba(255, 200, 100, ${alpha})`);
                   grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
               } else {
                   grad.addColorStop(0, `rgba(255, 150, 150, ${alpha})`);
                   grad.addColorStop(1, 'rgba(255, 150, 150, 0)');
               }
               ctx.fillStyle = grad;
               ctx.fillRect(0,0,width,height);
           }
           ctx.restore();
       }
       else if (settings.screenEffect === 'lens-flare') {
           ctx.save();
           ctx.globalCompositeOperation = 'screen';
           const sunX = (Math.sin(t * 0.3) * 0.4 + 0.5) * width;
           const sunY = (Math.sin(t * 0.6) * 0.2 + 0.2) * height; 
           const cx = width / 2;
           const cy = height / 2;
           const dx = cx - sunX;
           const dy = cy - sunY;
           
           const mainGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 300 * intensity);
           mainGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 * intensity})`);
           mainGrad.addColorStop(0.2, `rgba(255, 255, 200, ${0.4 * intensity})`);
           mainGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
           ctx.fillStyle = mainGrad;
           ctx.fillRect(0,0,width,height);
           
           ctx.translate(sunX, sunY);
           ctx.rotate(t * 0.1);
           ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * intensity})`;
           ctx.lineWidth = 2;
           ctx.beginPath();
           for(let i=0; i<8; i++) {
               ctx.rotate(Math.PI / 4);
               ctx.moveTo(0,0);
               ctx.lineTo(100 + Math.random()*50, 0);
           }
           ctx.stroke();
           ctx.setTransform(1,0,0,1,0,0);

           const ghosts = [0.5, 1.2, 2.2, 3.5]; 
           ghosts.forEach((g, i) => {
               const gx = sunX + dx * g;
               const gy = sunY + dy * g;
               const size = (50 + i * 30) * intensity;
               const alpha = (0.1 + Math.random()*0.1) * intensity;
               ctx.beginPath();
               ctx.arc(gx, gy, size, 0, Math.PI*2);
               ctx.fillStyle = i%2===0 ? `rgba(200, 255, 200, ${alpha})` : `rgba(200, 200, 255, ${alpha})`;
               ctx.fill();
           });
           ctx.restore();
       }
       else if (settings.screenEffect === 'light-sweep') {
           ctx.save();
           ctx.globalCompositeOperation = 'overlay'; 
           const period = 5; 
           const progress = (t % period) / period;
           const startX = (progress * 2 - 0.5) * width; 
           const sweepW = width * 0.3;
           ctx.translate(startX, 0);
           ctx.transform(1, 0, -0.4, 1, 0, 0); 
           const grad = ctx.createLinearGradient(0, 0, sweepW, 0);
           grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
           grad.addColorStop(0.5, `rgba(255, 255, 255, ${0.6 * intensity})`);
           grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
           ctx.fillStyle = grad;
           ctx.fillRect(0, 0, sweepW, height);
           ctx.restore();
       }
    }
  };

  // Main Render Loop (Real-time Preview)
  useEffect(() => {
    // Only run the loop if NOT rendering.
    if (isRendering) {
       if (animationRef.current) cancelAnimationFrame(animationRef.current);
       return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = (time: number) => {
      if (analyser && dataArrayRef.current) {
          analyser.getByteFrequencyData(dataArrayRef.current);
      }
      colorCycleRef.current += 1;
      updateParticles(16.66); // Assume 60fps for preview physics
      drawScene(canvas, dataArrayRef.current, time);
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, settings, analyser, isRendering]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full object-contain bg-black shadow-2xl"
    />
  );
});

VisualizerCanvas.displayName = 'VisualizerCanvas';