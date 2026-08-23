import React, { useRef, useState, useEffect } from 'react'
import { Camera, RefreshCw, Check, Upload, AlertCircle } from 'lucide-react'

interface CameraSnapshotProps {
  onCapture: (imageDataUrl: string) => void
  initialImage?: string
  label?: string
}

export const CameraSnapshot: React.FC<CameraSnapshotProps> = ({
  onCapture,
  initialImage,
  label = 'Capture Profile Photo',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const startCamera = async () => {
    setCameraError(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setIsCameraActive(true)
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. You can upload an image file instead.')
      setIsCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 400
    canvas.height = video.videoHeight || 400

    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Mirror snapshot horizontally
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setCapturedImage(dataUrl)
      onCapture(dataUrl)
      stopCamera()
    }
  }

  const retake = () => {
    setCapturedImage(null)
    startCamera()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setCapturedImage(result)
      onCapture(result)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      <span className="text-sm font-medium text-slate-300 self-start">{label}</span>

      <div className="relative w-40 h-40 rounded-2xl overflow-hidden bg-slate-900/90 border-2 border-dashed border-cyan-500/40 flex items-center justify-center shadow-lg group">
        {/* Captured Image Preview */}
        {capturedImage && !isCameraActive && (
          <img
            src={capturedImage}
            alt="Profile Preview"
            className="w-full h-full object-cover rounded-2xl"
          />
        )}

        {/* Live Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            isCameraActive ? 'block' : 'hidden'
          }`}
        />

        {/* Idle Placeholder */}
        {!capturedImage && !isCameraActive && (
          <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
            <Camera className="w-8 h-8 text-cyan-400 mb-1" />
            <span className="text-[11px]">Click below to open webcam</span>
          </div>
        )}

        {/* Framing Overlay Guide during live video */}
        {isCameraActive && (
          <div className="absolute inset-0 border-2 border-cyan-400/50 rounded-full m-3 pointer-events-none animate-pulse" />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {!isCameraActive && !capturedImage && (
          <button
            type="button"
            onClick={startCamera}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Open Camera</span>
          </button>
        )}

        {isCameraActive && (
          <button
            type="button"
            onClick={takeSnapshot}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/30 transition transform hover:scale-105"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Capture Snapshot</span>
          </button>
        )}

        {capturedImage && !isCameraActive && (
          <button
            type="button"
            onClick={retake}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Photo</span>
          </button>
        )}

        {/* Alternative file upload */}
        <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 text-xs font-medium cursor-pointer transition">
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {cameraError && (
        <div className="flex items-center space-x-1.5 text-xs text-amber-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}
    </div>
  )
}
