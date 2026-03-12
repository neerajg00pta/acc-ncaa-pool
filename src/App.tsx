import { HashRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { AdminPage } from './pages/Admin'
import { AdminGamesPage } from './pages/AdminGames'
import { Toasts } from './components/Toasts'

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <AuthProvider>
          <ToastProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/games" element={<AdminGamesPage />} />
              </Routes>
            </Layout>
            <Toasts />
          </ToastProvider>
        </AuthProvider>
      </DataProvider>
    </HashRouter>
  )
}
