import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import movieRoutes from "../src/modules/movie/movie.routes.js";
import showtimeRoutes from "../src/modules/showtime/showtime.routes.js";

const oid = () => new mongoose.Types.ObjectId();

test(
  "public movie list filters and paginates distinct bookable movies by cinema",
  {
    skip: !process.env.MONGODB_URI,
  },
  async () => {
    const database = `movie_cinema_test_${process.pid}_${randomUUID().slice(0, 8)}`;
    let db;
    let server;
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: database,
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, database);
      const cinemaA = oid(),
        cinemaB = oid(),
        emptyCinema = oid(),
        closedCinema = oid();
      const roomA = oid(),
        roomB = oid(),
        closedRoom = oid();
      const seatId = oid();
      const now = new Date();
      const date = new Date("2026-01-01T00:00:00Z");
      const movie = (title, status = "PUBLISHED") => ({
        _id: oid(),
        title,
        status,
        releaseDate: date,
        genres: ["Drama"],
        trailerUrl: "https://example.test/trailer",
      });
      const a = movie("A only"),
        shared = movie("Both cinemas"),
        b = movie("B only");
      const soldOut = movie("Sold out"),
        cancelled = movie("Cancelled"),
        past = movie("Past");
      const draft = movie("Draft", "DRAFT"),
        closed = movie("Closed cinema");
      const badPrice = movie("Invalid price snapshot");
      const showtimes = [],
        seats = [];
      const show = (
        film,
        roomId,
        {
          status = "PUBLISHED",
          state = "AVAILABLE",
          offset = 3600000,
          legacyTime = false,
          holdExpiresAt,
          roomLayoutVersion = 1,
        } = {},
      ) => {
        const _id = oid();
        const startAt = new Date(+now + offset);
        showtimes.push({
          _id,
          movieId: film._id,
          roomId,
          status,
          roomLayoutVersion: 1,
          [legacyTime ? "startTime" : "startAt"]: startAt,
          endAt: new Date(+startAt + 7200000),
        });
        seats.push({
          showtimeId: _id,
          seatId,
          roomLayoutVersion,
          state,
          priceSnapshot: 100000,
          holdExpiresAt,
        });
      };
      show(a, roomA);
      show(a, roomA, { offset: 7200000 });
      show(shared, roomA, {
        state: "HELD",
        holdExpiresAt: new Date(+now - 1000),
        legacyTime: true,
      });
      show(shared, roomB);
      show(b, roomB);
      show(soldOut, roomA, { state: "SOLD" });
      show(cancelled, roomA, { status: "CANCELLED" });
      show(past, roomA, { offset: -3600000 });
      show(draft, roomA);
      show(closed, closedRoom);
      show(badPrice, roomA, { roomLayoutVersion: 2 });
      await Promise.all([
        db
          .collection("movies")
          .insertMany([
            a,
            shared,
            b,
            soldOut,
            cancelled,
            past,
            draft,
            closed,
            badPrice,
          ]),
        db.collection("branches").insertMany(
          [cinemaA, cinemaB, emptyCinema, closedCinema].map((_id) => ({
            _id,
            status: _id === closedCinema ? "INACTIVE" : "ACTIVE",
          })),
        ),
        db.collection("rooms").insertMany(
          [
            { _id: roomA, branchId: cinemaA, status: "ACTIVE" },
            { _id: roomB, branchId: cinemaB, status: "AVAILABLE" },
            { _id: closedRoom, branchId: closedCinema, status: "ACTIVE" },
          ].map((room) => ({
            ...room,
            layoutVersion: 1,
            seats: [{ _id: seatId, status: "ENABLED", type: "STANDARD" }],
          })),
        ),
        db.collection("showtimes").insertMany(showtimes),
        db.collection("showtime_seats").insertMany(seats),
      ]);
      const app = express();
      app.use("/movies", movieRoutes);
      app.use(showtimeRoutes);
      app.use(errorHandler);
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const request = async (query = "") => {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/movies?${query}`,
        );
        return { status: response.status, body: await response.json() };
      };
      const first = await request(
        `cinemaId=${cinemaA}&limit=1&sort=title&order=asc`,
      );
      assert.equal(first.status, 200);
      assert.deepEqual(first.body.meta, {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      assert.deepEqual(
        first.body.data.map(({ title }) => title),
        [a.title],
      );
      assert.equal(first.body.data[0].trailerUrl, a.trailerUrl);
      const second = await request(
        `cinemaId=${cinemaA}&limit=1&page=2&sort=title&order=asc`,
      );
      assert.deepEqual(
        second.body.data.map(({ title }) => title),
        [shared.title],
      );
      const cinemaBMovies = await request(`cinemaId=${cinemaB}&genre=drama`);
      assert.deepEqual(
        new Set(cinemaBMovies.body.data.map(({ title }) => title)),
        new Set([b.title, shared.title]),
      );
      assert.equal(
        (await request(`cinemaId=${cinemaA}&q=B%20only`)).body.meta.total,
        0,
      );
      for (const cinemaId of [emptyCinema, closedCinema]) {
        assert.deepEqual((await request(`cinemaId=${cinemaId}`)).body.data, []);
      }
      const invalid = await request("cinemaId=bad");
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.code, "INVALID_QUERY");
      assert.equal((await request()).body.meta.total, 8);
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/showtimes?cinemaId=${cinemaA}`,
      );
      assert.equal(response.status, 200);
      const publicShowtimes = await response.json();
      assert.deepEqual(
        new Set(publicShowtimes.data.map(({ movieId }) => movieId)),
        new Set([String(a._id), String(shared._id)]),
      );
    } finally {
      try {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (
          db?.databaseName === database &&
          /^movie_cinema_test_\d+_[a-f0-9]{8}$/.test(database)
        )
          await db.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
