import httpClient from "../../../lib/api/httpClient";

export const listPromotions = async (params) =>
  (await httpClient.get("/promotions", { params })).data;
export const getPromotion = async (id) =>
  (await httpClient.get(`/promotions/${id}`)).data.data;
export const savePromotion = async (id, input) =>
  (id
    ? await httpClient.patch(`/promotions/${id}`, input)
    : await httpClient.post("/promotions", input)
  ).data.data;
export const listVouchers = async (id, params) =>
  (await httpClient.get(`/promotions/${id}/vouchers`, { params })).data;
export const createVoucher = async (id, input) =>
  (await httpClient.post(`/promotions/${id}/vouchers`, input)).data.data;
export const updateVoucher = async (id, input) =>
  (await httpClient.patch(`/vouchers/${id}`, input)).data.data;
export const applyVoucher = async (id, input) =>
  (await httpClient.put(`/bookings/${id}/voucher`, input)).data.data;
export const removeVoucher = async (id, input) =>
  (await httpClient.delete(`/bookings/${id}/voucher`, { data: input })).data
    .data;
