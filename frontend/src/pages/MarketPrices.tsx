import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw, MapPin, Calendar } from 'lucide-react'
import { getMarketPrices, getMarketFilters } from '@/services/api'
import type { MarketPrice } from '@/services/api'
import { SkeletonList } from '@/components/LoadingSpinner'

// Demo data
const DEMO_PRICES: MarketPrice[] = [
  { commodity: 'Wheat', variety: 'Sharbati', market: 'Indore Mandi', state: 'Madhya Pradesh', min_price: 2100, max_price: 2350, modal_price: 2200, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'up', trend_percentage: 2.3 },
  { commodity: 'Rice', variety: 'Basmati 1121', market: 'Karnal', state: 'Haryana', min_price: 3200, max_price: 3800, modal_price: 3500, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'stable', trend_percentage: 0.1 },
  { commodity: 'Onion', variety: 'Red Medium', market: 'Lasalgaon', state: 'Maharashtra', min_price: 800, max_price: 1400, modal_price: 1100, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'down', trend_percentage: -5.2 },
  { commodity: 'Tomato', variety: 'Local', market: 'Kolar', state: 'Karnataka', min_price: 600, max_price: 1600, modal_price: 1200, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'up', trend_percentage: 15.8 },
  { commodity: 'Potato', variety: 'Kufri Jyoti', market: 'Agra', state: 'Uttar Pradesh', min_price: 1200, max_price: 1600, modal_price: 1400, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'stable', trend_percentage: 0.5 },
  { commodity: 'Soybean', variety: 'Yellow', market: 'Indore', state: 'Madhya Pradesh', min_price: 4200, max_price: 4600, modal_price: 4400, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'up', trend_percentage: 3.1 },
  { commodity: 'Cotton', variety: 'Long Staple', market: 'Akola', state: 'Maharashtra', min_price: 6800, max_price: 7200, modal_price: 7000, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'down', trend_percentage: -1.4 },
  { commodity: 'Groundnut', variety: 'Bold', market: 'Rajkot', state: 'Gujarat', min_price: 5200, max_price: 5800, modal_price: 5500, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'up', trend_percentage: 4.7 },
  { commodity: 'Maize', variety: 'Yellow Flint', market: 'Davangere', state: 'Karnataka', min_price: 1800, max_price: 2100, modal_price: 1950, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'stable', trend_percentage: -0.3 },
  { commodity: 'Mustard', variety: 'Yellow', market: 'Alwar', state: 'Rajasthan', min_price: 5100, max_price: 5700, modal_price: 5400, unit: 'Quintal', date: new Date().toISOString().slice(0, 10), trend: 'up', trend_percentage: 2.8 },
]

