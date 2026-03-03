import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, MessageCircle, CheckCircle, Send, User, ChevronDown, ChevronUp } from 'lucide-react'
import { getForumPosts, createForumPost, getForumAnswers, createForumAnswer } from '@/services/api'
import type { ForumPost, ForumAnswer } from '@/services/api'
import { EXPERT_CATEGORIES, SUPPORTED_LANGUAGES } from '@/utils/constants'
import { SkeletonList } from '@/components/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const DEMO_POSTS: ForumPost[] = [
  { id: '1', title: 'Yellow spots on mango leaves — what should I do?', content: 'I noticed yellow spots on my mango leaves last week. They are spreading fast. Is this a fungal disease? What treatment do you suggest?', author: 'Ramesh Kumar (Nagpur)', language: 'en', category: 'pest-control', tags: ['mango', 'disease', 'leaf-spots'], upvotes: 24, answers_count: 8, created_at: new Date(Date.now() - 86400000 * 2).toISOString(), is_resolved: true },
  { id: '2', title: 'Best time to sow wheat in UP for maximum yield?', content: 'I have 5 acres in Uttar Pradesh (Alluvial soil). What is the ideal time to sow wheat this rabi season? Should I use HD-2967 or PBW 550 variety?', author: 'Suresh Singh (Lucknow)', language: 'hi', category: 'crop-management', tags: ['wheat', 'rabi', 'UP', 'sowing'], upvotes: 47, answers_count: 15, created_at: new Date(Date.now() - 86400000 * 5).toISOString(), is_resolved: false },
  { id: '3', title: 'Onion prices are too low — should I store or sell now?', content: 'Current price in Nashik mandi is ₹800/quintal. My storage capacity is limited. Experts please advise on price forecast for next 30 days.', author: 'Vitthal Patil (Nashik)', language: 'mr', category: 'market-advisory', tags: ['onion', 'price', 'storage', 'nashik'], upvotes: 31, answers_count: 11, created_at: new Date(Date.now() - 86400000 * 1).toISOString(), is_resolved: false },
  { id: '4', title: 'PM Kisan Samman Nidhi — when is next installment?', content: 'I registered for PM Kisan scheme last month. When can I expect the next installment? What documents are needed?', author: 'Meena Devi (Bihar)', language: 'hi', category: 'government-schemes', tags: ['pm-kisan', 'scheme', 'subsidy'], upvotes: 89, answers_count: 22, created_at: new Date(Date.now() - 86400000 * 7).toISOString(), is_resolved: true },
  { id: '5', title: 'How to increase organic carbon in black cotton soil?', content: 'My soil test shows very low organic carbon (0.3%). I want to transition to organic farming. What is the fastest way to improve soil health without expensive inputs?', author: 'Anjali Reddy (Vidarbha)', language: 'te', category: 'soil-health', tags: ['organic', 'soil', 'black-cotton', 'carbon'], upvotes: 56, answers_count: 19, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), is_resolved: false },
  { id: '6', title: 'Drip irrigation setup cost for 2 acres of tomato?', content: 'I want to install drip irrigation for my 2-acre tomato farm. What is the approximate cost? Any government subsidy available in Karnataka?', author: 'Basavanna (Dharwad)', language: 'kn', category: 'water-management', tags: ['drip', 'irrigation', 'tomato', 'cost'], upvotes: 38, answers_count: 13, created_at: new Date(Date.now() - 86400000 * 4).toISOString(), is_resolved: false },
]

