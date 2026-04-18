// REMOVE local JSON usage completely
// This file will now fetch employees from Django backend API

import API from "../../../api/axios";

export const getEmployeesList = async () => {
  try {
    const response = await API.get("employees/");
    return response.data;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
};
