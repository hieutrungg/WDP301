import httpClient from "../../../lib/api/httpClient";

export const getStaffDashboardRequest = async (signal) => {
  const response = await httpClient.get("/staff-dashboard", { signal });
  return response.data.data;
};
