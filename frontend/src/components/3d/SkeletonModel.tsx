import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { NormalizedLandmarkList } from '@mediapipe/pose'
import { LM } from '../../ai/realPoseTracker'

interface SkeletonModelProps {
  landmarks?: NormalizedLandmarkList
  postureStatus?: 'optimal' | 'slight_deviation' | 'needs_correction'
}

const CONNECTIONS = [
  // Head & Neck
  [LM.NOSE, LM.LEFT_EAR],
  [LM.NOSE, LM.RIGHT_EAR],
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  // Arms
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  // Torso / Spine
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  // Legs
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
]

export const SkeletonModel: React.FC<SkeletonModelProps> = ({
  landmarks,
  postureStatus = 'optimal',
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const themeColor =
    postureStatus === 'optimal'
      ? '#06b6d4'
      : postureStatus === 'slight_deviation'
      ? '#f59e0b'
      : '#ef4444'

  // Compute reference center of mass (mid-shoulder or nose) for auto-framing
  const centerOffsetY = useMemo(() => {
    if (!landmarks || landmarks.length === 0) return 0
    const lSh = landmarks[LM.LEFT_SHOULDER]
    const rSh = landmarks[LM.RIGHT_SHOULDER]
    const nose = landmarks[LM.NOSE]

    if (lSh && rSh && (lSh.visibility ?? 0) > 0.4) {
      const avgY = (lSh.y + rSh.y) / 2
      return (avgY - 0.4) * 3.0
    }
    if (nose && (nose.visibility ?? 0) > 0.4) {
      return (nose.y - 0.25) * 3.0
    }
    return 0
  }, [landmarks])

  const getPoint = (index: number): [number, number, number] => {
    const defaultPos: Record<number, [number, number, number]> = {
      [LM.NOSE]: [0, 0.85, 0],
      [LM.LEFT_EAR]: [-0.2, 0.88, -0.05],
      [LM.RIGHT_EAR]: [0.2, 0.88, -0.05],
      [LM.LEFT_SHOULDER]: [-0.42, 0.55, 0],
      [LM.RIGHT_SHOULDER]: [0.42, 0.55, 0],
      [LM.LEFT_ELBOW]: [-0.62, 0.15, 0],
      [LM.RIGHT_ELBOW]: [0.62, 0.15, 0],
      [LM.LEFT_WRIST]: [-0.7, -0.25, 0],
      [LM.RIGHT_WRIST]: [0.7, -0.25, 0],
      [LM.LEFT_HIP]: [-0.25, -0.15, 0],
      [LM.RIGHT_HIP]: [0.25, -0.15, 0],
      [LM.LEFT_KNEE]: [-0.25, -0.7, 0],
      [LM.RIGHT_KNEE]: [0.25, -0.7, 0],
      [LM.LEFT_ANKLE]: [-0.25, -1.25, 0],
      [LM.RIGHT_ANKLE]: [0.25, -1.25, 0],
    }

    if (!landmarks || !landmarks[index] || (landmarks[index].visibility ?? 0) < 0.25) {
      return defaultPos[index] || [0, 0, 0]
    }

    const lm = landmarks[index]
    // Invert X for mirror, center around Y offset
    const x = -(lm.x - 0.5) * 3.2
    const y = -(lm.y - 0.5) * 3.2 + centerOffsetY
    const z = -((lm.z || 0) * 1.8)
    return [x, y, z]
  }

  useFrame((_, delta) => {
    if (groupRef.current && (!landmarks || landmarks.length === 0)) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })

  const joints = [
    LM.NOSE,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_ELBOW,
    LM.RIGHT_ELBOW,
    LM.LEFT_WRIST,
    LM.RIGHT_WRIST,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
    LM.LEFT_ANKLE,
    LM.RIGHT_ANKLE,
  ]

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* Joint Nodes */}
      {joints.map((jointIndex) => {
        const pos = getPoint(jointIndex)
        const isHead = jointIndex === LM.NOSE
        return (
          <mesh key={`joint-${jointIndex}`} position={pos}>
            <sphereGeometry args={[isHead ? 0.09 : 0.05, 20, 20]} />
            <meshStandardMaterial
              color={themeColor}
              emissive={themeColor}
              emissiveIntensity={0.9}
              roughness={0.15}
            />
          </mesh>
        )
      })}

      {/* Anatomical Bone Connections */}
      {CONNECTIONS.map(([startIdx, endIdx], i) => {
        const start = getPoint(startIdx)
        const end = getPoint(endIdx)
        const startV = new THREE.Vector3(...start)
        const endV = new THREE.Vector3(...end)
        const distance = startV.distanceTo(endV)
        if (distance <= 0.01) return null

        const midPoint = startV.clone().add(endV).multiplyScalar(0.5)
        const orientation = new THREE.Matrix4()
        orientation.lookAt(startV, endV, new THREE.Vector3(0, 1, 0))
        const rotation = new THREE.Euler().setFromRotationMatrix(orientation)

        return (
          <mesh key={`bone-${i}`} position={midPoint} rotation={rotation}>
            <cylinderGeometry args={[0.02, 0.02, distance, 12]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive={themeColor}
              emissiveIntensity={0.5}
              transparent
              opacity={0.9}
            />
          </mesh>
        )
      })}
    </group>
  )
}
