interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${sizeMap[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
        <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        <div className="absolute inset-1.5 flex items-center justify-center text-sm">🌾</div>
      </div>
      {text && <p className="text-sm text-gray-500 font-medium">{text}</p>}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton h-4 w-3/4 mb-3" />
      <div className="skeleton h-3 w-full mb-2" />
      <div className="skeleton h-3 w-5/6 mb-2" />
      <div className="skeleton h-3 w-4/6" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
