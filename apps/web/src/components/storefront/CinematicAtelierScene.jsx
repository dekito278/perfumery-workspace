/* eslint-disable react/no-unknown-property */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';

const PerfumeBottle = () => {
  const groupRef = useRef(null);
  const { pointer } = useThree();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.28) * 0.2 + pointer.x * 0.16;
    groupRef.current.rotation.x = -0.08 + pointer.y * 0.06;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.48) * 0.08;
  });

  return (
    <group ref={groupRef} position={[1.78, -0.2, -0.12]} scale={[0.76, 0.76, 0.76]}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[1.2, 1.94, 0.42, 6, 6, 4]} />
        <meshPhysicalMaterial
          color="#d6ded0"
          roughness={0.12}
          metalness={0}
          transmission={0.45}
          thickness={0.48}
          transparent
          opacity={0.54}
          clearcoat={1}
          clearcoatRoughness={0.05}
          ior={1.45}
        />
      </mesh>
      <mesh position={[0, -0.72, 0.01]}>
        <boxGeometry args={[1.03, 0.72, 0.36, 4, 4, 3]} />
        <meshPhysicalMaterial color="#9c8759" roughness={0.28} metalness={0.06} transparent opacity={0.36} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.34, 32]} />
        <meshStandardMaterial color="#b19a62" roughness={0.2} metalness={0.72} />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.17, 0.19, 0.4, 32]} />
        <meshStandardMaterial color="#1d261e" roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh position={[-0.37, 0.14, 0.222]} rotation={[0, 0, -0.04]}>
        <planeGeometry args={[0.08, 1.42]} />
        <meshBasicMaterial color="#f7f3e8" transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.1, 0.245]}>
        <planeGeometry args={[0.72, 0.58]} />
        <meshBasicMaterial color="#f6f0e3" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, 0.1, 0.248]}>
        <planeGeometry args={[0.48, 0.035]} />
        <meshBasicMaterial color="#273d28" transparent opacity={0.62} />
      </mesh>
    </group>
  );
};

const RawMaterialVials = () => {
  const groupRef = useRef(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      child.rotation.y = clock.elapsedTime * 0.2 + index;
      child.position.y += Math.sin(clock.elapsedTime * 0.7 + index) * 0.0009;
    });
  });

  const vials = useMemo(() => ([
    [2.78, 0.96, -1.1, 0.34],
    [3.3, 0.18, -1.25, 0.28],
    [2.6, -1.18, -0.65, 0.28],
  ]), []);

  return (
    <group ref={groupRef}>
      {vials.map(([x, y, z, scale], index) => (
        <group key={`${x}-${y}`} position={[x, y, z]} scale={scale}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.2, 0.72, 20]} />
            <meshPhysicalMaterial color="#e7eadf" roughness={0.08} transmission={0.38} thickness={0.24} transparent opacity={0.44} />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.17, 0.18, 0.27, 20]} />
            <meshStandardMaterial color={index % 2 ? '#6e7a53' : '#b28d57'} roughness={0.35} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, 0.47, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.16, 20]} />
            <meshStandardMaterial color="#b69b66" roughness={0.25} metalness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const AtmosphericParticles = () => {
  const pointsRef = useRef(null);
  const materialRef = useRef(null);
  const count = 360;

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      array[index * 3] = (Math.random() - 0.5) * 8.8;
      array[index * 3 + 1] = (Math.random() - 0.5) * 4.8;
      array[index * 3 + 2] = (Math.random() - 0.5) * 4.2;
    }
    return array;
  }, []);

  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#d7c38c') },
    },
    vertexShader: `
      uniform float uTime;
      varying float vDepth;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.28 + position.x * 1.6) * 0.08;
        p.x += cos(uTime * 0.2 + position.y * 1.2) * 0.035;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        vDepth = smoothstep(-4.0, 2.0, mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (3.0 + vDepth * 2.2) * (1.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vDepth;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d) * 0.38 * vDepth;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.elapsedTime * 0.018;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <primitive ref={materialRef} object={shaderMaterial} attach="material" />
    </points>
  );
};

const SceneRig = () => {
  const { camera, pointer } = useThree();

  useFrame(({ clock }) => {
    camera.position.x += (pointer.x * 0.18 - camera.position.x) * 0.025;
    camera.position.y += (pointer.y * 0.12 - camera.position.y) * 0.02;
    camera.position.z = 5.2 + Math.sin(clock.elapsedTime * 0.22) * 0.08;
    camera.lookAt(0, 0, 0);
  });

  return null;
};

const CinematicAtelierScene = () => (
  <Canvas
    style={{ width: '100%', height: '100%' }}
    dpr={[1, 1.2]}
    camera={{ position: [0, 0, 5.25], fov: 38 }}
    gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
  >
    <color attach="background" args={['#070906']} />
    <fog attach="fog" args={['#070906', 4.2, 8.7]} />
    <ambientLight intensity={0.48} />
    <directionalLight position={[-3.6, 4.2, 3.4]} intensity={2.25} />
    <pointLight position={[3.2, 1.4, 2.4]} intensity={1.2} color="#d8bd7b" />
    <pointLight position={[-2.8, -1.4, 1.8]} intensity={0.8} color="#aab899" />
    <spotLight position={[0.6, 2.8, 3.4]} angle={0.34} penumbra={0.8} intensity={1.1} color="#fff4d6" />
    <SceneRig />
    <AtmosphericParticles />
    <RawMaterialVials />
    <Float speed={0.58} rotationIntensity={0.08} floatIntensity={0.18}>
      <PerfumeBottle />
    </Float>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
      <planeGeometry args={[7.2, 7.2]} />
      <meshBasicMaterial color="#050705" transparent opacity={0.38} />
    </mesh>
  </Canvas>
);

export default CinematicAtelierScene;
