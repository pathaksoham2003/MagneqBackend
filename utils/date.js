export const getCurrentDate = () => {
  const now = new Date();

  // Convert to Asia/Kolkata timezone
  const kolkataTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  return kolkataTime;
};