import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Environment, Lightformer, Float } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';

interface StlViewerProps {
  fileUrl: string;
  color?: string;
  rawSizeMm?: { x: number; y: number; z: number }; // bounding box in mm passed from parent
  scale?: number;
}

// Loads, centres and sits the model on y=0
const StlModel: React.FC<{ url: string; color: string; scale?: number }> = ({ url, color, scale = 1 }) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, controls } = useThree();

  useEffect(() => {
    setGeometry(null); // clear previous model
    const loader = new STLLoader();
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const center = new THREE.Vector3();
      geo.boundingBox!.getCenter(center);
      geo.translate(-center.x, -center.y, -center.z);
      
      // Apply scale
      geo.scale(scale, scale, scale);
      
      geo.computeBoundingBox();
      const minY = geo.boundingBox!.min.y;
      geo.translate(0, -minY, 0);
      setGeometry(geo);
    });
  }, [url, scale]);

  useEffect(() => {
    if (!geometry || !meshRef.current) return;
    const box = new THREE.Box3().setFromObject(meshRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.8;
    camera.position.set(dist * 0.8, dist * 0.55, dist * 1.1);
    camera.near = maxDim * 0.001;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();
    (controls as any)?.target?.set(0, size.y / 2, 0);
    (controls as any)?.update?.();
  }, [geometry, camera, controls]);

  if (!geometry) return null;
  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial 
        color={color} 
        roughness={0.3} 
        metalness={0.8} 
        envMapIntensity={1}
      />
    </mesh>
  );
};

// Wireframe bounding box drawn from pre-computed size (no re-parsing)
const BoundingBox: React.FC<{ sizeMm: { x: number; y: number; z: number } }> = ({ sizeMm }) => {
  const halfY = sizeMm.y / 2;
  return (
    <mesh position={[0, halfY, 0]}>
      <boxGeometry args={[sizeMm.x, sizeMm.y, sizeMm.z]} />
      <meshBasicMaterial color="#f97316" wireframe transparent opacity={0.25} />
    </mesh>
  );
};

// Adaptive grid helper that scales to the model
const AdaptiveGrid: React.FC<{ size: number }> = ({ size }) => {
  const gridRef = useRef<THREE.GridHelper>(null);
  const divisions = 20;
  const gridSize = size * 4;
  return (
    <gridHelper
      ref={gridRef}
      args={[gridSize, divisions, '#f97316', '#1e293b']}
      position={[0, -0.05, 0]}
    />
  );
};

// Keeps a WebGL failure (old GPU, disabled hardware acceleration) inside the preview box
// instead of unmounting the whole order page.
class ViewerErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('3D preview unavailable:', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-sm text-slate-300">
          3D preview isn't available on this device. You can still place the order.
        </div>
      );
    }
    return this.props.children;
  }
}

export const StlViewer: React.FC<StlViewerProps> = (props) => (
  <ViewerErrorBoundary>
    <StlViewerCanvas {...props} />
  </ViewerErrorBoundary>
);

const StlViewerCanvas: React.FC<StlViewerProps> = ({
  fileUrl,
  color = '#e2e8f0',
  rawSizeMm,
  scale = 1,
}) => {
  const maxDim = rawSizeMm
    ? Math.max(rawSizeMm.x, rawSizeMm.y, rawSizeMm.z)
    : 100;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-900">
      <Canvas
        key={fileUrl} /* remount canvas on new file to avoid WebGL state leaks */
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [150, 100, 200], fov: 45, near: 0.01, far: 100000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0f172a']} />

        {/* Lights */}
        <ambientLight intensity={0.4} />
        <spotLight position={[200, 400, 200]} intensity={1.5} angle={0.3} penumbra={1} castShadow />
        <pointLight position={[-100, 200, -100]} intensity={0.5} color="#93c5fd" />

        {/* Reflections built from local light panels. A preset would download an HDR
            from a public CDN at runtime, and a failed download blanked the whole page. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 0.5, 1]} />
          <Lightformer intensity={1} rotation-y={-Math.PI / 2} position={[5, 1, 1]} scale={[20, 0.5, 1]} />
        </Environment>

        {/* Shadow receiver */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.1, 0]}>
          <planeGeometry args={[maxDim * 10, maxDim * 10]} />
          <shadowMaterial transparent opacity={0.35} />
        </mesh>

        {/* Adaptive grid - sized to the model */}
        <AdaptiveGrid size={maxDim} />

        {/* Model */}
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <StlModel url={fileUrl} color={color} scale={scale} />
        </Float>

        {/* Bounding box from pre-computed data - no re-parse */}
        {rawSizeMm && <BoundingBox sizeMm={{ x: rawSizeMm.x * scale, y: rawSizeMm.y * scale, z: rawSizeMm.z * scale }} />}

        <OrbitControls
          makeDefault
          autoRotate={false}
          enableDamping
          dampingFactor={0.08}
        />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-3 select-none rounded-md bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">
        🖱️ Drag · Scroll to zoom · Right-drag to pan
      </div>
    </div>
  );
};
