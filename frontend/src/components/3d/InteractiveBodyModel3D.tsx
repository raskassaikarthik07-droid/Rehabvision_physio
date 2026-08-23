import React, { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Cylinder, Ring } from '@react-three/drei'
import * as THREE from 'three'
import { Sparkles, RotateCw } from 'lucide-react'

interface JointBeaconProps {
  position: [number, number, number]
  name?: string
  score: number
  active: boolean
  onClick: () => void
}

function JointBeacon({ position, score, active, onClick }: JointBeaconProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(active ? 1.3 + Math.sin(state.clock.elapsedTime * 4) * 0.15 : 1)
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color={active ? '#ff3366' : score > 90 ? '#ff758c' : '#ffaa00'}
          emissive={active ? '#ff3366' : '#ff758c'}
          emissiveIntensity={active ? 2.0 : 1.0}
        />
      </mesh>
      {/* Outer Pulse Ring */}
      <Ring args={[0.11, 0.14, 32]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={active ? '#ff3366' : '#ff758c'}
          transparent
          opacity={active ? 0.9 : 0.5}
          side={THREE.DoubleSide}
        />
      </Ring>
    </group>
  )
}

function HolographicAnatomyModel({
  selectedJoint,
  setSelectedJoint,
}: {
  selectedJoint: string
  setSelectedJoint: (name: string) => void
}) {
  const modelGroupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.y += delta * 0.12
    }
  })

  return (
    <group ref={modelGroupRef} position={[0, -0.4, 0]}>
      {/* Head */}
      <Sphere args={[0.22, 24, 24]} position={[0, 1.55, 0]}>
        <meshStandardMaterial
          color="#ff3366"
          emissive="#ff3366"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.65}
        />
      </Sphere>

      {/* Spine / Torso Wireframe Cylinder */}
      <Cylinder args={[0.26, 0.2, 1.0, 16, 4, true]} position={[0, 0.85, 0]}>
        <meshStandardMaterial
          color="#ff758c"
          emissive="#ff758c"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.55}
        />
      </Cylinder>

      {/* Pelvis Core */}
      <Sphere args={[0.22, 16, 16]} position={[0, 0.25, 0]}>
        <meshStandardMaterial color="#ff2a5f" wireframe transparent opacity={0.55} />
      </Sphere>

      {/* Left & Right Shoulders */}
      <Cylinder args={[0.04, 0.04, 0.5, 8]} position={[-0.45, 1.25, 0]} rotation={[0, 0, Math.PI / 3]}>
        <meshStandardMaterial color="#ff3366" wireframe />
      </Cylinder>
      <Cylinder args={[0.04, 0.04, 0.5, 8]} position={[0.45, 1.25, 0]} rotation={[0, 0, -Math.PI / 3]}>
        <meshStandardMaterial color="#ff3366" wireframe />
      </Cylinder>

      {/* Left & Right Forearms */}
      <Cylinder args={[0.035, 0.035, 0.45, 8]} position={[-0.7, 0.85, 0]}>
        <meshStandardMaterial color="#ff758c" wireframe />
      </Cylinder>
      <Cylinder args={[0.035, 0.035, 0.45, 8]} position={[0.7, 0.85, 0]}>
        <meshStandardMaterial color="#ff758c" wireframe />
      </Cylinder>

      {/* Upper Legs */}
      <Cylinder args={[0.06, 0.05, 0.65, 8]} position={[-0.22, -0.15, 0]}>
        <meshStandardMaterial color="#ff758c" wireframe />
      </Cylinder>
      <Cylinder args={[0.06, 0.05, 0.65, 8]} position={[0.22, -0.15, 0]}>
        <meshStandardMaterial color="#ff758c" wireframe />
      </Cylinder>

      {/* Lower Legs (Shins) */}
      <Cylinder args={[0.05, 0.04, 0.65, 8]} position={[-0.22, -0.85, 0]}>
        <meshStandardMaterial color="#ff3366" wireframe />
      </Cylinder>
      <Cylinder args={[0.05, 0.04, 0.65, 8]} position={[0.22, -0.85, 0]}>
        <meshStandardMaterial color="#ff3366" wireframe />
      </Cylinder>

      {/* Interactive Joint Beacons */}
      <JointBeacon
        position={[0, 1.35, 0.1]}
        name="Cervical Spine (Neck)"
        score={95}
        active={selectedJoint === 'Cervical Spine (Neck)'}
        onClick={() => setSelectedJoint('Cervical Spine (Neck)')}
      />
      <JointBeacon
        position={[-0.55, 1.35, 0.05]}
        name="Left Shoulder"
        score={92}
        active={selectedJoint === 'Left Shoulder'}
        onClick={() => setSelectedJoint('Left Shoulder')}
      />
      <JointBeacon
        position={[0.55, 1.35, 0.05]}
        name="Right Shoulder"
        score={94}
        active={selectedJoint === 'Right Shoulder'}
        onClick={() => setSelectedJoint('Right Shoulder')}
      />
      <JointBeacon
        position={[0, 0.8, 0.15]}
        name="Thoracic & Torso Bend"
        score={90}
        active={selectedJoint === 'Thoracic & Torso Bend'}
        onClick={() => setSelectedJoint('Thoracic & Torso Bend')}
      />
      <JointBeacon
        position={[-0.22, -0.5, 0.08]}
        name="Left Knee & Quadriceps"
        score={96}
        active={selectedJoint === 'Left Knee & Quadriceps'}
        onClick={() => setSelectedJoint('Left Knee & Quadriceps')}
      />
      <JointBeacon
        position={[0.22, -0.5, 0.08]}
        name="Right Knee & Quadriceps"
        score={97}
        active={selectedJoint === 'Right Knee & Quadriceps'}
        onClick={() => setSelectedJoint('Right Knee & Quadriceps')}
      />
    </group>
  )
}

