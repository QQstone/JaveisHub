
import React, { useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, Group, AdditiveBlending, BackSide, DoubleSide } from 'three';
import { Continent, SharedHandState } from '../types';

interface HoloEarthProps {
  handStateRef: React.MutableRefObject<SharedHandState>;
  onContinentChange: (continent: Continent) => void;
}

const HoloEarth: React.FC<HoloEarthProps> = ({ handStateRef, onContinentChange }) => {
  const scaleGroupRef = useRef<Group>(null);
  const earthRef = useRef<Mesh>(null);
  const cloudsRef = useRef<Mesh>(null);
  const wireframeRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  
  // Load textures
  const [colorMap, specMap, cloudsMap] = useLoader(TextureLoader, [
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
  ]);

  const [lastContinent, setLastContinent] = useState<Continent>(Continent.Unknown);

  // Smoothing / Debounce State
  const targetScaleRef = useRef(1.2);
  const currentScaleRef = useRef(1.2);

  useFrame((state, delta) => {
    if (!earthRef.current || !wireframeRef.current || !cloudsRef.current || !scaleGroupRef.current || !ringRef.current) return;

    // --- 1. Ambient Animation ---
    wireframeRef.current.rotation.y += 0.002;
    cloudsRef.current.rotation.y += 0.0015;
    // Rotate ring slowly around Y axis (if earth is upright) or Z depending on orientation
    ringRef.current.rotation.z -= 0.001; 

    const leftHand = handStateRef.current.left;
    const landmarks = handStateRef.current.landmarks.left;

    let isControlActive = false;

    // Check gesture condition: Middle(12), Ring(16), Pinky(20) must be curled
    if (leftHand.isDetected && landmarks) {
        const wrist = landmarks[0];
        
        const isFingerCurled = (tipIdx: number, pipIdx: number) => {
            const tip = landmarks[tipIdx];
            const pip = landmarks[pipIdx];
            const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            return dTip < dPip; // Tip is closer to wrist than knuckle -> Curled
        };

        // Middle (12 tip, 10 pip), Ring (16 tip, 14 pip), Pinky (20 tip, 18 pip)
        const middleCurled = isFingerCurled(12, 10);
        const ringCurled = isFingerCurled(16, 14);
        const pinkyCurled = isFingerCurled(20, 18);

        isControlActive = middleCurled && ringCurled && pinkyCurled;
    }

    // --- 2. Interaction Logic ---
    if (isControlActive && landmarks) {
      // Rotation control (XY Position)
      // Center roughly at x=0.25, y=0.5
      const targetRotY = (leftHand.position.x - 0.5) * Math.PI * 4;
      const targetRotX = (leftHand.position.y - 0.5) * Math.PI * 2;

      // Smooth rotation
      earthRef.current.rotation.y += (targetRotY - earthRef.current.rotation.y) * 5 * delta;
      earthRef.current.rotation.x += (targetRotX - earthRef.current.rotation.x) * 5 * delta;

      // --- Scale Control (Ratio Based Algorithm) ---
      const p4 = landmarks[4];
      const p8 = landmarks[8];
      const p0 = landmarks[0];
      const p9 = landmarks[9];

      const d = Math.hypot(p4.x - p8.x, p4.y - p8.y);
      const l = Math.hypot(p0.x - p9.x, p0.y - p9.y);

      // Ratio = d / l
      const rawRatio = l > 0.01 ? d / l : 0.1;
      
      // Clamp ratio to effective range [0.1, 1.0]
      const clampedRatio = Math.max(0.1, Math.min(rawRatio, 1.0));
      
      const minScale = 0.6;
      const maxScale = 2.5;
      const t = (clampedRatio - 0.1) / (1.0 - 0.1); // Normalized 0-1
      
      targetScaleRef.current = minScale + t * (maxScale - minScale);
      
      // Visual feedback for active control (brighten wireframe slightly)
      (wireframeRef.current.material as any).opacity = 0.2;

    } else {
       // Idle Auto-Rotation
       earthRef.current.rotation.y += 0.001;
       
       // Return to default idle scale slowly if not interacting
       // Note: You can comment this out if you want it to stay at the last scaled size
       targetScaleRef.current = 1.2;

       (wireframeRef.current.material as any).opacity = 0.08;
    }

    // --- 3. Anti-Shake / Smoothing (Debounce) ---
    // Use Lerp (Linear Interpolation)
    const smoothingFactor = 4 * delta;
    currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * smoothingFactor;
    
    // Apply scale to the entire group
    const s = currentScaleRef.current;
    scaleGroupRef.current.scale.set(s, s, s);

    // --- 4. Continent Detection ---
    let rotY = earthRef.current.rotation.y % (Math.PI * 2);
    if (rotY < 0) rotY += Math.PI * 2;
    const deg = (rotY * 180) / Math.PI;
    
    let current: Continent = Continent.Pacific;
    if (deg > 340 || deg < 20) current = Continent.Africa;
    else if (deg >= 20 && deg < 110) current = Continent.Asia;
    else if (deg >= 110 && deg < 200) current = Continent.Pacific;
    else if (deg >= 200 && deg < 340) current = Continent.Americas;

    if (current !== lastContinent) {
      setLastContinent(current);
      onContinentChange(current);
    }
  });

  return (
    <group position={[-1.5, 0, 0]}>
      {/* Scale Group: Contains everything that should zoom */}
      <group ref={scaleGroupRef}>
        
        {/* Planetary Rings */}
        <group rotation={[-Math.PI / 2, 0, 0]}> {/* Flat on XZ plane */}
          <mesh ref={ringRef}>
            <ringGeometry args={[1.4, 1.8, 64]} />
            <meshBasicMaterial 
              color="#00FFFF" 
              transparent 
              opacity={0.15} 
              side={DoubleSide}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* Thin accent ring */}
          <mesh>
            <ringGeometry args={[1.75, 1.8, 64]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.4} side={DoubleSide} blending={AdditiveBlending} />
          </mesh>
        </group>

        {/* Earth Surface */}
        <mesh ref={earthRef}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshPhongMaterial 
            map={colorMap} 
            specularMap={specMap}
            specular="#111111"
            emissive="#004444"
            emissiveIntensity={0.5}
            shininess={50}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
          />
        </mesh>

        {/* Clouds */}
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.02, 64, 64]} />
          <meshStandardMaterial 
            map={cloudsMap}
            transparent
            opacity={0.4}
            color="#00FFFF"
            blending={AdditiveBlending}
            depthWrite={false}
            side={BackSide} 
          />
        </mesh>

        {/* Holographic Wireframe - Reduced size to hug the sphere closer */}
        <mesh ref={wireframeRef}>
          <sphereGeometry args={[1.005, 32, 32]} />
          <meshBasicMaterial 
            color="#00FFFF" 
            wireframe 
            transparent 
            opacity={0.08} 
            blending={AdditiveBlending}
          />
        </mesh>

        {/* Atmosphere Glow */}
        <mesh scale={1.2}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial
            color="#002222"
            transparent
            opacity={0.2}
            side={BackSide}
            blending={AdditiveBlending}
          />
        </mesh>

      </group>
    </group>
  );
};

export default HoloEarth;
