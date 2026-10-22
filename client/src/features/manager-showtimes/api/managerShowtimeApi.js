import httpClient from "../../../lib/api/httpClient";
import { getMovies } from "../../movie-showtime/api/movieApi";
import { listRoomsRequest } from "../../room/api/roomApi";

export async function getManagerScheduleData(
  { date, cinemaId, query },
  signal,
) {
  const getParams = (requestedDate, view, page = 1) => {
    const params = new URLSearchParams({
      view,
      page: String(page),
      limit: "50",
    });
    if (requestedDate) params.set("date", requestedDate);
    if (cinemaId) params.set("cinemaId", cinemaId);
    if (query.trim()) params.set("q", query.trim());
    return params;
  };
  const getAllPages = async (requestedDate, view) => {
    const firstResponse = await httpClient.get(
      `/showtimes/manage?${getParams(requestedDate, view)}`,
      { signal },
    );
    const totalPages = firstResponse.data.meta?.totalPages ?? 1;
    const otherResponses = await Promise.all(
      Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
        httpClient.get(
          `/showtimes/manage?${getParams(requestedDate, view, index + 2)}`,
          { signal },
        ),
      ),
    );
    return {
      responses: [firstResponse, ...otherResponses],
      total: firstResponse.data.meta?.total ?? firstResponse.data.data.length,
    };
  };
  const requestedDates = getWeekDates(date);

  const [showtimesByDate, movies, rooms] = await Promise.all([
    Promise.all(
      requestedDates.map((requestedDate) =>
        getAllPages(requestedDate, "schedule"),
      ),
    ),
    getMovies("limit=24", signal),
    listRoomsRequest({ limit: 200 }, signal),
  ]);

  const showtimesResponses = showtimesByDate.flatMap(
    ({ responses }) => responses,
  );
  const showtimes = showtimesResponses
    .flatMap((response) => response.data.data)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const meta = {
    total: showtimesByDate.reduce((sum, result) => sum + result.total, 0),
    totalPages: 1,
    page: 1,
  };

  return {
    showtimes,
    meta,
    movies: movies.data ?? [],
    rooms: rooms.items,
  };
}

function getWeekDates(date) {
  const [year, month, day] = date.split("-").map(Number);
  const selectedDay = new Date(Date.UTC(year, month - 1, day, 12));
  const mondayOffset = (selectedDay.getUTCDay() + 6) % 7;
  selectedDay.setUTCDate(selectedDay.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const weekDay = new Date(selectedDay);
    weekDay.setUTCDate(selectedDay.getUTCDate() + index);
    return `${weekDay.getUTCFullYear()}-${String(weekDay.getUTCMonth() + 1).padStart(2, "0")}-${String(weekDay.getUTCDate()).padStart(2, "0")}`;
  });
}

export async function createManagerShowtime(payload) {
  const response = await httpClient.post("/showtimes", payload);
  return response.data.data;
}

export async function rescheduleManagerShowtime(showtimeId, payload) {
  const response = await httpClient.patch(`/showtimes/${showtimeId}`, payload);
  return response.data.data;
}

export async function cancelManagerShowtime(showtimeId) {
  const response = await httpClient.post(`/showtimes/${showtimeId}/cancel`);
  return response.data.data;
}
