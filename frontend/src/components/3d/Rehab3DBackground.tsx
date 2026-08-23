import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sphere, Torus, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// ── 1. Luminous Labs Holographic Kinematic Core & Infrared Energy Core ────────
function HolographicKinematicCore() {
  const groupRef = useRef<THREE.Group>(null)
  const outerTorusRef = useRef<THREE.Mesh>(null)
  const innerTorusRef = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.12
    }
    if (outerTorusRef.current) {
      outerTorusRef.current.rotation.z += delta * 0.2
      outerTorusRef.current.rotation.x += delta * 0.1
    }
    if (innerTorusRef.current) {
      innerTorusRef.current.rotation.y -= delta * 0.3
      innerTorusRef.current.rotation.z -= delta * 0.15
    }
  })

  return (
    <group ref={groupRef} position={[3.5, 0.5, -4]}>
      {/* Outer 660nm Red Wavelength Ring */}
      <mesh ref={outerTorusRef}>
        <torusGeometry args={[2.2, 0.025, 16, 100]} />
        <meshStandardMaterial
          color="#ff3366"
          emissive="#ff3366"
          emissiveIntensity={0.8}
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Intersecting 850nm Near-Infrared Arch */}
      <mesh ref={innerTorusRef}>
        <torusGeometry args={[1.5, 0.02, 16, 80]} />
        <meshStandardMaterial
          color="#ff758c"
          emissive="#ff758c"
          emissiveIntensity={0.9}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Floating Center Bio-Pulsar Core */}
      <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
        <Sphere args={[0.65, 32, 32]}>
          <MeshDistortMaterial
            color="#ff0055"
            emissive="#ff3366"
            emissiveIntensity={0.6}
            roughness={0.1}
            metalness={0.9}
            distort={0.45}
            speed={2.2}
            transparent
            opacity={0.5}
            wireframe
          />
        </Sphere>
      </Float>
    </group>
  )
}

// ── 2. Left Secondary Cellular Light Gyroscope ──────────────────────────────
function LeftKinematicHolo() {
  const gyroRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (gyroRef.current) {
      gyroRef.current.rotation.y -= delta * 0.1
      gyroRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.2) * 0.15
    }
  })

  return (
    <group ref={gyroRef} position={[-4, -1, -5]}>
      <Torus args={[1.8, 0.02, 16, 80]}>
        <meshStandardMaterial
          color="#ffaa00"
          emissive="#ffaa00"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.35}
        />
      </Torus>
      <Torus args={[1.2, 0.015, 16, 60]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#ff3366"
          emissive="#ff3366"
          emissiveIntensity={0.7}
          wireframe
          transparent
          opacity={0.4}
        />
      </Torus>
    </group>
  )
}

// ── 3. High-Density Photobiomodulation Particle Constellation ────────────────
function ParticleConstellation() {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 750

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const colorRed = new THREE.Color('#ff3366')
    const colorCoral = new THREE.Color('#ff758c')
    const colorAmber = new THREE.Color('#ffaa00')
    const colorInfra = new THREE.Color('#ff0055')

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      pos[i3] = (Math.random() - 0.5) * 28
      pos[i3 + 1] = (Math.random() - 0.5) * 28
      pos[i3 + 2] = (Math.random() - 0.5) * 16 - 2

      const r = Math.random()
      const chosenColor =
        r < 0.45 ? colorRed : r < 0.75 ? colorCoral : r < 0.9 ? colorAmber : colorInfra

      col[i3] = chosenColor.r
      col[i3 + 1] = chosenColor.g
      col[i3 + 2] = chosenColor.b
    }
    return [pos, col]
  }, [count])

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.02
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.04
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.065}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ── 4. Infinite Perspective Biomechanical Floor Grid ────────────────────────
function InfiniteKinematicGrid() {
  const gridRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = ((state.clock.elapsedTime * 0.4) % 2) - 8
    }
  })

  return (
    <group ref={gridRef} position={[0, -3.2, -8]} rotation={[-Math.PI / 2.3, 0, 0]}>
      <gridHelper args={[40, 40, '#ff3366', '#1a1a24']} />
    </group>
  )
}

// ── 5. Master Fixed 3D Canvas Background Component ──────────────────────────
export const Rehab3DBackground: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState(true)

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setHasWebGL(false)
    } catch {
      setHasWebGL(false)
    }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
      {/* Luminous Labs Red Light & Sunset Ambient Aura Glows */}
      <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-rose-600/15 rounded-full blur-[140px] animate-pulse-radiant" />
      <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-red-600/12 rounded-full blur-[160px] animate-pulse-radiant" />
      <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[150px]" />

      {/* 3D Three.js WebGL Scene */}
      {hasWebGL && (
        <div className="absolute inset-0 opacity-80">
          <Canvas
            camera={{ position: [0, 0, 7], fov: 55 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 12, 10]} intensity={1.5} color="#ff3366" />
            <pointLight position={[-12, -10, -5]} intensity={1.0} color="#ff758c" />
            <pointLight position={[0, 5, -8]} intensity={0.8} color="#ffaa00" />

            <ParticleConstellation />
            <HolographicKinematicCore />
            <LeftKinematicHolo />
            <InfiniteKinematicGrid />
          </Canvas>
        </div>
      )}
    </div>
  )
}
