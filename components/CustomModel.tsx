
import React, { useRef, useLayoutEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three-stdlib';
import { STLLoader } from 'three-stdlib';
import { Group, Mesh, Box3, Vector3, BufferGeometry, AdditiveBlending, DoubleSide } from 'three';
import { SharedHandState } from '../types';

interface CustomModelProps {
  url: string;
  type: 'obj' | 'stl';
  handStateRef: React.MutableRefObject<SharedHandState>;
}

const CustomModel: React.FC<CustomModelProps> = ({ url, type, handStateRef }) => {
  const object = useLoader(type === 'obj' ? OBJLoader : STLLoader, url) as any;
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const scaleGroupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);

  // Normalization State
  const [modelScale, setModelScale] = useState(1);
  
  // Smoothing / Debounce State
  const targetScaleRef = useRef(1.2);
  const currentScaleRef = useRef(1.2);

  // Normalize Geometry on Load
  useLayoutEffect(() => {
    if (!object) return;

    // Logic differs slightly between OBJ (Group) and STL (BufferGeometry)
    let geometry: BufferGeometry | null = null;

    if (type === 'stl') {
        geometry = object;
        if (geometry) geometry.center();
    } else {
        // For OBJ, traverse to find the first mesh geometry or handle group
        object.traverse((child: any) => {
            if (child.isMesh) {
                // Apply holographic material settings to all meshes
                child.material.wireframe = true;
                child.material.color.set('#00FFFF');
                child.material.transparent = true;
                child.material.opacity = 0.3;
                child.material.blending = AdditiveBlending;
                child.material.side = DoubleSide;
                
                if (!geometry) geometry = child.geometry;
            }
        });
    }

    // Calculate Bounding Box to normalize scale
    const box = new Box3().setFromObject(type === 'obj' ? object : new Mesh(object));
    const size = new Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // We want the model to be roughly size 2.0 (radius 1.0)
    if (maxDim > 0) {
        setModelScale(2.0 / maxDim);
    }

  }, [object, type]);

  useFrame((state, delta) => {
    if (!scaleGroupRef.current || !groupRef.current || !ringRef.current) return;

    // Ambient Rotation
    ringRef.current.rotation.z -= 0.002;

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

    // --- Interaction Logic (Same as Earth) ---
    if (isControlActive && landmarks) {
      // Rotation control
      const targetRotY = (leftHand.position.x - 0.5) * Math.PI * 4;
      const targetRotX = (leftHand.position.y - 0.5) * Math.PI * 2;

      // Smooth rotation
      groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * 5 * delta;
      groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 5 * delta;

      // Scale Control
      const p4 = landmarks[4];
      const p8 = landmarks[8];
      const p0 = landmarks[0];
      const p9 = landmarks[9];

      const d = Math.hypot(p4.x - p8.x, p4.y - p8.y);
      const l = Math.hypot(p0.x - p9.x, p0.y - p9.y);

      const rawRatio = l > 0.01 ? d / l : 0.1;
      const clampedRatio = Math.max(0.1, Math.min(rawRatio, 1.0));
      
      const minScale = 0.5;
      const maxScale = 3.0;
      const t = (clampedRatio - 0.1) / (1.0 - 0.1); 
      
      targetScaleRef.current = minScale + t * (maxScale - minScale);
    } else {
       // Idle Auto-Rotation
       groupRef.current.rotation.y += 0.005;
       // Reset scale when idle
       targetScaleRef.current = 1.2;
    }

    // Anti-Shake Smoothing
    const smoothingFactor = 4 * delta;
    currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * smoothingFactor;
    
    // Apply scale to the entire group
    const s = currentScaleRef.current;
    scaleGroupRef.current.scale.set(s, s, s);
  });

  return (
     <group position={[-1.5, 0, 0]}>
        <group ref={scaleGroupRef}>
             {/* Decorative Ring */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
                <mesh ref={ringRef}>
                    <ringGeometry args={[1.4, 1.5, 64]} />
                    <meshBasicMaterial 
                        color="#00FFFF" 
                        transparent 
                        opacity={0.3} 
                        side={DoubleSide}
                        blending={AdditiveBlending}
                    />
                </mesh>
            </group>

            {/* The Loaded Model */}
            <group ref={groupRef}>
                {type === 'obj' ? (
                    <primitive object={object} scale={[modelScale, modelScale, modelScale]} />
                ) : (
                    <mesh ref={meshRef} geometry={object} scale={[modelScale, modelScale, modelScale]}>
                         <meshStandardMaterial 
                            color="#00FFFF" 
                            wireframe
                            transparent
                            opacity={0.5}
                            blending={AdditiveBlending}
                        />
                    </mesh>
                )}
            </group>
        </group>
     </group>
  );
};

export default CustomModel;
