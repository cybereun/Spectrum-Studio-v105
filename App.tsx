import React, { useState } from 'react';
import { SetupPhase } from './components/SetupPhase';
import { StudioPhase } from './components/StudioPhase';
import { AudioTrack, EncodingSettings, SetupImages } from './types';

function App() {
  const [step, setStep] = useState<'setup' | 'studio'>('setup');
  const [playlist, setPlaylist] = useState<AudioTrack[]>([]);
  
  // New state for SetupPhase inputs
  const [images, setImages] = useState<SetupImages>({ backgroundImage: null, logoImage: null });
  const [encodingSettings, setEncodingSettings] = useState<EncodingSettings>({
    loopCount: 1,
    audioBitrate: 128000
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-cyan-500 selection:text-white">
      {step === 'setup' ? (
        <SetupPhase 
          playlist={playlist} 
          setPlaylist={setPlaylist} 
          images={images}
          setImages={setImages}
          encodingSettings={encodingSettings}
          setEncodingSettings={setEncodingSettings}
          onNext={() => setStep('studio')}
        />
      ) : (
        <StudioPhase 
          playlist={playlist} 
          initialImages={images}
          encodingSettings={encodingSettings}
          onBack={() => setStep('setup')}
        />
      )}
    </div>
  );
}

export default App;