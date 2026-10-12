import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";

export const branchSeeds = [
  {
    seedKey: "branch:f-cinema-central",
    branchName: "F-Cinema Central",
    address: "123 Nguyen Hue, Ho Chi Minh City",
    email: "central.dev@f-cinema.example",
    hotline: "19001001",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-east",
    branchName: "F-Cinema East",
    address: "456 Vo Nguyen Giap, Ho Chi Minh City",
    email: "east.dev@f-cinema.example",
    hotline: "19001002",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-landmark-81",
    branchName: "F-Cinema Landmark 81",
    address: "Level B1, Landmark 81, 720A Dien Bien Phu, Ward 22, Binh Thanh District, Ho Chi Minh City",
    email: "landmark81.dev@f-cinema.example",
    hotline: "19001003",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-crescent-mall",
    branchName: "F-Cinema Crescent Mall",
    address: "5th Floor, Crescent Mall, 101 Ton Dat Tien, Tan Phu Ward, District 7, Ho Chi Minh City",
    email: "crescent.dev@f-cinema.example",
    hotline: "19001004",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-west-lake",
    branchName: "F-Cinema West Lake",
    address: "4th Floor, West Lake Mall, 272 Vo Chi Cong, Tay Ho District, Ha Noi",
    email: "westlake.dev@f-cinema.example",
    hotline: "19001005",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-da-nang-riverside",
    branchName: "F-Cinema Da Nang Riverside",
    address: "910A Ngo Quyen, An Hai Bac Ward, Son Tra District, Da Nang",
    email: "danang.dev@f-cinema.example",
    hotline: "19001006",
    status: "ACTIVE",
  },
  {
    seedKey: "branch:f-cinema-saigon-centre",
    branchName: "F-Cinema Saigon Centre",
    address: "Level 5, Saigon Centre, 65 Le Loi Boulevard, Ben Nghe Ward, District 1, Ho Chi Minh City",
    email: "saigoncentre.dev@f-cinema.example",
    hotline: "19001007",
    status: "ACTIVE",
  },
  {
    // Covers the INACTIVE state and a branch without the optional email.
    seedKey: "branch:f-cinema-hai-ba-trung",
    branchName: "F-Cinema Hai Ba Trung",
    address: "135 Hai Ba Trung Street, Ben Nghe Ward, District 1, Ho Chi Minh City",
    hotline: "19001008",
    status: "INACTIVE",
  },
];

export const seedBranches = async (database) => {
  const now = new Date();
  const operations = branchSeeds.map(({ seedKey, ...branch }) => {
    const _id = deterministicObjectId(seedKey);

    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: { ...branch, updatedAt: now },
          $setOnInsert: { _id, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  const result = await database.collection("branches").bulkWrite(operations, { ordered: true });
  return summarizeBulkWrite(result);
};
