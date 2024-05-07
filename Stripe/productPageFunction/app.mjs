import fs from "fs";
import pug from "pug";

export const productPage = async () => {
  try {

    const pugTemplate = await fs.promises.readFile("page.pug", "utf8");

    const html = pug.render(pugTemplate, {});

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: html,
    };
  } catch (error) {
    console.error("Error occurred at product page:", error.message || error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error.message || error }),
    };
  }
};
