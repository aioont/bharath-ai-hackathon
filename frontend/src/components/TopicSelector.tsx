import { motion } from 'framer-motion'
import { Sprout, TrendingUp, CloudSun, Scale, Activity } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'

export type TopicType = 'general' | 'crop_doctor' | 'market' | 'weather' | 'schemes'

interface TopicSelectorProps {
  selectedTopic: string
  onSelect: (topic: string) => void
  disabled?: boolean
}

const TOPICS = [
  { id: 'general', labelKey: 'topicGeneral', icon: Sprout, color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'crop_doctor', labelKey: 'topicCropDoctor', icon: Activity, color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'market', labelKey: 'topicMarket', icon: TrendingUp, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'weather', labelKey: 'topicWeather', icon: CloudSun, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'schemes', labelKey: 'topicSchemes', icon: Scale, color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

export default function TopicSelector({ selectedTopic, onSelect, disabled }: TopicSelectorProps) {
  const { t } = useAppContext()
  return (
    <div className="w-full overflow-x-auto p-1 scrollbar-hide">
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
                flex items-center gap-1 px-2 py-1 rounded-full border text-sm font-medium transition-all
                ${isSelected 
                  ? `${topic.color} ring-2 ring-offset-1 ring-green-600 shadow-sm` 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Icon className="w-4 h-4" />
              {topic.labelKey ? t(topic.labelKey) : ''}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
