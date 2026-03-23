'use client'

import { useEffect, useState, useMemo } from 'react'
import { useMissionControl, type Agent } from '@/store'

interface AxisVortexProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Axis Vortex - Animated storm cloud representing system activity
 * 
 * Visual behavior:
 * - Idle: Small, dim, subtle breathing animation
 * - Busy: Grows, intensifies, lightning strikes more frequently
 * - Multiple busy agents: Maximum intensity
 */
export function AxisVortex({ size = 'md', className = '' }: AxisVortexProps) {
  const { agents } = useMissionControl()
  const [frame, setFrame] = useState(0)
  const [lightningBolt, setLightningBolt] = useState<number | null>(null)
  
  // Calculate activity level based on agent statuses
  const activityLevel = useMemo(() => {
    if (!agents.length) return 0
    const busyCount = agents.filter(a => a.status === 'busy').length
    const activeCount = agents.filter(a => a.status === 'idle').length
    const errorCount = agents.filter(a => a.status === 'error').length
    
    // Scale: 0 (all offline) to 1 (all busy)
    let level = 0
    level += busyCount * 0.3  // Each busy agent adds 30%
    level += activeCount * 0.1 // Each active agent adds 10%
    level += errorCount * 0.15 // Errors add some intensity
    
    return Math.min(1, level)
  }, [agents])
  
  const hasErrors = agents.some(a => a.status === 'error')
  const isBusy = agents.some(a => a.status === 'busy')
  
  // Animation frame for breathing/pulsing
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [])
  
  // Lightning strikes - more frequent when busy
  useEffect(() => {
    const baseInterval = isBusy ? 800 : 3000
    const variance = isBusy ? 400 : 2000
    
    const scheduleNext = () => {
      const delay = baseInterval + Math.random() * variance
      return setTimeout(() => {
        setLightningBolt(Math.floor(Math.random() * 3)) // 0, 1, or 2
        setTimeout(() => setLightningBolt(null), 150)
        scheduleNext()
      }, delay)
    }
    
    const timeout = scheduleNext()
    return () => clearTimeout(timeout)
  }, [isBusy])
  
  // Size configurations
  const sizeConfig = {
    sm: { width: 80, height: 60, cloudScale: 0.7 },
    md: { width: 120, height: 90, cloudScale: 1 },
    lg: { width: 180, height: 135, cloudScale: 1.3 },
  }
  
  const { width, height, cloudScale } = sizeConfig[size]
  
  // Breathing animation
  const breathe = Math.sin(frame * 0.03) * 0.05 + 1
  const scale = cloudScale * breathe * (0.85 + activityLevel * 0.15)
  
  // Color intensity based on activity
  const baseOpacity = 0.4 + activityLevel * 0.4
  const glowIntensity = 0.2 + activityLevel * 0.5
  
  // Dynamic colors
  const primaryColor = hasErrors ? '#f87171' : isBusy ? '#a78bfa' : '#38bdf8'
  const secondaryColor = hasErrors ? '#dc2626' : isBusy ? '#8b5cf6' : '#0ea5e9'
  const accentColor = hasErrors ? '#fca5a5' : '#c084fc'
  
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}${Math.round(glowIntensity * 40).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          transform: `scale(${scale * 1.5})`,
        }}
      />
      
      {/* SVG Storm Cloud */}
      <svg
        viewBox="0 0 100 75"
        className="relative z-10 transition-transform duration-500"
        style={{
          width: width * 0.8,
          height: height * 0.8,
          transform: `scale(${scale})`,
          filter: `drop-shadow(0 0 ${8 + activityLevel * 12}px ${primaryColor}${Math.round(baseOpacity * 255).toString(16).padStart(2, '0')})`,
        }}
      >
        {/* Cloud body */}
        <defs>
          <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity={baseOpacity} />
            <stop offset="50%" stopColor="#0f172a" stopOpacity={baseOpacity + 0.1} />
            <stop offset="100%" stopColor="#020617" stopOpacity={baseOpacity + 0.2} />
          </linearGradient>
          
          <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.6" />
            <stop offset="50%" stopColor={secondaryColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.5" />
          </linearGradient>
          
          <filter id="cloudBlur">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>
        
        {/* Main cloud shape */}
        <g filter="url(#cloudBlur)">
          {/* Cloud puffs */}
          <ellipse cx="30" cy="35" rx="20" ry="15" fill="url(#cloudGradient)" />
          <ellipse cx="50" cy="30" rx="25" ry="18" fill="url(#cloudGradient)" />
          <ellipse cx="70" cy="35" rx="20" ry="15" fill="url(#cloudGradient)" />
          <ellipse cx="40" cy="42" rx="18" ry="12" fill="url(#cloudGradient)" />
          <ellipse cx="60" cy="42" rx="18" ry="12" fill="url(#cloudGradient)" />
          
          {/* Cloud base */}
          <rect x="15" y="38" width="70" height="15" rx="3" fill="url(#cloudGradient)" />
        </g>
        
        {/* Edge highlight */}
        <ellipse 
          cx="50" cy="28" rx="28" ry="16" 
          fill="none" 
          stroke="url(#edgeGlow)" 
          strokeWidth="1.5"
          opacity={0.5 + activityLevel * 0.3}
        />
        
        {/* Lightning bolts */}
        {lightningBolt !== null && (
          <g className="animate-pulse">
            {lightningBolt === 0 && (
              <path
                d="M35 48 L38 55 L34 56 L40 68"
                fill="none"
                stroke={primaryColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 4px ${primaryColor})` }}
              />
            )}
            {lightningBolt === 1 && (
              <path
                d="M50 50 L54 58 L49 59 L55 72"
                fill="none"
                stroke={accentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }}
              />
            )}
            {lightningBolt === 2 && (
              <path
                d="M65 48 L62 54 L66 55 L60 65"
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 4px ${secondaryColor})` }}
              />
            )}
          </g>
        )}
        
        {/* Internal glow spots when active */}
        {activityLevel > 0.3 && (
          <>
            <circle
              cx="35"
              cy="35"
              r="4"
              fill={primaryColor}
              opacity={0.2 + Math.sin(frame * 0.05) * 0.1}
              style={{ filter: 'blur(3px)' }}
            />
            <circle
              cx="65"
              cy="35"
              r="3"
              fill={accentColor}
              opacity={0.15 + Math.sin(frame * 0.07 + 1) * 0.1}
              style={{ filter: 'blur(2px)' }}
            />
          </>
        )}
      </svg>
      
      {/* Activity indicator text */}
      {isBusy && (
        <div 
          className="absolute -bottom-1 text-[10px] font-medium tracking-wider uppercase"
          style={{ color: primaryColor, textShadow: `0 0 8px ${primaryColor}` }}
        >
          Active
        </div>
      )}
    </div>
  )
}

export default AxisVortex
