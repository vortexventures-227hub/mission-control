'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useMissionControl } from '@/store'
import { createClientLogger } from '@/lib/client-logger'
import { getAgentProfile } from '@/lib/agent-roster'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

const log = createClientLogger('ExpensesPanel')

// ── Types ──────────────────────────────────────────

interface ExpenseEntry {
  id: string
  amount: number
  currency: string
  category: string
  description: string
  timestamp: number
  source: 'manual' | 'voice' | 'auto'
  agentId?: string
}

interface ExpenseSummary {
  totalSpent: number
  byCategory: Record<string, number>
  byAgent: Record<string, number>
  thisMonth: number
  lastMonth: number
}

type ViewMode = 'overview' | 'list' | 'voice'
type TimeFilter = 'day' | 'week' | 'month' | 'all'

const EXPENSE_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff6b6b', '#00C49F',
  '#FFBB28', '#FF8042', '#0088FE', '#a78bfa', '#f472b6',
]

const CATEGORIES = [
  { id: 'api', label: 'API Costs', icon: '🔌' },
  { id: 'compute', label: 'Compute', icon: '💻' },
  { id: 'storage', label: 'Storage', icon: '💾' },
  { id: 'tools', label: 'Tools & SaaS', icon: '🛠️' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { id: 'other', label: 'Other', icon: '📦' },
]

// ── Voice Recording Hook ──────────────────────────────────────────

function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      setError('Could not access microphone')
      log.error('Failed to start recording:', err)
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsRecording(false)
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
        
        resolve(blob)
      }

      mediaRecorderRef.current.stop()
    })
  }, [])

  return {
    isRecording,
    isProcessing,
    setIsProcessing,
    error,
    startRecording,
    stopRecording,
  }
}

// ── Main Component ──────────────────────────────────────────

