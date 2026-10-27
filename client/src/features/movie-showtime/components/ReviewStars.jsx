import { Star } from 'lucide-react'

export default function ReviewStars({ rating }) {
  // Reject malformed values; never turn missing data into a zero-star review.
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null
  return <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex gap-1">
    {Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true"
      className={`size-[18px] fill-current ${index < rating ? 'text-secondary' : 'text-[#71737d]'}`} />)}
  </span>
}
