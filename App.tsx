
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { Loader2, Scan, Cpu, ShieldCheck, Upload, XCircle } from 'lucide-react';
import HoloEarth from './components/HoloEarth';
import GeoIntelPanel from './components/GeoIntelPanel';
import CustomModel from './components/CustomModel';
import { SharedHandState, Continent } from './types';

// Initial state for refs
const initialHandState: SharedHandState = {
  left: { isDetected: false, isPinching: false, position: { x: 0, y: 0 }, pinchDistance: 0 },
  right: { isDetected: false, isPinching: false, position: { x: 0, y: 0 }, pinchDistance: 0 },
  landmarks: { left: null, right: null }
};

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const handStateRef = useRef<SharedHandState>(initialHandState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentContinent, setCurrentContinent] = useState<Continent>(Continent.Unknown);
  const [time, setTime] = useState(new Date());

  // Custom Model State
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);
  const [customModelType, setCustomModelType] = useState<'obj' | 'stl'>('obj');
  const [fileName, setFileName] = useState<string | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Computer Vision Setup
  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        // Start Webcam
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing vision:", error);
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current || !canvas2dRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvas2dRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resize canvas to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const startTimeMs = performance.now();
      const results = handLandmarker.detectForVideo(video, startTimeMs);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = new DrawingUtils(ctx);

      // Reset state for this frame
      const nextState: SharedHandState = { ...initialHandState };

      if (results.landmarks) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          
          // Draw Skeleton
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: "#00FFFF",
            lineWidth: 2
          });
          drawingUtils.drawLandmarks(landmarks, {
            color: "#FFFFFF",
            lineWidth: 1,
            radius: 3
          });

          // Logic: Calculate Pinch & Position
          // Thumb Tip: 4, Index Tip: 8
          const thumb = landmarks[4];
          const index = landmarks[8];
          const wrist = landmarks[0];
          
          const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
          const isPinching = pinchDist < 0.08; // Threshold

          const handData = {
            isDetected: true,
            isPinching,
            position: { x: wrist.x, y: wrist.y }, // Use wrist for general movement
            pinchDistance: pinchDist
          };

          // Map to correct hand state (Mirror Logic)
          if (wrist.x < 0.5) {
             nextState.left = handData;
             nextState.landmarks.left = landmarks;
          } else {
             nextState.right = handData;
             nextState.landmarks.right = landmarks;
          }
        }
      }

      handStateRef.current = nextState;
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupVision();

    return () => {
      cancelAnimationFrame(animationFrameId);
      handLandmarker?.close();
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('herhere')
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'obj' || extension === 'stl') {
        const url = URL.createObjectURL(file);
        setCustomModelUrl(url);
        setCustomModelType(extension as 'obj' | 'stl');
        setFileName(file.name);
    } else {
        alert("Unsupported file type. Please use .obj or .stl");
    }
  };

  const clearCustomModel = () => {
    setCustomModelUrl(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none font-mono text-cyan-500">
      {/* 1. Webcam Layer (Processed) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale contrast-125 brightness-75 scale-x-[-1]" // Mirror effect
      />
      
      {/* 2. Scanline/Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 scanline-overlay bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>

      {/* 3. 3D Scene Layer */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} color="#00FFFF" />
          <pointLight position={[10, 10, 10]} intensity={1} color="#00FFFF" />
          <Suspense fallback={null}>
            {customModelUrl ? (
                <CustomModel 
                    url={customModelUrl} 
                    type={customModelType} 
                    handStateRef={handStateRef} 
                />
            ) : (
                <HoloEarth 
                    handStateRef={handStateRef} 
                    onContinentChange={setCurrentContinent} 
                />
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* 4. 2D Canvas Layer (Hand Skeleton) */}
      <canvas
        ref={canvas2dRef}
        className="absolute inset-0 w-full h-full z-30 pointer-events-none scale-x-[-1]" // Match video mirror
      />

      {/* 5. UI / HUD Layer */}
      <div className="absolute inset-0 z-40 p-6 flex flex-col justify-between pointer-events-none">
        {/* Top Header */}
        <header className="flex justify-between items-start">
          {/* Top Left: System Stats */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-2xl font-bold tracking-widest hud-text-shadow border-l-4 border-cyan-400 pl-3">
              <ShieldCheck className="animate-pulse" />
              SYSTEM.OS
            </div>
            <div className="text-xs text-cyan-300/70 flex flex-col">
              <span className="opacity-50">CPU LOAD: {Math.floor(Math.random() * 20) + 10}%</span>
              <span className="opacity-50">MEM ALLOC: 4096 TB</span>
              <span className="opacity-50 mt-1 text-[10px] break-words max-w-[200px]">
                {Array.from({length: 40}).map(() => Math.floor(Math.random()*16).toString(16)).join('')}
              </span>
            </div>
          </div>

          {/* Top Center: Loading State */}
          {isLoading && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <Loader2 className="w-16 h-16 animate-spin text-cyan-400" />
              <span className="mt-4 animate-pulse">INITIALIZING VISION SYSTEMS...</span>
            </div>
          )}

          {/* Top Right: Time, Branding & Controls */}
          <div className="text-right flex flex-col items-end pointer-events-auto">
            <h1 className="text-4xl font-black tracking-tighter text-cyan-100 hud-text-shadow opacity-90">
              JAVEIS
            </h1>
            <div className="text-2xl font-light mt-1 flex items-center justify-end gap-2 mb-1">
               <span>{time.toLocaleTimeString()}</span>
               <span className="text-xs border border-cyan-500 px-1 rounded bg-cyan-900/40">LIVE</span>
            </div>
            
            {/* New Pulse Animation: Digital Waveform */}
            <div className="h-8 flex items-end gap-1 mb-3">
                {[...Array(12)].map((_, i) => (
                    <div 
                        key={i} 
                        className="w-1 bg-cyan-400 opacity-80 animate-wave"
                        style={{
                            height: '30%',
                            animationDelay: `${i * 0.1}s`,
                            animationDuration: `${0.5 + Math.random() * 0.5}s`
                        }}
                    />
                ))}
            </div>

            {/* Model Upload Controls */}
            <div 
              className="flex gap-2 items-center mt-2 relative z-[1000]"
              onClick={(e) => e.stopPropagation()}
            >
                <input 
                    type="file" 
                    accept=".obj,.stl" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                />
                
                {customModelUrl ? (
                    <div className="flex items-center gap-2 bg-cyan-900/40 border border-cyan-500/50 px-3 py-1 rounded">
                        <span className="text-xs max-w-[100px] truncate">{fileName}</span>
                        <button 
                            onClick={clearCustomModel}
                            className="hover:text-cyan-200 transition-colors"
                        >
                            <XCircle size={16} />
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500 px-3 py-1 rounded text-xs transition-all uppercase font-bold tracking-wider cursor-pointer"
                    >
                        <Upload size={14} />
                        Load 3D Model
                    </button>
                )}
            </div>

          </div>
        </header>

        {/* Center-Right Draggable Panel */}
        <div className="absolute inset-0 pointer-events-auto z-50">
            {/* Only show GeoIntelPanel if no custom model is loaded */}
           {!customModelUrl && (
             <GeoIntelPanel handStateRef={handStateRef} activeContinent={currentContinent} />
           )}
        </div>

        {/* Bottom Footer */}
        <footer className="flex justify-between items-end mt-auto pointer-events-none">
          {/* Bottom Left: Hand Status */}
          <div className="bg-cyan-900/20 backdrop-blur border border-cyan-500/30 p-4 rounded-tr-2xl w-64">
             <div className="flex items-center gap-2 mb-2 border-b border-cyan-500/30 pb-1">
               <Scan size={16} />
               <span className="text-sm font-bold">手势追踪模块</span>
             </div>
             <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                   <span className="text-cyan-400">LEFT HAND (CONTROL)</span>
                   <span className={handStateRef.current.left.isDetected ? "text-green-400 font-bold" : "text-red-400"}>
                     {handStateRef.current.left.isDetected ? "ONLINE" : "SEARCHING"}
                   </span>
                </div>
                <div className="flex justify-between">
                   <span className="text-cyan-400">RIGHT HAND ({customModelUrl ? "IDLE" : "DATA"})</span>
                   <span className={handStateRef.current.right.isDetected ? "text-green-400 font-bold" : "text-red-400"}>
                     {handStateRef.current.right.isDetected ? "ONLINE" : "SEARCHING"}
                   </span>
                </div>
                <div className="mt-2 text-[10px] text-cyan-600/80">
                   提示: 左手控制旋转/缩放{ !customModelUrl && "，右手捏合拖拽数据面板"}。
                </div>
             </div>
          </div>

          {/* Bottom Right: Decorative Graph */}
          <div className="flex gap-1 items-end opacity-60">
             {[40, 60, 30, 80, 50, 90, 20, 45, 70, 30].map((h, i) => (
               <div key={i} style={{ height: `${h}px` }} className="w-2 bg-cyan-500/50 animate-pulse" />
             ))}
             <Cpu size={24} className="ml-2 mb-2 text-cyan-400" />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
