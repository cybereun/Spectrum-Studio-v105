import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AudioTrack, EncodingSettings, SetupImages } from '../types';
import { getAudioDuration, generateTimelineText, formatTime } from '../utils';
import { Upload, Trash2, Copy, Music, Move, Video, ImageIcon, Layers, Settings } from './IconComponents';

interface SetupPhaseProps {
  playlist: AudioTrack[];
  setPlaylist: React.Dispatch<React.SetStateAction<AudioTrack[]>>;
  images: SetupImages;
  setImages: React.Dispatch<React.SetStateAction<SetupImages>>;
  encodingSettings: EncodingSettings;
  setEncodingSettings: React.Dispatch<React.SetStateAction<EncodingSettings>>;
  onNext: () => void;
}

export const SetupPhase: React.FC<SetupPhaseProps> = ({ 
  playlist, 
  setPlaylist, 
  images, 
  setImages,
  encodingSettings,
  setEncodingSettings,
  onNext 
}) => {
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File processing logic extracted for reuse in drag-and-drop
  const processFiles = async (files: File[]) => {
    setLoading(true);
    const newTracks: AudioTrack[] = [];

    for (const file of files) {
      // Basic check for audio type
      if (!file.type.startsWith('audio/')) continue;
      
      try {
        const duration = await getAudioDuration(file);
        newTracks.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          duration,
        });
      } catch (error) {
        console.error("Error loading audio file:", file.name, error);
      }
    }

    if (newTracks.length > 0) {
      setPlaylist((prev) => [...prev, ...newTracks]);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await processFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleImageUpload = (key: keyof SetupImages, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImages(prev => ({ ...prev, [key]: e.target.files![0] }));
    }
  };

  const removeTrack = (id: string) => {
    setPlaylist((prev) => prev.filter((t) => t.id !== id));
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === playlist.length - 1)
    )
      return;

    const newPlaylist = [...playlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newPlaylist[index], newPlaylist[targetIndex]] = [newPlaylist[targetIndex], newPlaylist[index]];
    setPlaylist(newPlaylist);
  };

  const copyTimeline = () => {
    const text = generateTimelineText(playlist);
    navigator.clipboard.writeText(text).then(() => {
      alert('타임라인이 클립보드에 복사되었습니다! 메모장에 붙여넣기 하세요.');
    });
  };

  // Image Previews
  const bgPreview = useMemo(() => images.backgroundImage ? URL.createObjectURL(images.backgroundImage) : null, [images.backgroundImage]);
  const logoPreview = useMemo(() => images.logoImage ? URL.createObjectURL(images.logoImage) : null, [images.logoImage]);

  // Cleanup URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (bgPreview) URL.revokeObjectURL(bgPreview);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [bgPreview, logoPreview]);

  return (
    <div className="flex flex-col h-full w-full max-w-[1600px] mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
          스펙트럼 스튜디오
        </h1>
        <p className="text-gray-400">브라우저에서 완성하는 나만의 플레이리스트 비디오</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
        
        {/* Left Column: Config Steps (Stacked Vertically) */}
        <div className="lg:col-span-5 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* 1. Music Upload */}
          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Upload size={20} className="text-cyan-400" />
              1. 음악 파일 업로드
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              MP3, WAV 파일을 드래그앤드롭 하거나 클릭하여 업로드하세요.
            </p>
            <input
              type="file"
              accept="audio/*"
              multiple
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                isDragging 
                  ? 'border-cyan-400 bg-gray-700/80 scale-[1.02]' 
                  : 'border-gray-600 hover:border-cyan-500 hover:bg-gray-700/50'
              }`}
            >
              <Music size={32} className={`mb-2 ${isDragging ? 'text-cyan-400' : 'text-gray-400'}`} />
              <span className={`text-sm ${isDragging ? 'text-cyan-300' : 'text-gray-300'}`}>
                {loading ? '분석 중...' : isDragging ? '여기에 파일을 놓으세요' : '클릭 또는 드래그하여 음악 선택'}
              </span>
            </label>
          </div>

          {/* 2. Visual Assets */}
          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon size={20} className="text-cyan-400" />
              2. 비주얼 에셋
            </h2>
            
            <div className="space-y-4">
              {/* Background Image */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">배경 이미지</label>
                <div className="flex items-center gap-3">
                   <div className="flex-1 flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="bg-upload"
                        className="hidden"
                        onChange={(e) => handleImageUpload('backgroundImage', e)}
                      />
                      <label htmlFor="bg-upload" className="flex-1 cursor-pointer bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm text-center truncate border border-gray-600 transition-colors">
                        {images.backgroundImage ? "이미지 변경" : "배경 선택"}
                      </label>
                   </div>
                   {bgPreview && (
                     <div className="w-16 h-9 rounded overflow-hidden border border-gray-600 bg-black flex-shrink-0 relative group">
                        <img src={bgPreview} alt="Background Preview" className="w-full h-full object-cover" />
                     </div>
                   )}
                   {!bgPreview && <div className="w-16 h-9 rounded bg-gray-700/50 border border-gray-600 flex-shrink-0"></div>}
                </div>
                {images.backgroundImage && <p className="text-[10px] text-gray-500 mt-1 truncate">{images.backgroundImage.name}</p>}
              </div>
              
              {/* Logo Image */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">채널 로고 (GIF 지원)</label>
                <div className="flex items-center gap-3">
                   <div className="flex-1 flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*, .gif"
                        id="logo-upload"
                        className="hidden"
                        onChange={(e) => handleImageUpload('logoImage', e)}
                      />
                      <label htmlFor="logo-upload" className="flex-1 cursor-pointer bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm text-center truncate border border-gray-600 transition-colors">
                         {images.logoImage ? "로고 변경" : "로고 선택"}
                      </label>
                   </div>
                   {logoPreview && (
                     <div className="w-9 h-9 rounded overflow-hidden border border-gray-600 bg-black flex-shrink-0">
                        <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                     </div>
                   )}
                   {!logoPreview && <div className="w-9 h-9 rounded bg-gray-700/50 border border-gray-600 flex-shrink-0"></div>}
                </div>
                {images.logoImage && <p className="text-[10px] text-gray-500 mt-1 truncate">{images.logoImage.name}</p>}
              </div>
            </div>
          </div>

          {/* 3. Encoding Settings */}
          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-cyan-400" />
              3. 인코딩 설정
            </h2>
            
            <div className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-gray-400 mb-2">재생 반복 (Loop Count)</label>
                 <div className="grid grid-cols-3 gap-2">
                   {[1, 2, 3].map((count) => (
                     <button
                       key={count}
                       onClick={() => setEncodingSettings(prev => ({ ...prev, loopCount: count as 1|2|3 }))}
                       className={`py-2 px-3 rounded text-sm font-medium border transition-colors ${
                         encodingSettings.loopCount === count 
                           ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]' 
                           : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                       }`}
                     >
                       {count}회
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-medium text-gray-400 mb-2">오디오 품질 (VBR)</label>
                 <div className="grid grid-cols-3 gap-2">
                   {[96000, 128000, 192000].map((bitrate) => (
                     <button
                       key={bitrate}
                       onClick={() => setEncodingSettings(prev => ({ ...prev, audioBitrate: bitrate as 96000|128000|192000 }))}
                       className={`py-2 px-3 rounded text-sm font-medium border transition-colors ${
                         encodingSettings.audioBitrate === bitrate 
                           ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]' 
                           : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                       }`}
                     >
                       {bitrate / 1000}k
                     </button>
                   ))}
                 </div>
               </div>
            </div>
          </div>

          {/* 4. Timeline Generation */}
          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Copy size={20} className="text-cyan-400" />
              4. 타임라인 생성
            </h2>
            <button
              onClick={copyTimeline}
              disabled={playlist.length === 0}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <Copy size={16} />
              타임라인 복사하기
            </button>
          </div>

        </div>

        {/* Right Column: Playlist (Span 7) */}
        <div className="lg:col-span-7 bg-gray-800 rounded-2xl border border-gray-700 shadow-xl flex flex-col overflow-hidden h-full min-h-[500px]">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
            <h2 className="text-lg font-semibold">재생 목록 ({playlist.length}곡)</h2>
            <span className="text-xs text-gray-400">
              총 길이: {formatTime(playlist.reduce((acc, t) => acc + t.duration + 2, 0) * encodingSettings.loopCount)}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {playlist.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Music size={64} className="mb-4 opacity-20" />
                <p>왼쪽에서 음악 파일을 추가해주세요.</p>
                <p className="text-sm opacity-50 mt-2">드래그 앤 드롭 지원</p>
              </div>
            ) : (
              playlist.map((track, index) => (
                <div
                  key={track.id}
                  className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between group hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className="text-cyan-500 font-mono w-6 text-center text-lg">{index + 1}</span>
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate font-medium text-white text-base">{track.name}</span>
                      <span className="text-xs text-gray-400">{formatTime(track.duration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveTrack(index, 'up')} disabled={index === 0} className="p-2 hover:bg-gray-600 rounded text-gray-300 hover:text-cyan-400 disabled:opacity-30">▲</button>
                    <button onClick={() => moveTrack(index, 'down')} disabled={index === playlist.length - 1} className="p-2 hover:bg-gray-600 rounded text-gray-300 hover:text-cyan-400 disabled:opacity-30">▼</button>
                    <button onClick={() => removeTrack(track.id)} className="p-2 hover:bg-red-900/30 rounded text-gray-300 hover:text-red-400 ml-2"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onNext}
          disabled={playlist.length === 0}
          className="px-10 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          편집 스튜디오로 이동
          <Video size={24} />
        </button>
      </div>
    </div>
  );
};