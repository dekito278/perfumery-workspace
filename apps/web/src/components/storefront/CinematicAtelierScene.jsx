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
    <group ref={groupRef} position={[1.55, -0.18, -0.12]} scale={[0.86, 0.86, 0.86]}>
      <mesh castShadow receiveShadow position={[0, -0.15, 0]}>
        <boxGeometry args={[1.28, 2.05, 0.46, 8, 8, 8]} />
        <meshPhysicalMaterial
          color="#dfe7d7"
          roughness={0.08}
          metalness={0}
          transmission={0.74}
          thickness={0.75}
          transparent
          opacity={0.58}
          clearcoat={1}
          clearcoatRoughness={0.05}
          ior={1.45}
        />
      </mesh>
      <mesh position={[0, -0.72, 0.01]}>
        <boxGeometry args={[1.12, 0.82, 0.38, 8, 8, 8]} />
        <meshPhysicalMaterial color="#9c8759" roughness={0.22} metalness={0.08} transparent opacity={0.42} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.36, 48]} />
        <meshStandardMaterial color="#b19a62" roughness={0.2} metalness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.42, 48]} />
        <meshStandardMaterial color="#1d261e" roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.1, 0.245]}>
        <planeGeometry args={[0.9, 0.72]} />
        <meshBasicMaterial color="#f6f0e3" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.1, 0.248]}>
        <planeGeometry args={[0.66, 0.04]} />
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
    [2.62, 1.0, -1.1, 0.42],
    [3.18, 0.28, -1.25, 0.36],
    [2.35, -1.22, -0.65, 0.34],
    [3.45, -0.74, -0.6, 0.38],
  ]), []);

  return (
    <group ref={groupRef}>
      {vials.map(([x, y, z, scale], index) => (
        <Float key={`${x}-${y}`} speed={0.75 + index * 0.08} rotationIntensity={0.18} floatIntensity={0.34}>
          <group position={[x, y, z]} scale={scale}>
            <mesh castShadow>
              <cylinderGeometry args={[0.18, 0.2, 0.72, 32]} />
              <meshPhysicalMaterial color="#e7eadf" roughness={0.05} transmission={0.58} thickness={0.32} transparent opacity={0.48} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <cylinderGeometry args={[0.17, 0.18, 0.27, 32]} />
              <meshStandardMaterial color={index % 2 ? '#6e7a53' : '#b28d57'} roughness={0.35} transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0.47, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.16, 32]} />
              <meshStandardMaterial color="#b69b66" roughness={0.25} metalness={0.55} />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  );
};

const AtmosphericParticles = () => {
  const pointsRef = useRef(null);
  const materialRef = useRef(null);
  const count = 760;

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
        gl_PointSize = (3.6 + vDepth * 2.8) * (1.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vDepth;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d) * 0.46 * vDepth;
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
    dpr={[1, 1.6]}
    camera={{ position: [0, 0, 5.25], fov: 38 }}
    shadows
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
  >
    <color attach="background" args={['#070906']} />
    <fog attach="fog" args={['#070906', 4.2, 8.7]} />
    <ambientLight intensity={0.42} />
    <directionalLight castShadow position={[-3.6, 4.2, 3.4]} intensity={2.2} shadow-mapSize={[1024, 1024]} />
    <pointLight position={[3.2, 1.4, 2.4]} intensity={1.2} color="#d8bd7b" />
    <pointLight position={[-2.8, -1.4, 1.8]} intensity={0.8} color="#aab899" />
    <SceneRig />
    <AtmosphericParticles />
    <RawMaterialVials />
    <Float speed={0.58} rotationIntensity={0.08} floatIntensity={0.18}>
      <PerfumeBottle />
    </Float>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
      <planeGeometry args={[7.2, 7.2]} />
      <shadowMaterial color="#000000" opacity={0.28} />
    </mesh>
  </Canvas>
);

export default CinematicAtelierScene;
