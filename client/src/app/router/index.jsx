import { BrowserRouter, Route, Routes } from 'react-router'
import PublicLayout from '../../layouts/PublicLayout'
import LandingPage from '../../pages/public/LandingPage'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