export default function Forum() {
  const { state, t } = useAppContext()
  const navigate = useNavigate()
  const profile = state.userProfile
  const authUser = state.authUser
  const [posts, setPosts] = useState<ForumPost[]>(DEMO_POSTS)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '', category: '', tags: '' })
  const [submitting, setSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all')
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, ForumAnswer[]>>({})
  const [answerText, setAnswerText] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  const loadPosts = useCallback(async (mode: 'all' | 'mine' = 'all') => {
    setLoading(true)
    try {
      const userId = mode === 'mine' ? authUser?.id : undefined
      const userEmail = mode === 'mine' ? authUser?.email : undefined
      const data = await getForumPosts(1, undefined, undefined, undefined, userId, userEmail)
      if (data && data.length > 0) setPosts(data)
      else if (mode === 'mine') setPosts([])
    } catch (_) {
      // Keep demo posts as fallback silently
    } finally {
      setLoading(false)
    }
  }, [authUser])

  useEffect(() => {
    loadPosts(viewMode)
  }, [loadPosts, viewMode])

  const handleCreatePost = async () => {
    const title = newPost.title.trim()
    const content = newPost.content.trim()
    if (!title) {
      toast.error('Please enter a title for your question')
      return
    }
    if (title.length < 10) {
      toast.error(`Title is too short — please add at least ${10 - title.length} more character${10 - title.length === 1 ? '' : 's'}`)
      return
    }
    if (!content) {
      toast.error('Please describe your problem in the description field')
      return
    }
    if (content.length < 20) {
      toast.error(`Description is too short — please add at least ${20 - content.length} more character${20 - content.length === 1 ? '' : 's'}`)
      return
    }
    if (!newPost.category) {
      toast.error('Please select a category for your question')
      return
    }
    setSubmitting(true)
    try {
      await createForumPost({
        ...newPost,
        language: state.selectedLanguage.code,
        author: authUser?.full_name || profile?.name || 'Anonymous Farmer',
        tags: newPost.tags.split(',').map((t) => t.trim()).filter(Boolean),
        user_id: authUser?.id,
        user_email: authUser?.email,
      })
      toast.success('Question posted to the community!')
      setShowNewPost(false)
      setNewPost({ title: '', content: '', category: '', tags: '' })
      await loadPosts(viewMode)
    } catch (err) {
      console.error('Failed to create post:', err)
      toast.error('Could not save your post. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExpandPost = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null)
      setAnswerText('')
      return
    }
    setExpandedPostId(postId)
    setAnswerText('')
    if (!answers[postId]) {
      try {
        const data = await getForumAnswers(postId)
        setAnswers((prev) => ({ ...prev, [postId]: data }))
      } catch (_) {
        setAnswers((prev) => ({ ...prev, [postId]: [] }))
      }
    }
  }

  const handleSubmitAnswer = async (postId: string) => {
    const text = answerText.trim()
    if (!text || text.length < 10) {
      toast.error('Please write at least 10 characters in your answer.')
      return
    }
    if (!authUser) {
      toast.error('Please sign in to answer questions.')
      navigate('/login')
      return
    }
    setSubmittingAnswer(true)
    try {
      const ans = await createForumAnswer(postId, {
        content: text,
        author: authUser.full_name || authUser.email,
        user_id: authUser.id,
        user_email: authUser.email,
      })
      setAnswers((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), ans] }))
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, answers_count: p.answers_count + 1 } : p))
      setAnswerText('')
      toast.success('Answer posted!')
    } catch (_) {
      toast.error('Could not post your answer. Please try again.')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  const filtered = posts
    .filter((p) =>
      (!search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))) &&
      (!category || p.category === category)
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const langLabel = (code: string) => SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag || '🌍'

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2 mb-0">
            <span>👨‍🌾</span> {t('forumTitle')}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{t('forumSubtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (!authUser) {
              toast.error('Please sign in to post a question.')
              navigate('/login')
              return
            }
            setShowNewPost(!showNewPost)
          }}
          className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4"
        >
          <Plus size={16} />
          {t('askQuestion')}
        </button>
      </div>

      {/* My Questions / All Questions Tabs */}
      {authUser && (
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${viewMode === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            All Questions
          </button>
          <button
            onClick={() => setViewMode('mine')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${viewMode === 'mine' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            <User size={12} /> My Questions
          </button>
        </div>
      )}

      {/* New Post Form */}
      {showNewPost && (
        <div className="card border-2 border-primary-300 animate-slide-up space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            ✏️ {t('postQuestion')}
          </h3>
          <div>
            <input
              type="text"
              placeholder="What's your farming question? (Be specific — min. 10 characters)"
              className={`input-field ${newPost.title.trim().length > 0 && newPost.title.trim().length < 10 ? 'border-orange-400 focus:border-orange-500' : ''}`}
              value={newPost.title}
              onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
              maxLength={200}
            />
            <div className="flex justify-between mt-1 px-1">
              <span className={`text-[11px] ${newPost.title.trim().length < 10 ? 'text-orange-500' : 'text-green-600'}`}>
                {newPost.title.trim().length < 10
                  ? `${newPost.title.trim().length}/10 min characters`
                  : '✓ Good title'}
              </span>
              <span className="text-[11px] text-gray-400">{newPost.title.length}/200</span>
            </div>
          </div>
          <div>
            <textarea
              placeholder="Describe your problem in detail — include crop type, location, symptoms, what you've tried... (min. 20 characters)"
              className={`input-field min-h-[100px] resize-none ${newPost.content.trim().length > 0 && newPost.content.trim().length < 20 ? 'border-orange-400 focus:border-orange-500' : ''}`}
              value={newPost.content}
              onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))}
              maxLength={2000}
            />
            <div className="flex justify-between mt-1 px-1">
              <span className={`text-[11px] ${newPost.content.trim().length < 20 ? 'text-orange-500' : 'text-green-600'}`}>
                {newPost.content.trim().length < 20
                  ? `${newPost.content.trim().length}/20 min characters`
                  : '✓ Good description'}
              </span>
              <span className="text-[11px] text-gray-400">{newPost.content.length}/2000</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              className="select-field"
              value={newPost.category}
              onChange={(e) => setNewPost((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="">Select Category</option>
              {EXPERT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tags (e.g. wheat, Punjab, pest)"
              className="input-field"
              value={newPost.tags}
              onChange={(e) => setNewPost((p) => ({ ...p, tags: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreatePost}
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              <Send size={16} />
              {submitting ? t('posting') : t('post')}
            </button>
            <button
              onClick={() => setShowNewPost(false)}
              className="btn-secondary"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search questions, topics, tags..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setCategory('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
              !category ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            All
          </button>
          {EXPERT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id === category ? '' : cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
                category === cat.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">🕒 Sorted by Latest</span>
          <span className="text-xs text-gray-400">{filtered.length} questions</span>
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <SkeletonList count={4} />
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🤔</div>
              <p className="font-medium">No questions found</p>
              <p className="text-sm">Be the first to ask!</p>
            </div>
          ) : (
            filtered.map((post) => {
              const catInfo = EXPERT_CATEGORIES.find((c) => c.id === post.category)
              return (
                <div key={post.id} className="card border border-gray-100 hover:border-primary-200 transition-all hover:shadow-md">
                  <div className="flex items-start gap-3">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-2">
                        {post.is_resolved && (
                          <span className="badge-green text-xs flex items-center gap-1">
                            <CheckCircle size={10} /> Resolved
                          </span>
                        )}
                        {catInfo && (
                          <span className="badge bg-primary-50 text-primary-700 text-xs">
                            {catInfo.icon} {catInfo.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{langLabel(post.language)}</span>
                      </div>

                      <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{post.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2">{post.content}</p>

                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {post.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="badge bg-gray-100 text-gray-500 text-xs">#{tag}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageCircle size={12} />
                            {post.answers_count} answers
                          </span>
                          <span>by {post.author}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
                          <button
                            onClick={() => handleExpandPost(post.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              expandedPostId === post.id
                                ? 'bg-primary-600 text-white'
                                : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                            }`}
                          >
                            {expandedPostId === post.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expandedPostId === post.id ? 'Hide' : 'Answers & Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inline answers + answer form */}
                  {expandedPostId === post.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {/* Existing answers */}
                      {(answers[post.id] || []).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {(answers[post.id] || []).length} Answer{(answers[post.id] || []).length > 1 ? 's' : ''}
                          </p>
                          {(answers[post.id] || []).map((ans) => (
                            <div
                              key={ans.id}
                              className={`p-3 rounded-xl text-sm ${ans.is_accepted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
                            >
                              {ans.is_accepted && (
                                <div className="flex items-center gap-1 text-green-700 text-xs font-semibold mb-1">
                                  <CheckCircle size={11} /> Accepted Answer
                                </div>
                              )}
                              <p className="text-gray-800 text-sm leading-relaxed">{ans.content}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                <span>by {ans.author}</span>
                                <span>{timeAgo(ans.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No answers yet — be the first to help!</p>
                      )}

                      {/* Answer form */}
                      {authUser ? (
                        <div className="flex flex-col gap-2 pt-2">
                          <textarea
                            rows={3}
                            placeholder="Write your answer here... (min. 10 characters)"
                            className="input-field resize-none text-sm"
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                          />
                          <div className="flex justify-between items-center">
                            <span className={`text-[11px] ${answerText.trim().length < 10 ? 'text-orange-500' : 'text-green-600'}`}>
                              {answerText.trim().length < 10 ? `${answerText.trim().length}/10 min` : '✓ Ready to post'}
                            </span>
                            <button
                              onClick={() => handleSubmitAnswer(post.id)}
                              disabled={submittingAnswer || answerText.trim().length < 10}
                              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send size={13} />
                              {submittingAnswer ? 'Posting…' : 'Post Answer'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                          <button onClick={() => navigate('/login')} className="font-semibold underline">Sign in</button> to post an answer.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

  
    </div>
  )
}