export const InteractiveBodyModel3D: React.FC = () => {
  const [selectedJoint, setSelectedJoint] = useState<string>('Left Knee & Quadriceps')

  const jointDetails: Record<string, { rom: string; score: number; status: string; note: string }> = {
    'Left Knee & Quadriceps': {
      rom: '168° / 170° Extension',
      score: 96,
      status: 'Optimal Biomechanical Strength',
      note: 'Prescribed seated extension routine restoring terminal quad activation.',
    },
    'Right Knee & Quadriceps': {
      rom: '170° / 170° Extension',
      score: 97,
      status: 'Full Functional Recovery',
      note: 'Bilateral symmetry verified across all recorded sessions.',
    },
    'Left Shoulder': {
      rom: '92° / 90° Abduction',
      score: 92,
      status: 'Scapular Mobility Active',
      note: 'Gentle arm raises maintaining rotator cuff stability.',
    },
    'Right Shoulder': {
      rom: '95° / 90° Abduction',
      score: 94,
      status: 'Optimal Range of Motion',
      note: 'Zero pain reported during elevation cycles.',
    },
    'Cervical Spine (Neck)': {
      rom: '52° Craniovertebral Angle',
      score: 95,
      status: 'Neutral Cervical Alignment',
      note: 'CVA posture tracking confirms reduction in forward head slouching.',
    },
    'Thoracic & Torso Bend': {
      rom: '42° / 45° Inclination',
      score: 90,
      status: 'Stable Trunk Axis',
      note: 'Controlled trunk stability with upright spine compliance.',
    },
  }

  const current = jointDetails[selectedJoint] || jointDetails['Left Knee & Quadriceps']

  return (
    <div className="luminous-glass-card p-7 md:p-9 border-rose-500/40 flex flex-col lg:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
      {/* 3D WebGL Canvas Interactive Viewport */}
      <div className="relative w-full lg:w-1/2 h-80 lg:h-96 bg-zinc-950/90 rounded-3xl border border-zinc-800 overflow-hidden">
        <div className="absolute top-3.5 left-4 z-10 flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-mono text-rose-300 font-extrabold uppercase tracking-wider">
            Interactive 3D Kinematic Model &bull; Rotate &amp; Click Joints
          </span>
        </div>

        <Canvas camera={{ position: [0, 0.4, 3.2], fov: 48 }}>
          <ambientLight intensity={0.7} />
          <pointLight position={[5, 8, 5]} intensity={1.8} color="#ff3366" />
          <pointLight position={[-5, -5, -3]} intensity={1.0} color="#ff758c" />
          <HolographicAnatomyModel
            selectedJoint={selectedJoint}
            setSelectedJoint={setSelectedJoint}
          />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 1.7}
            minPolarAngle={Math.PI / 2.5}
          />
        </Canvas>

        <div className="absolute bottom-3.5 right-4 z-10 flex items-center space-x-2 text-xs font-mono text-zinc-400 bg-zinc-900/90 px-3 py-1.5 rounded-full border border-zinc-800">
          <RotateCw className="w-3.5 h-3.5 text-rose-400 animate-spin" />
          <span>Drag to Orbit</span>
        </div>
      </div>

      {/* Joint Telemetry Inspector Card */}
      <div className="w-full lg:w-1/2 space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <span className="text-xs font-mono font-extrabold uppercase text-rose-400 tracking-wider block">
              Selected Anatomical Focus
            </span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mt-0.5">{selectedJoint}</h3>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-mono font-extrabold">
            {current.score}% Form Score
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <span className="text-xs text-zinc-400 font-mono block">Range of Motion (ROM)</span>
            <span className="text-lg font-extrabold text-rose-300 font-mono mt-0.5 block">{current.rom}</span>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <span className="text-xs text-zinc-400 font-mono block">Clinical Status</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">{current.status}</span>
          </div>
        </div>

        <p className="text-sm text-zinc-200 bg-rose-950/20 p-4 rounded-2xl border border-rose-500/25 leading-relaxed font-normal">
          💡 <strong className="text-rose-300 font-bold">Biomechanical Note:</strong> {current.note}
        </p>

        <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>Click any glowing joint beacon on the 3D hologram to inspect real-time telemetry.</span>
        </div>
      </div>
    </div>
  )
}
