import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/layout/Navbar'
import Ticker from './components/layout/Ticker'
import MapPage from './pages/MapPage'
import CascadePage from './pages/CascadePage'
import AnalyticsPage from './pages/AnalyticsPage'
import NetworkPage from './pages/NetworkPage'
import VulnerabilityPage from './pages/VulnerabilityPage'
import QuizPage from './pages/QuizPage'
import InsightsPage from './pages/InsightsPage'
import useDataStore from './store/useDataStore'
import { countriesAPI } from './api/countries'
import { analyticsAPI } from './api/analytics'

export default function App() {
  const {
    setCountries,
    setSIScores,
    setConflicts,
    setSummary,
    setBottlenecks,
    setClusters,
    setLoading
  } = useDataStore()

  // Load all data on app start
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      // Load countries
      setLoading('countries', true)
      const countriesRes = await countriesAPI.getAll()
      setCountries(countriesRes.countries || [])
      setLoading('countries', false)

      // Load conflicts
      const conflictsRes = await countriesAPI.getConflicts()
      setConflicts(conflictsRes.conflicts || [])

      // Load SI scores
      setLoading('si', true)
      const siRes = await countriesAPI.getAllSI('war', 0.7)
      setSIScores(siRes.countries || [])
      setLoading('si', false)

      // Load analytics in background
      setLoading('analytics', true)
      const [summaryRes, bottlenecksRes, clustersRes] = await Promise.all([
        analyticsAPI.getSummary(),
        analyticsAPI.getBottlenecks(),
        analyticsAPI.getClusters()
      ])
      setSummary(summaryRes)
      setBottlenecks(bottlenecksRes.bottlenecks || [])
      setClusters(clustersRes.clusters || [])
      setLoading('analytics', false)

    } catch (err) {
      console.error('Failed to load initial data:', err)
      setLoading('countries', false)
      setLoading('si', false)
      setLoading('analytics', false)
    }
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-2">
        <Navbar />
        <Ticker />
        <main>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/cascade" element={<CascadePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/vulnerability" element={<VulnerabilityPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}