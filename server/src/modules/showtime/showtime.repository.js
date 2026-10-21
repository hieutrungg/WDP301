import mongoose from "mongoose";
import { Showtime } from "./showtime.model.js";
import { SHOWTIME_STATUS } from "./showtime.constants.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const collection = (name) => mongoose.connection.db.collection(name);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

export const findManagerShowtimes = async ({ view, cinemaId, query, dateRange, page, limit, now }) => {
  const match = view === "history"
    ? { $or: [{ status: SHOWTIME_STATUS.CANCELLED }, { endAt: { $lte: now } }] }
    : { status: SHOWTIME_STATUS.PUBLISHED, startAt: { $gt: now } };
  const pipeline = [
    { $addFields: { startAt: { $ifNull: ["$startAt", "$startTime"] }, endAt: { $ifNull: ["$endAt", "$endTime"] } } },
    ...(dateRange ? [{ $match: { startAt: { $gte: dateRange.start, $lt: dateRange.end } } }] : []),
    { $match: match },
    { $lookup: { from: "rooms", localField: "roomId", foreignField: "_id", as: "room" } },
    { $unwind: "$room" },
    ...(cinemaId ? [{ $match: { "room.branchId": toObjectId(cinemaId) } }] : []),
    { $lookup: { from: "branches", localField: "room.branchId", foreignField: "_id", as: "cinema" } },
    { $unwind: "$cinema" },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    ...(query ? [{ $match: { $or: [
      { "movie.title": { $regex: escapeRegex(query), $options: "i" } },
      { "room.roomName": { $regex: escapeRegex(query), $options: "i" } },
      { "cinema.branchName": { $regex: escapeRegex(query), $options: "i" } },
    ] } }] : []),
    {
      $facet: {
        items: [
          { $sort: view === "history" ? { startAt: -1, _id: -1 } : { startAt: 1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: {
            _id: 1, movieId: 1, roomId: 1, roomLayoutVersion: 1, startAt: 1, endAt: 1, status: 1, createdAt: 1, updatedAt: 1,
            cinema: { id: "$cinema._id", branchName: "$cinema.branchName", address: "$cinema.address" },
            room: { id: "$room._id", roomName: "$room.roomName", roomType: "$room.roomType", capacity: "$room.capacity" },
            movie: {
              id: "$movie._id", title: "$movie.title", synopsis: "$movie.synopsis", genres: "$movie.genres",
              cast: "$movie.cast", director: "$movie.director", duration: "$movie.duration", releaseDate: "$movie.releaseDate",
              language: "$movie.language", ageRating: "$movie.ageRating", posterUrl: "$movie.posterUrl",
            },
          } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];
  const [result] = await collection("showtimes").aggregate(pipeline).toArray();
  return { items: result?.items ?? [], total: result?.total?.[0]?.count ?? 0 };
};

export const findPublicShowtimeById = async (showtimeId, now) => {
  const [showtime] = await collection("showtimes").aggregate([
    { $match: { _id: toObjectId(showtimeId), status: SHOWTIME_STATUS.PUBLISHED } },
    { $addFields: { startAt: { $ifNull: ["$startAt", "$startTime"] }, endAt: { $ifNull: ["$endAt", "$endTime"] } } },
    { $match: { startAt: { $gt: now } } },
    { $lookup: { from: "rooms", localField: "roomId", foreignField: "_id", as: "room" } },
    { $unwind: "$room" },
    { $match: { "room.status": { $in: ["ACTIVE", "AVAILABLE"] } } },
    { $lookup: { from: "branches", localField: "room.branchId", foreignField: "_id", as: "cinema" } },
    { $unwind: "$cinema" },
    { $match: { "cinema.status": "ACTIVE" } },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $match: { "movie.status": "PUBLISHED" } },
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
  ]).toArray();
  return showtime ?? null;
};

export const findScheduleConflict = ({ roomId, startAt, endAt, excludeShowtimeId }) =>
  collection("showtimes").findOne({
    roomId: toObjectId(roomId),
    status: { $ne: SHOWTIME_STATUS.CANCELLED },
    ...(excludeShowtimeId ? { _id: { $ne: toObjectId(excludeShowtimeId) } } : {}),
    $expr: {
      $and: [
        { $lt: [{ $ifNull: ["$startAt", "$startTime"] }, endAt] },
        { $gt: [{ $ifNull: ["$endAt", "$endTime"] }, startAt] },
      ],
    },
  });

export const findShowtimeById = (showtimeId) =>
  Showtime.findById(showtimeId).lean().exec();

export const updatePublishedShowtimeTime = ({ showtimeId, startAt, endAt, now, ticketPricePlanId, session }) =>
  Showtime.findOneAndUpdate(
    { _id: showtimeId, status: SHOWTIME_STATUS.PUBLISHED, startAt: { $gt: now } },
    { $set: { startAt, endAt, ...(ticketPricePlanId ? { ticketPricePlanId } : {}) } },
    { new: true, runValidators: true },
  ).session(session ?? null).lean().exec();

export const cancelPublishedShowtime = ({ showtimeId, now }) =>
  Showtime.findOneAndUpdate(
    { _id: showtimeId, status: SHOWTIME_STATUS.PUBLISHED, startAt: { $gt: now } },
    { $set: { status: SHOWTIME_STATUS.CANCELLED } },
    { new: true, runValidators: true },
  ).lean().exec();

export const createDraftShowtime = async (input, session) => {
  const [draft] = await Showtime.create([input], session ? { session } : {});
  return draft;
};

export const publishShowtime = (showtimeId) =>
  Showtime.findOneAndUpdate(
    { _id: showtimeId, status: SHOWTIME_STATUS.DRAFT },
    { $set: { status: SHOWTIME_STATUS.PUBLISHED } },
    { new: true, runValidators: true },
  )
    .lean()
    .exec();

export const deleteDraftShowtime = (showtimeId) =>
  Showtime.deleteOne({ _id: showtimeId, status: SHOWTIME_STATUS.DRAFT }).exec();

export const findBookableShowtimeById = async (showtimeId, now) => {
  const [showtime] = await collection("showtimes")
    .aggregate([
      { $match: { _id: toObjectId(showtimeId), status: SHOWTIME_STATUS.PUBLISHED } },
      {
        $addFields: {
          resolvedStartAt: { $ifNull: ["$startAt", "$startTime"] },
          resolvedEndAt: { $ifNull: ["$endAt", "$endTime"] },
        },
      },
      { $match: { resolvedStartAt: { $gt: now }, roomLayoutVersion: { $type: "number" } } },
      { $lookup: { from: "rooms", localField: "roomId", foreignField: "_id", as: "room" } },
      { $unwind: "$room" },
      { $lookup: { from: "branches", localField: "room.branchId", foreignField: "_id", as: "cinema" } },
      { $unwind: "$cinema" },
      { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
      { $unwind: "$movie" },
      {
        $project: {
          _id: 1,
          roomId: 1,
          roomLayoutVersion: 1,
          startAt: "$resolvedStartAt",
          endAt: "$resolvedEndAt",
          status: 1,
          movie: {
            id: "$movie._id",
            title: "$movie.title",
            duration: "$movie.duration",
            ageRating: "$movie.ageRating",
            posterUrl: "$movie.posterUrl",
          },
          cinema: {
            id: "$cinema._id",
            branchName: "$cinema.branchName",
            address: "$cinema.address",
          },
          room: {
            id: "$room._id",
            roomName: "$room.roomName",
            roomType: "$room.roomType",
            capacity: "$room.capacity",
          },
        },
      },
      { $limit: 1 },
    ])
    .toArray();
  return showtime ?? null;
};
