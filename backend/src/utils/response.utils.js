const successResponse = (res, data, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const errorResponse = (res, error, status = 500, errors = null) => {
  const message =
    typeof error === "string"
      ? error
      : error?.message || "Server error";
  const payload = { success: false, message, error: message };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(status).json(payload);
};

export { successResponse, errorResponse };
