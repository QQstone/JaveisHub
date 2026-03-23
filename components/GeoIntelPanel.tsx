import React, { useRef, useEffect, useState } from 'react';
import { SharedHandState, Continent } from '../types';
import { Activity, Globe, Wifi, Database } from 'lucide-react';

interface GeoIntelPanelProps {
  handStateRef: React.MutableRefObject<SharedHandState>;
  activeContinent: Continent;
}

const GeoIntelPanel: React.FC<GeoIntelPanelProps> = ({ handStateRef, activeContinent }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 70, y: 20 }); // Percentage
  const [isDragging, setIsDragging] = useState(false);

  // Generate some fake data based on continent
  const getIntelData = (c: Continent) => {
    switch (c) {
      case Continent.Americas: return { population: '1.02B', threat: 'Low', net: 'SECURE' };
      case Continent.Asia: return { population: '4.56B', threat: 'Moderate', net: 'ACTIVE' };
      case Continent.Europe: return { population: '747M', threat: 'Low', net: 'STABLE' };
      case Continent.Africa: return { population: '1.21B', threat: 'High', net: 'WARN' };
      default: return { population: '---', threat: '---', net: 'SCANNING' };
    }
  };

  const data = getIntelData(activeContinent);

  useEffect(() => {
    let animationFrameId: number;

    const updateLoop = () => {
      const rightHand = handStateRef.current.right;
      
      if (rightHand.isDetected && rightHand.isPinching) {
        setIsDragging(true);
        // Map normalized coordinates (0-1) to CSS percentage
        // Invert X because webcam is mirrored usually, but let's assume raw coords are correct for screen
        // If x is 0 (left) to 1 (right).
        const newX = Math.min(Math.max(rightHand.position.x * 100, 40), 90); // Constrain to right side
        const newY = Math.min(Math.max(rightHand.position.y * 100, 10), 80);

        setPosition({ x: newX, y: newY });
      } else {
        setIsDragging(false);
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div 
      ref={panelRef}
      style={{ 
        left: `${position.x}%`, 
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
      className={`absolute w-80 bg-black/60 border border-cyan-500/50 backdrop-blur-sm p-4 rounded-lg transition-colors duration-100 ${isDragging ? 'border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.4)]' : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-cyan-500/30 pb-2">
        <h3 className="text-cyan-400 font-mono font-bold flex items-center gap-2">
          <Globe size={18} />
          地理情报分析
        </h3>
        <div className={`w-3 h-3 rounded-full ${isDragging ? 'bg-cyan-400 animate-ping' : 'bg-cyan-900'}`} />
      </div>

      {/* Content */}
      <div className="space-y-4 font-mono text-sm text-cyan-100/80">
        <div className="flex justify-between">
          <span className="text-cyan-600">目标区域:</span>
          <span className="text-cyan-300 font-bold hud-text-shadow">{activeContinent}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-cyan-900/20 p-2 rounded border border-cyan-500/20">
            <div className="text-xs text-cyan-600 flex items-center gap-1"><Activity size={10} /> 人口密度</div>
            <div className="text-lg font-bold">{data.population}</div>
          </div>
          <div className="bg-cyan-900/20 p-2 rounded border border-cyan-500/20">
            <div className="text-xs text-cyan-600 flex items-center gap-1"><Wifi size={10} /> 网络状态</div>
            <div className="text-lg font-bold">{data.net}</div>
          </div>
        </div>

        <div className="bg-cyan-900/10 p-2 rounded border-l-2 border-cyan-500">
          <div className="text-xs text-cyan-600 mb-1 flex items-center gap-1"><Database size={10} /> 实时扫描流</div>
          <div className="h-16 overflow-hidden relative">
            <div className="absolute inset-0 animate-scanline bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent opacity-50"></div>
            <p className="text-[10px] leading-tight opacity-70 break-all font-mono">
              0x4A 0x12 SECURE CONNECTION ESTABLISHED
              ANALYZING TERRAIN DATA... 98%
              BIOMETRIC SIGNATURE DETECTED
              LAT: 34.55 LON: 12.33
              SYNC COMPLETE.
            </p>
          </div>
        </div>
      </div>

      {/* Decoration corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500"></div>
    </div>
  );
};

export default GeoIntelPanel;