export function ExpensesPanel() {
  const t = useTranslations('expenses')
  const { dashboardMode } = useMissionControl()
  const isLocal = dashboardMode === 'local'

  const [view, setView] = useState<ViewMode>('overview')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [isLoading, setIsLoading] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  
  // Voice input state
  const voice = useVoiceRecorder()
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceParsed, setVoiceParsed] = useState<Partial<ExpenseEntry> | null>(null)

  // Manual entry form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: 'other',
    description: '',
  })

  // Load expenses data
  const loadExpenses = useCallback(async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use mock data or integrate with Ledger agent
      const res = await fetch(`/api/expenses?timeframe=${timeFilter}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses || [])
        setSummary(data.summary || null)
      } else {
        // Fallback: Create sample data for demo
        const mockExpenses: ExpenseEntry[] = [
          { id: '1', amount: 45.50, currency: 'USD', category: 'api', description: 'OpenAI API usage', timestamp: Date.now() - 3600000, source: 'auto', agentId: 'main' },
          { id: '2', amount: 12.30, currency: 'USD', category: 'api', description: 'Anthropic API', timestamp: Date.now() - 7200000, source: 'auto', agentId: 'cipher' },
          { id: '3', amount: 25.00, currency: 'USD', category: 'tools', description: 'GitHub Copilot', timestamp: Date.now() - 86400000, source: 'manual' },
        ]
        setExpenses(mockExpenses)
        
        const mockSummary: ExpenseSummary = {
          totalSpent: 82.80,
          byCategory: { api: 57.80, tools: 25.00 },
          byAgent: { main: 45.50, cipher: 12.30 },
          thisMonth: 82.80,
          lastMonth: 150.00,
        }
        setSummary(mockSummary)
      }
    } catch (err) {
      log.error('Failed to load expenses:', err)
    } finally {
      setIsLoading(false)
    }
  }, [timeFilter])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  // Handle voice recording
  const handleVoiceToggle = async () => {
    if (voice.isRecording) {
      const audioBlob = await voice.stopRecording()
      if (audioBlob) {
        voice.setIsProcessing(true)
        try {
          // Send to Ledger agent for processing
          const formData = new FormData()
          formData.append('audio', audioBlob, 'expense.webm')
          
          const res = await fetch('/api/expenses/voice', {
            method: 'POST',
            body: formData,
          })
          
          if (res.ok) {
            const result = await res.json()
            setVoiceTranscript(result.transcript || '')
            setVoiceParsed(result.parsed || null)
          } else {
            // Demo fallback
            setVoiceTranscript('Spent $25 on API calls today')
            setVoiceParsed({ amount: 25, category: 'api', description: 'API calls' })
          }
        } catch (err) {
          log.error('Failed to process voice:', err)
        } finally {
          voice.setIsProcessing(false)
        }
      }
    } else {
      await voice.startRecording()
    }
  }

  const confirmVoiceExpense = async () => {
    if (!voiceParsed?.amount) return
    
    const expense: ExpenseEntry = {
      id: `voice-${Date.now()}`,
      amount: voiceParsed.amount,
      currency: 'USD',
      category: voiceParsed.category || 'other',
      description: voiceParsed.description || voiceTranscript,
      timestamp: Date.now(),
      source: 'voice',
    }
    
    setExpenses(prev => [expense, ...prev])
    setVoiceTranscript('')
    setVoiceParsed(null)
    setView('overview')
  }

  const addManualExpense = () => {
    const amount = parseFloat(newExpense.amount)
    if (isNaN(amount) || amount <= 0) return

    const expense: ExpenseEntry = {
      id: `manual-${Date.now()}`,
      amount,
      currency: 'USD',
      category: newExpense.category,
      description: newExpense.description,
      timestamp: Date.now(),
      source: 'manual',
    }

    setExpenses(prev => [expense, ...prev])
    setNewExpense({ amount: '', category: 'other', description: '' })
    setShowAddForm(false)
  }

  // Chart data
  const categoryChartData = summary 
    ? Object.entries(summary.byCategory).map(([name, value]) => ({ name, value }))
    : []

  const agentChartData = summary
    ? Object.entries(summary.byAgent).map(([agentId, value]) => {
        const profile = getAgentProfile(agentId)
        return { name: profile.displayName, value, agentId }
      })
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              💰 {t('title') || 'Expenses'}
            </h1>
            <p className="text-muted-foreground mt-1">{t('subtitle') || 'Track and manage your AI operational costs'}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View tabs */}
            <div className="flex rounded-xl border border-border overflow-hidden shadow-lg">
              {(['overview', 'list', 'voice'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 text-xs font-semibold transition-all ${
                    view === v 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' 
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {v === 'voice' ? '🎙️ Voice' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {/* Time filter */}
            <div className="flex gap-1">
              {(['day', 'week', 'month', 'all'] as const).map(tf => (
                <Button 
                  key={tf} 
                  onClick={() => setTimeFilter(tf)} 
                  variant={timeFilter === tf ? 'default' : 'outline'} 
                  size="sm"
                  className="text-xs"
                >
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLoading && !summary ? (
        <Loader variant="panel" label="Loading expenses..." />
      ) : view === 'overview' ? (
        <OverviewView 
          summary={summary} 
          categoryData={categoryChartData}
          agentData={agentChartData}
          expenses={expenses.slice(0, 5)}
          onAddExpense={() => setShowAddForm(true)}
        />
      ) : view === 'list' ? (
        <ListView 
          expenses={expenses} 
          onAddExpense={() => setShowAddForm(true)}
        />
      ) : (
        <VoiceView
          isRecording={voice.isRecording}
          isProcessing={voice.isProcessing}
          error={voice.error}
          transcript={voiceTranscript}
          parsed={voiceParsed}
          onToggleRecording={handleVoiceToggle}
          onConfirm={confirmVoiceExpense}
          onCancel={() => { setVoiceTranscript(''); setVoiceParsed(null); }}
        />
      )}

      {/* Add Expense Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Add Expense</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={e => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={e => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="What was this expense for?"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={addManualExpense} className="bg-gradient-to-r from-emerald-500 to-teal-500">Add Expense</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function OverviewView({ summary, categoryData, agentData, expenses, onAddExpense }: {
  summary: ExpenseSummary | null
  categoryData: { name: string; value: number }[]
  agentData: { name: string; value: number; agentId: string }[]
  expenses: ExpenseEntry[]
  onAddExpense: () => void
}) {
  if (!summary) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold">No expenses yet</h3>
        <p className="text-muted-foreground mt-2">Start tracking your AI operational costs</p>
        <Button onClick={onAddExpense} className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-500">
          Add First Expense
        </Button>
      </div>
    )
  }

  const monthChange = summary.lastMonth > 0 
    ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth * 100).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard 
          label="Total Spent" 
          value={`$${summary.totalSpent.toFixed(2)}`} 
          color="emerald"
        />
        <SummaryCard 
          label="This Month" 
          value={`$${summary.thisMonth.toFixed(2)}`}
          subtitle={monthChange ? `${parseFloat(monthChange) > 0 ? '+' : ''}${monthChange}% vs last month` : undefined}
          color={parseFloat(monthChange || '0') > 0 ? 'red' : 'green'}
        />
        <SummaryCard 
          label="Categories" 
          value={Object.keys(summary.byCategory).length.toString()}
          color="violet"
        />
        <SummaryCard 
          label="Agents" 
          value={Object.keys(summary.byAgent).length.toString()}
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">By Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">By Agent</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Expenses</h3>
          <Button variant="outline" size="sm" onClick={onAddExpense}>+ Add</Button>
        </div>
        <div className="space-y-2">
          {expenses.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ListView({ expenses, onAddExpense }: { expenses: ExpenseEntry[]; onAddExpense: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">All Expenses</h3>
        <Button variant="outline" size="sm" onClick={onAddExpense}>+ Add Expense</Button>
      </div>
      <div className="divide-y divide-border">
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No expenses to display</div>
        ) : (
          expenses.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} detailed />
          ))
        )}
      </div>
    </div>
  )
}

function VoiceView({ isRecording, isProcessing, error, transcript, parsed, onToggleRecording, onConfirm, onCancel }: {
  isRecording: boolean
  isProcessing: boolean
  error: string | null
  transcript: string
  parsed: Partial<ExpenseEntry> | null
  onToggleRecording: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Microphone Button */}
      <button
        onClick={onToggleRecording}
        disabled={isProcessing}
        className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
          isRecording 
            ? 'bg-gradient-to-br from-red-500 to-rose-600 animate-pulse shadow-[0_0_60px_rgba(239,68,68,0.5)]' 
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:scale-105'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="text-5xl">
          {isProcessing ? '⏳' : isRecording ? '⏹️' : '🎙️'}
        </div>
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-50" />
        )}
      </button>

      {/* Instructions */}
      <div className="text-center max-w-md">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : isProcessing ? (
          <p className="text-muted-foreground">Processing your voice input...</p>
        ) : isRecording ? (
          <p className="text-lg font-medium text-emerald-400">Listening... Tap to stop</p>
        ) : (
          <>
            <p className="text-lg font-medium">Tap to record an expense</p>
            <p className="text-muted-foreground mt-2">
              Say something like &ldquo;I spent $50 on API calls today&rdquo; or &ldquo;$25 for GitHub subscription&rdquo;
            </p>
          </>
        )}
      </div>

      {/* Parsed Result */}
      {transcript && parsed && (
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
          <div className="text-sm text-muted-foreground">Heard:</div>
          <div className="text-lg font-medium">&ldquo;{transcript}&rdquo;</div>
          
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-emerald-400">${parsed.amount?.toFixed(2)}</span>
            </div>
            {parsed.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span>{parsed.category}</span>
              </div>
            )}
            {parsed.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description:</span>
                <span className="truncate ml-4">{parsed.description}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={onConfirm} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500">
              Add Expense
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, subtitle, color }: {
  label: string
  value: string
  subtitle?: string
  color: 'emerald' | 'green' | 'red' | 'violet' | 'blue'
}) {
  const colorStyles = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
  }

  return (
    <div className={`rounded-xl border p-5 bg-gradient-to-br ${colorStyles[color]} shadow-lg`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      {subtitle && <div className="text-xs mt-1 opacity-70">{subtitle}</div>}
    </div>
  )
}

function ExpenseRow({ expense, detailed }: { expense: ExpenseEntry; detailed?: boolean }) {
  const category = CATEGORIES.find(c => c.id === expense.category) || CATEGORIES[CATEGORIES.length - 1]
  const profile = expense.agentId ? getAgentProfile(expense.agentId) : null

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-lg">
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{expense.description || category.label}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{new Date(expense.timestamp).toLocaleDateString()}</span>
          {profile && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                {profile.emoji} {profile.displayName}
              </span>
            </>
          )}
          {detailed && (
            <>
              <span>•</span>
              <span className="capitalize">{expense.source}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-lg font-bold text-emerald-400">
        ${expense.amount.toFixed(2)}
      </div>
    </div>
  )
}
