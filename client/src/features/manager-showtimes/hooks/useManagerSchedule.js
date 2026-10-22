import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../../lib/api/apiError";
import { getManagerScheduleData } from "../api/managerShowtimeApi";

export function useManagerSchedule({ date, cinemaId, query }, refreshToken) {
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const key = `${date}:${cinemaId}:${query}:${refreshToken}`;

  useEffect(() => {
    const controller = new AbortController();
    getManagerScheduleData({ date, cinemaId, query }, controller.signal)
      .then((data) => setState({ key, data, error: "" }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            key,
            error: getApiErrorMessage(error),
          }));
        }
      });

    return () => controller.abort();
  }, [date, cinemaId, query, key]);

  return { ...state, loading: state.key !== key };
}
