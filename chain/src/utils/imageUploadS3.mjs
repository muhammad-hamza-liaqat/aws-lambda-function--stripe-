import fs from "fs";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const bucket = process.env.AWS_BUCKET_NAME;

export const uploadFile = async (fileObj) => {
  console.log("fileObj ==>", fileObj);
  // Read content from the file
  const fileContent = fs.readFileSync(fileObj[0].path);
  // Setting up S3 upload parameters
  const params = {
    Bucket: bucket,
    Key: fileObj[0].fieldname + "_" + Date.now() + fileObj[0].originalname,
    Body: fileContent,
    ACL: "public-read",
  };

  // Uploading files to the bucket
  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully. ${data}`);
    return data.Location;
  } catch (err) {
    console.error("Error uploading file:", err);
    throw err;
  }
};