import { toast } from 'sonner'
import SeatMapToast from '../components/SeatMapToast'

export const showSeatMapToast = ({ tone, duration = tone === 'error' ? 8000 : 5000, ...content }) =>
  toast.custom((id) => <SeatMapToast tone={tone} {...content} onClose={() => toast.dismiss(id)} />, {
    duration,
  })