export default function MarketPrices() {
  const [prices, setPrices] = useState<MarketPrice[]>(DEMO_PRICES)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  
  // Filter data from API
  const [commodities, setCommodities] = useState<Array<{ cmdt_id: number; cmdt_name: string }>>([])
  const [states, setStates] = useState<Array<{ state_id: number; state_name: string }>>([])
  const [filtersLoading, setFiltersLoading] = useState(true)
  
  // Filter states
  const [selectedCommodityId, setSelectedCommodityId] = useState<number>(3) // 3 = all commodities
  const [selectedStateId, setSelectedStateId] = useState<number>(17) // 17 = all states (Kerala by default as per API)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  
  const [sortBy, setSortBy] = useState<'commodity' | 'modal_price' | 'trend_percentage'>('commodity')
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Fetch filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const filters = await getMarketFilters()
        setCommodities(filters.data.cmdt_data || [])
        setStates(filters.data.state_data || [])
      } catch (err) {
        console.error('Failed to load filters:', err)
        // Set fallback data if API fails
        setCommodities([
          { cmdt_id: 3, cmdt_name: 'Rice' },
          { cmdt_id: 1, cmdt_name: 'Wheat' },
          { cmdt_id: 23, cmdt_name: 'Onion' },
        ])
        setStates([
          { state_id: 100000, state_name: 'All States' },
          { state_id: 17, state_name: 'Kerala' },
        ])
      } finally {
        setFiltersLoading(false)
      }
    }
    loadFilters()
  }, [])

  // Set default dates (yesterday and today)
  useEffect(() => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    setToDate(today.toISOString().split('T')[0])
    setFromDate(yesterday.toISOString().split('T')[0])
  }, [])

  const fetchPrices = async () => {
    setLoading(true)
    try {
      const data = await getMarketPrices(
        selectedCommodityId,
        selectedStateId,
        fromDate,
        toDate
      )
      setPrices(data.prices)
      setLastUpdated(new Date(data.last_updated))
    } catch (_) {
      // Keep demo data
    } finally {
      setLoading(false)
    }
  }

  const filtered = prices
    .filter((p) =>
      (!search || p.commodity.toLowerCase().includes(search.toLowerCase()) || p.market.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'modal_price') return b.modal_price - a.modal_price
      if (sortBy === 'trend_percentage') return b.trend_percentage - a.trend_percentage
      return a.commodity.localeCompare(b.commodity)
    })

  const TrendIcon = ({ trend, pct }: { trend: MarketPrice['trend']; pct: number }) => (
    <div className={`flex items-center gap-1 text-xs font-semibold ${
      trend === 'up' ? 'text-primary-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'
    }`}>
      {trend === 'up' ? <TrendingUp size={14} /> : trend === 'down' ? <TrendingDown size={14} /> : <Minus size={14} />}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2 mb-0">
            <span>📈</span> Market Prices
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Live mandi prices • Updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="p-2.5 rounded-xl bg-primary-100 hover:bg-primary-200 text-primary-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Price ↑', count: prices.filter((p) => p.trend === 'up').length, color: 'bg-primary-50 text-primary-700', icon: '📈' },
          { label: 'Price ↓', count: prices.filter((p) => p.trend === 'down').length, color: 'bg-red-50 text-red-600', icon: '📉' },
          { label: 'Stable', count: prices.filter((p) => p.trend === 'stable').length, color: 'bg-gray-50 text-gray-600', icon: '➡️' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color} border border-opacity-50`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold">{s.count}</div>
            <div className="text-xs font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search commodity or market..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Main Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Commodity Dropdown */}
          <div>
            <select
              className="select-field text-sm py-2.5"
              value={selectedCommodityId}
              onChange={(e) => setSelectedCommodityId(Number(e.target.value))}
              disabled={filtersLoading}
            >
              {/* If loading, show placeholder */}
              {commodities.length === 0 && <option value={3}>Loading...</option>}
              
              {commodities.map((c) => (
                <option key={c.cmdt_id} value={c.cmdt_id}>
                  {c.cmdt_name}
                </option>
              ))}
            </select>
          </div>

          {/* State Dropdown */}
          <div>
            <select
              className="select-field text-sm py-2.5"
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(Number(e.target.value))}
              disabled={filtersLoading}
            >
              <option value={100000}>📍 All States</option>
              {states.map((s) => (
                <option key={s.state_id} value={s.state_id}>
                  {s.state_id === 100000 ? '' : s.state_name}
                </option>
              )).filter(option => option.props.children !== '')}
            </select>
          </div>

          {/* From Date */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              className="select-field text-sm py-2.5 pl-9"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate}
            />
          </div>

          {/* To Date */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              className="select-field text-sm py-2.5 pl-9"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Submit Button and Sort */}
        <div className="flex gap-3 items-center">
          <button
            onClick={fetchPrices}
            disabled={loading || !fromDate || !toDate}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search size={16} />
                Search Prices
              </>
            )}
          </button>
          
          <div className="flex-1">
            <select
              className="select-field text-sm py-2.5"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="commodity">Sort: A-Z</option>
              <option value="modal_price">Sort: Price ↑</option>
              <option value="trend_percentage">Sort: Trending</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Price List */}
      {loading ? (
        <SkeletonList count={5} />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No results found</p>
              <p className="text-sm">Try a different search term or state</p>
            </div>
          ) : (
            filtered.map((price, i) => (
              <div key={i} className="card border border-gray-100 hover:border-primary-200 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900">{price.commodity}</h3>
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{price.variety}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin size={11} />
                      <span>{price.market}, {price.state}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900">
                      ₹{price.modal_price.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-gray-400">/{price.unit}</div>
                    <TrendIcon trend={price.trend} pct={price.trend_percentage} />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-center">
                  <div>
                    <div className="text-gray-400 mb-0.5">Min</div>
                    <div className="font-semibold text-gray-700">₹{price.min_price.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Modal</div>
                    <div className="font-bold text-primary-700">₹{price.modal_price.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-0.5">Max</div>
                    <div className="font-semibold text-gray-700">₹{price.max_price.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info */}
      <div className="card bg-earth-50 border border-earth-100">
        <h3 className="font-semibold text-earth-800 mb-2 text-sm">📊 About Mandi Prices</h3>
        <p className="text-xs text-earth-700 leading-relaxed">
          Prices are sourced from AGMARKNET and major APMCs across India. Modal price represents the most frequently traded price. Check your local mandi for exact rates before selling.
        </p>
      </div>
    </div>
  )
}
