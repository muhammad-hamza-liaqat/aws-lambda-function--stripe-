export const generateCorsHeaders = () => {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://main.d3gzu5jixwdx96.amplifyapp.com",
  ];

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET",
    // "Access-Control-Allow-Origin": allowedOrigins.join(", "),
    "Access-Control-Allow-Origin": "*",
  };
};
