import AppRouter from './app/router'
import { Toaster } from 'sonner'

function App() {
  return (
    <>
      <AppRouter />
      <Toaster theme="dark" richColors position="top-right" closeButton />
    </>
  )
}

export default App
