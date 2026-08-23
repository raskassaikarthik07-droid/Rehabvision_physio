export interface ExerciseInstructionData {
  id: string
  name: string
  category: 'lower_body' | 'upper_body' | 'posture'
  slug: string
  purpose: string
  startingPosition: string[]
  steps: string[]
  aiMonitors: string[]
  commonMistakes: string[]
  feedbackLabels?: {
    optimal: string
    warning: string
  }
  safetyReminder: string
  targetReps: number
  targetRom: number
}

export const EXERCISE_INSTRUCTIONS: Record<string, ExerciseInstructionData> = {
  leg_raise: {
    id: 'leg_raise',
    name: 'Straight Leg Raise',
    category: 'lower_body',
    slug: 'leg-raise',
    purpose: 'Controlled leg elevation for hip flexor activation, lower-limb stability, and quadriceps rehabilitation.',
    startingPosition: [
      'Lie comfortably on your back on an exercise mat or firm surface.',
      'Keep one leg bent with foot flat on the floor if required for pelvic stability.',
      'Keep the exercising leg straight with toes pointing upwards.',
      'Keep your upper body, shoulders, and neck relaxed.',
    ],
    steps: [
      'Start with the exercising leg extended in resting position on the floor.',
      'Slowly raise the straight leg upward towards 45 degrees without bending the knee.',
      'Maintain smooth, controlled movement without swinging.',
      'Reach the target range of motion and hold for 1 second.',
      'Slowly lower the leg back to the starting resting position.',
      'Repeat only after returning fully to the resting position.',
    ],
    aiMonitors: [
      'Range of motion (hip elevation angle)',
      'Movement speed and tempo control',
      'Repetition count and phase transitions',
      'Knee straightness (detects knee buckling)',
      'Bilateral pelvic stability',
    ],
    commonMistakes: [
      'Raising the leg too quickly or using momentum',
      'Bending the knee during elevation',
      'Incomplete range of motion',
      'Arching the lower back off the surface',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 8,
    targetRom: 45,
  },

  knee_extension: {
    id: 'knee_extension',
    name: 'Seated Knee Extension',
    category: 'lower_body',
    slug: 'knee-extension',
    purpose: 'Quadriceps muscle strengthening, patellar tracking rehabilitation, and terminal knee extension restoration.',
    startingPosition: [
      'Sit upright on a sturdy chair with knees bent at approximately 90 degrees.',
      'Keep feet flat on the floor and back supported against the chair.',
      'Position the camera sideways or at a 45-degree angle to capture the knee joint clearly.',
    ],
    steps: [
      'Begin with feet relaxed on the ground in starting position.',
      'Slowly extend the exercising lower leg forward and upward until fully straight.',
      'Reach terminal knee extension (160°–170°).',
      'Hold the peak quadriceps contraction for 1–2 seconds.',
      'Slowly lower the foot back to the 90-degree starting resting position.',
    ],
    aiMonitors: [
      'Knee extension joint angle (110° to 170°)',
      'Terminal knee extension lock',
      'Controlled eccentric lowering speed',
      'Repetition consistency and hold duration',
    ],
    commonMistakes: [
      'Kicking the leg up rapidly instead of a smooth extension',
      'Failing to reach full terminal extension',
      'Slouching back in the chair during the movement',
      'Dropping the leg abruptly without controlled lowering',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 10,
    targetRom: 170,
  },

  sit_to_stand: {
    id: 'sit_to_stand',
    name: 'Sit to Stand',
    category: 'lower_body',
    slug: 'sit-to-stand',
    purpose: 'Functional lower-limb strengthening, quadriceps activation, hip extension, and sit-to-stand mobility.',
    startingPosition: [
      'Sit upright on a standard-height chair with feet shoulder-width apart.',
      'Arms crossed over the chest or resting gently on the thighs.',
      'Position the camera 2–3 meters away capturing full body from head to feet.',
    ],
    steps: [
      'Lean slightly forward from the hips with neutral spine.',
      'Push firmly through the heels and stand up smoothly to a full upright posture.',
      'Fully extend hips and knees at the top of the movement.',
      'Slowly lower your hips back down into the chair with controlled descent.',
      'Pause briefly seated before initiating the next repetition.',
    ],
    aiMonitors: [
      'Knee joint extension angle (0° to 155°)',
      'Torso inclination during ascent and descent',
      'Bilateral weight distribution and stability',
      'Full upright extension at top of rep',
    ],
    commonMistakes: [
      'Excessive forward torso lean on ascent',
      'Collapsing knees inward (valgus collapse)',
      'Dropping abruptly into the seat on descent',
      'Pushing off thighs with arms unless prescribed',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 5,
    targetRom: 155,
  },

  arm_raise: {
    id: 'arm_raise',
    name: 'Arm / Shoulder Raise',
    category: 'upper_body',
    slug: 'arm-raise',
    purpose: 'Rotator cuff rehabilitation, shoulder abduction range of motion, and scapulothoracic rhythm tracking.',
    startingPosition: [
      'Stand or sit upright facing the camera directly.',
      'Keep arms resting naturally at your sides with palms inward.',
      'Keep shoulders relaxed away from the ears and neck tall.',
    ],
    steps: [
      'Start with arms resting naturally at sides.',
      'Slowly raise arms outwards and upward to shoulder height (90 degrees).',
      'Keep elbows straight and palms facing downward at peak.',
      'Hold for 1 second at 90-degree shoulder level.',
      'Slowly lower arms back to resting position along your sides.',
    ],
    aiMonitors: [
      'Shoulder abduction angle (0° to 90°)',
      'Bilateral shoulder height symmetry',
      'Elbow straightness and arm extension',
      'Scapular elevation and shrugging compensation',
    ],
    commonMistakes: [
      'Shrugging shoulders up towards ears during elevation',
      'Arching the lower back to assist arm lift',
      'Raising arms higher than prescribed 90-degree level',
      'Bending elbows during the raise',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 10,
    targetRom: 90,
  },

  squat: {
    id: 'squat',
    name: 'Rehabilitation Squat',
    category: 'lower_body',
    slug: 'squat',
    purpose: 'Multi-joint lower-body strengthening, hip and knee flexion coordination, and core stability.',
    startingPosition: [
      'Stand upright with feet shoulder-width apart, toes pointing slightly outward.',
      'Arms extended forward at chest height for balance.',
      'Position camera 2–3 meters away with full body in frame.',
    ],
    steps: [
      'Inhale and initiate the movement by hinging at hips while bending knees.',
      'Lower down smoothly until thighs approach parallel to ground (~100° knee flexion).',
      'Keep chest lifted, back straight, and weight centered through midfoot/heels.',
      'Push evenly through both feet to return to upright standing position.',
    ],
    aiMonitors: [
      'Knee flexion angle and squat depth',
      'Torso angle and back alignment',
      'Bilateral knee tracking (detects valgus collapse)',
      'Weight distribution and balance symmetry',
    ],
    commonMistakes: [
      'Knees caving inward (valgus collapse) during descent/ascent',
      'Excessive forward torso bending',
      'Heels lifting off the floor',
      'Rounding the lower back at the bottom of the squat',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 10,
    targetRom: 100,
  },

  neck_posture: {
    id: 'neck_posture',
    name: 'Neck & Forward Head Alignment',
    category: 'posture',
    slug: 'neck-posture',
    purpose: 'Cervical spine alignment, Craniovertebral Angle (CVA) tracking, and postural correction monitoring.',
    startingPosition: [
      'Sit or stand comfortably in your natural posture.',
      'Keep shoulders relaxed and chest gently open.',
      'Position the camera at approximate eye level.',
      'Face forward with the side of your neck visible to the camera if feasible.',
    ],
    steps: [
      'Maintain a neutral head and cervical spine position.',
      'Keep your ears approximately aligned vertically above your shoulders.',
      'Avoid pushing your chin forward or slumping your shoulders.',
      'Hold the posture steadily in front of the camera for tracking.',
      'Relax gently between monitoring intervals.',
    ],
    aiMonitors: [
      'Craniovertebral Angle (CVA)',
      'Ear-to-shoulder vertical reference alignment',
      'Forward head posture displacement (<48° threshold warning)',
      'Shoulder level symmetry',
    ],
    commonMistakes: [
      'Pushing the chin forward towards the screen (text neck)',
      'Tilting the head upward or downward excessively',
      'Hunching the upper back and rounding shoulders',
      'Tensing the trapezius muscles',
    ],
    feedbackLabels: {
      optimal: 'GOOD POSTURE',
      warning: 'FORWARD HEAD POSITION DETECTED',
    },
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 1,
    targetRom: 50,
  },

  torso_bend: {
    id: 'torso_bend',
    name: 'Back & Torso Bend Alignment',
    category: 'posture',
    slug: 'torso-bend',
    purpose: 'Trunk inclination tracking, spinal neutral posture awareness, and controlled hip hinge mechanics.',
    startingPosition: [
      'Stand upright with feet hip-width apart and stable.',
      'Keep shoulders relaxed and spine tall.',
      'Position camera sideways to capture trunk inclination relative to vertical axis.',
    ],
    steps: [
      'Start in upright standing posture with neutral spine.',
      'Perform a controlled forward hip hinge while maintaining a flat back.',
      'Bend forward to the prescribed angle (up to 45 degrees).',
      'Engage glutes and core to return smoothly to the vertical starting posture.',
    ],
    aiMonitors: [
      'Shoulder and hip reference coordinates',
      'Torso inclination angle relative to vertical axis (0° to 45°)',
      'Neutral spine alignment vs rounding',
      'Controlled movement pace',
    ],
    commonMistakes: [
      'Excessive forward bend beyond prescribed limits',
      'Rounding the thoracic spine (lumbar flexion)',
      'Hyperextending the lower back upon return',
      'Bending at knees excessively instead of hinging at hips',
    ],
    feedbackLabels: {
      optimal: 'GOOD POSTURE',
      warning: 'EXCESSIVE FORWARD BEND DETECTED',
    },
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 5,
    targetRom: 45,
  },

  shoulder_symmetry: {
    id: 'shoulder_symmetry',
    name: 'Shoulder Symmetry & Balance',
    category: 'upper_body',
    slug: 'shoulder-symmetry',
    purpose: 'Bilateral shoulder height comparison, postural asymmetry detection, and level shoulder girdle restoration.',
    startingPosition: [
      'Stand or sit upright facing the camera directly.',
      'Let arms hang naturally at sides.',
      'Keep head neutral and shoulders in resting position.',
    ],
    steps: [
      'Stand relaxed facing the camera.',
      'Perform gentle bilateral shoulder shrugs and rolls as instructed.',
      'Hold level shoulder position for 5 seconds.',
      'Maintain equal height between left and right acromioclavicular joints.',
    ],
    aiMonitors: [
      'Bilateral shoulder height difference (<8% threshold)',
      'Shoulder girdle tilt and elevation asymmetry',
      'Head-to-shoulder equilateral balance',
    ],
    commonMistakes: [
      'Elevating one shoulder higher than the other',
      'Tilting the neck to compensate for asymmetry',
      'Shifting weight to one side',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 10,
    targetRom: 95,
  },

  knee_alignment: {
    id: 'knee_alignment',
    name: 'Knee Alignment & Valgus Tracking',
    category: 'lower_body',
    slug: 'knee-alignment',
    purpose: 'Frontal plane knee alignment tracking to detect inward valgus collapse during lower-limb loading.',
    startingPosition: [
      'Stand facing the camera with feet shoulder-width apart.',
      'Knees and toes pointing straight ahead.',
      'Position camera 2–3 meters away with lower body fully visible.',
    ],
    steps: [
      'Stand upright with neutral knee alignment.',
      'Perform a shallow mini-squat or single-leg balance as prescribed.',
      'Keep knees tracking directly over second toes without caving inward.',
      'Return to standing upright position.',
    ],
    aiMonitors: [
      'Frontal hip-knee-ankle alignment angle',
      'Knee valgus (inward collapse <165° warning)',
      'Bilateral limb stability',
    ],
    commonMistakes: [
      'Knees collapsing inwards towards each other',
      'Unequal weight distribution between legs',
      'Feet rolling onto inner arches (pronation)',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 8,
    targetRom: 175,
  },

  lateral_leg_raise: {
    id: 'lateral_leg_raise',
    name: 'Lateral Leg Raise',
    category: 'lower_body',
    slug: 'lateral-leg-raise',
    purpose: 'Hip abduction strengthening targeting gluteus medius for pelvic stability and gait rehabilitation.',
    startingPosition: [
      'Stand upright holding a chair for balance, or lie on your side.',
      'Keep exercising leg straight with toes pointing forward.',
      'Position camera to view full frontal or side elevation.',
    ],
    steps: [
      'Start with legs together.',
      'Slowly lift the exercising leg outwards to the side (approx 30°–40°).',
      'Keep pelvis level and avoid leaning torso to the opposite side.',
      'Hold for 1 second at peak abduction.',
      'Slowly return the leg to the starting position.',
    ],
    aiMonitors: [
      'Hip abduction angle (0° to 40°)',
      'Pelvic levelness and trunk lateral lean',
      'Knee straightness and smooth lowering',
    ],
    commonMistakes: [
      'Leaning the torso to the opposite side to cheat the raise',
      'Turning toes upwards instead of pointing forward',
      'Swinging the leg with momentum',
    ],
    safetyReminder: 'Follow the exercise plan prescribed by your physiotherapist. Stop if you experience pain or discomfort.',
    targetReps: 8,
    targetRom: 40,
  },
}
