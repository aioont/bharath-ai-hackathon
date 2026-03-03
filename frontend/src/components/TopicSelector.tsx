import { motion } from 'framer-motion'
import { Sprout, TrendingUp, CloudSun, Scale, Activity } from 'lucide-react'

export type TopicType = 'general' | 'crop_doctor' | 'market' | 'weather' | 'schemes'

interface TopicSelectorProps {
  selectedTopic: string
  onSelect: (topic: string) => void
  disabled?: boolean
}

const TOPICS = [
  { id: 'general', label: 'General Expert', icon: Sprout, color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'crop_doctor', label: 'Crop Doctor', icon: Activity, color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'market', label: 'Market Prices', icon: TrendingUp, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'weather', label: 'Weather', icon: CloudSun, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'schemes', label: 'Govt Schemes', icon: Scale, color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

export default function TopicSelector({ selectedTopic, onSelect, disabled }: TopicSelectorProps) {
  return (
    <div className="w-full overflow-x-auto p-2 scrollbar-hide">
      <div className="flex gap-2 min-w-max px-1">
        {TOPICS.map((topic) => {
          const Icon = topic.icon
          const isSelected = selectedTopic === topic.id
          
          return (
            <motion.button
              key={topic.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(topic.id as TopicType)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                ${isSelected 
                  ? `${topic.color} ring-2 ring-offset-1 ring-green-600 shadow-sm` 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Icon className="w-4 h-4" />
              {topic.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
