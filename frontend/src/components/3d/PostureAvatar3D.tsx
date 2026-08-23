import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { NormalizedLandmarkList } from '@mediapipe/pose'
import { SkeletonModel } from './SkeletonModel'
import type { BiomechanicalAngles } from '../../ai/realPoseTracker'

interface PostureAvatar3DProps {
  landmarks?: NormalizedLandmarkList
  angles?: BiomechanicalAngles
  postureStatus?: 'optimal' | 'slight_deviation' | 'needs_correction'
  postureScore?: number
}

export const PostureAvatar3D: React.FC<PostureAvatar3DProps> = ({
  landmarks,
  angles,
  postureStatus = 'optimal',
  postureScore = 95,
}) => {
  return (
    <div className="relative w-full h-full min-h-[320px] rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col">
      {/* HUD Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              postureStatus === 'optimal'
                ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                : postureStatus === 'slight_deviation'
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
            }`}
          />
          <span className="text-xs font-mono tracking-wider uppercase text-cyan-300 font-semibold">
            3D Biomechanical Wireframe
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800">
          <span className="text-[11px] text-slate-400">Alignment:</span>
          <span
            className={`text-xs font-bold font-mono ${
              postureScore >= 85
                ? 'text-cyan-400'
                : postureScore >= 70
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {postureScore}%
          </span>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 w-full h-full">
        <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[5, 5, 5]} intensity={1} color="#38bdf8" />
          <pointLight position={[-5, -5, -5]} intensity={0.4} color="#06b6d4" />
          <SkeletonModel landmarks={landmarks} postureStatus={postureStatus} />
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            maxPolarAngle={Math.PI / 1.8}
            minPolarAngle={Math.PI / 3}
          />
        </Canvas>
      </div>

      {/* Real-time Angle Telemetry Ticker */}
      {angles && (
        <div className="absolute bottom-2 left-2 right-2 z-10 grid grid-cols-3 gap-1 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-300">
          <div className="text-center">
            <span className="text-slate-500 block">CVA</span>
            <span className="font-bold text-cyan-300">{angles.craniovertebralAngle}°</span>
          </div>
          <div className="text-center border-x border-slate-800">
            <span className="text-slate-500 block">Trunk Lean</span>
            <span className="font-bold text-cyan-300">{angles.trunkLeanAngle}°</span>
          </div>
          <div className="text-center">
            <span className="text-slate-500 block">Shoulder Δ</span>
            <span className="font-bold text-cyan-300">{angles.shoulderBalanceDelta}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
