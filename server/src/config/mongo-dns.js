import dns from "node:dns";

// Shared by the backend and migration CLIs before opening a MongoDB connection.
export const configureMongoDns = (value = process.env.MONGODB_DNS_SERVERS) => {
  const servers = value?.split(",").map((server) => server.trim()).filter(Boolean);
  if (servers?.length) dns.setServers(servers);
};
