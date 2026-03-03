import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
    audioBase64: string
    format?: string
    onEnded?: () => void
}

export default function AudioPlayer({ audioBase64, format = 'wav', onEnded }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const blobUrlRef = useRef<string | null>(null)

    // Build blob URL from base64 once
    useEffect(() => {
        try {
            const byteChars = atob(audioBase64)
            const byteArr = new Uint8Array(byteChars.length)
            for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
            const blob = new Blob([byteArr], { type: `audio/${format}` })
            const url = URL.createObjectURL(blob)
            blobUrlRef.current = url

            const audio = new Audio(url)
            audioRef.current = audio

            audio.onloadedmetadata = () => setDuration(audio.duration)
            audio.ontimeupdate = () => {
                setCurrentTime(audio.currentTime)
                setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
            }
            audio.onended = () => {
                setIsPlaying(false)
                setProgress(100)
                onEnded?.()
            }
            audio.onplay = () => setIsPlaying(true)
            audio.onpause = () => setIsPlaying(false)

            // Auto-play
            audio.play().catch(() => setIsPlaying(false))
        } catch (e) {
            console.error('AudioPlayer: failed to decode base64 audio', e)
        }

        return () => {
            audioRef.current?.pause()
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioBase64])

    const togglePlayPause = () => {
        const audio = audioRef.current
        if (!audio) return
        if (isPlaying) {
            audio.pause()
        } else {
            // Restart from beginning if ended
            if (progress >= 99) audio.currentTime = 0
            audio.play().catch(() => { })
        }
    }

    const formatTime = (s: number) => {
        if (!isFinite(s)) return '0:00'
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return `${m}:${sec.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex items-center gap-2 mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 w-full max-w-xs">
            {/* Play / Pause */}
            <button
                onClick={togglePlayPause}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shadow-sm"
                aria-label={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            {/* Waveform bars (animated when playing) */}
            <div className="flex items-center gap-[2px] flex-shrink-0">
                {[3, 6, 4, 8, 5, 9, 6, 4, 7, 5].map((h, i) => (
                    <span
                        key={i}
                        className={`block w-[3px] rounded-full bg-green-500 transition-all ${isPlaying ? 'animate-pulse' : ''
                            }`}
                        style={{
                            height: `${h * (progress > 0 ? 1 : 0.5)}px`,
                            animationDelay: `${i * 60}ms`,
                            opacity: progress / 100 >= i / 10 ? 1 : 0.3,
                        }}
                    />
                ))}
            </div>

            {/* Progress bar */}
            <div className="flex-1 flex flex-col gap-1">
                <div className="w-full bg-green-200 rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-green-700 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <Volume2 size={14} className="text-green-600 flex-shrink-0" />
        </div>
    )
}
