import { MongoClient } from "mongodb";

const DBConn = async () => {
  const encryptedClient = new MongoClient(process.env.MONGODB_URL, {});
  await encryptedClient.connect();
  const DB = encryptedClient.db(process.env.DB_NAME);
  console.log("DB Connected!");
  return { client: encryptedClient, DB };
};

export default DBConn;
