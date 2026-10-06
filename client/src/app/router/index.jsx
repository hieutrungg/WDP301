import { BrowserRouter, Route, Routes } from 'react-router'
import PublicLayout from '../../layouts/PublicLayout'
import LandingPage from '../../pages/public/LandingPage'
import LoginPage from '../../pages/public/LoginPage'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
