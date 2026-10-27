import httpClient from '../../../lib/api/httpClient'

export async function getMovieReviews(movieId, page, signal) {
  const response = await httpClient.get(`/movies/${movieId}/reviews`, { params: { page }, signal })
  return response.data
}

export async function getReviewEligibility(movieId, signal) {
  const response = await httpClient.get(`/movies/${movieId}/review-eligibility`, { signal })
  return response.data.data
}

export async function submitMovieReview(movieId, input, signal) {
  const response = await httpClient.post(`/movies/${movieId}/reviews`, input, { signal })
  return response.data.data
}
