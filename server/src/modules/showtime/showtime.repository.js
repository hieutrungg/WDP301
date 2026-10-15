import mongoose from "mongoose";
import { SHOWTIME_STATUS } from "./showtime.constants.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const collection = (name) => mongoose.connection.db.collection(name);

export const findPublicShowtimes = async ({ movieId, cinemaId, roomId, dateRange, page, limit, now }) => {
  const match = { status: SHOWTIME_STATUS.PUBLISHED };
  if (movieId) match.movieId = toObjectId(movieId);
  if (roomId) match.roomId = toObjectId(roomId);

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        startAt: { $ifNull: ["$startAt", "$startTime"] },
        endAt: { $ifNull: ["$endAt", "$endTime"] },
      },
    },
    { $match: { startAt: { $gt: now, ...(dateRange ? { $gte: dateRange.start, $lt: dateRange.end } : {}) } } },
    { $lookup: { from: "rooms", localField: "roomId", foreignField: "_id", as: "room" } },
    { $unwind: "$room" },
    { $match: { "room.status": { $in: ["ACTIVE", "AVAILABLE"] } } },
    ...(cinemaId ? [{ $match: { "room.branchId": toObjectId(cinemaId) } }] : []),
    { $lookup: { from: "branches", localField: "room.branchId", foreignField: "_id", as: "cinema" } },
    { $unwind: "$cinema" },
    { $match: { "cinema.status": "ACTIVE" } },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $match: { "movie.status": "PUBLISHED" } },
    {
      $facet: {
        items: [
          { $sort: { startAt: 1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              movieId: 1,
              roomId: 1,
              startAt: 1,
              endAt: 1,
              status: 1,
              cinema: { id: "$cinema._id", branchName: "$cinema.branchName", address: "$cinema.address" },
              room: { id: "$room._id", roomName: "$room.roomName", roomType: "$room.roomType" },
              movie: {
                id: "$movie._id",
                title: "$movie.title",
                duration: "$movie.duration",
                ageRating: "$movie.ageRating",
                posterUrl: "$movie.posterUrl",
              },
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await collection("showtimes").aggregate(pipeline).toArray();
  return { items: result?.items ?? [], total: result?.total?.[0]?.count ?? 0 };
};
