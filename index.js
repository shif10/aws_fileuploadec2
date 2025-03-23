import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import moment from "moment";
import fs from "fs";
import axios from "axios";
import multer from "multer";
import mime from "mime-types"; // Added for content-type detection
// for directly s3 use GetObjectCommand and putObjectCommand
console.log(process.env.AWS_ACCESS_KEY_ID, "id");
const __filename = fileURLToPath(import.meta.url);
// Get the current directory name
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());

mongoose.connect("mongodb+srv://shifa:shifamemon@cluster0.xlq4f7s.mongodb.net/files", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// ✅ Define File Schema & Model
const fileSchema = new mongoose.Schema({
    fileName: String,
    s3Key: String,
    uploadDate: { type: Date, default: Date.now }
});
const File = mongoose.model("File", fileSchema);
app.get("/", (req, res) => {
  console.log("hello aws");
  console.log("comeing")
  res.send("Hello AWS");
});

const PORT = 8081;

const config = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION || '',
};

const s3Client = new S3Client(config);

async function getImage(key) {
  const url = getSignedUrl({
    url: `https://d1pwcyv2ow3s1x.cloudfront.net/${key}`,
    keyPairId: process.env.cloud_front_key_id || '',
    privateKey: process.env.cloud_front_private_key || '',
    dateLessThan: moment().add(4000000, "minutes").toISOString(),
  });

  console.log(moment().add(4000000, "minutes").toISOString(), "time");
  return url;
}

(async () => {
  const url = await getImage("image/new/dummy-image.jpg");
  console.log("Signed URL:", url);
})();
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Ensure files are stored in the created directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
//uplaod file api
app.post("/upload",upload.single("file"), async (req, res) => {

  try {
    const { path, originalname } = req.file;
    const s3Key = `image/new/${originalname}`;
   
   const uploadedFile= await uploadFileToS3(path,s3Key,originalname)
    res.status(201).json({ message: "File uploaded successfully", file: uploadedFile });
  } catch (error) {
    console.log(error);
    res.status(400).json({error})
    
  }
})
async function uploadFileToS3(filePath, s3Key,fileName) {
  try {
    const signedUrl = await getImage(s3Key); 
    const data = fs.readFileSync(filePath);

    const config = {
      method: "put",
      url: signedUrl,
      headers: {
        "Content-Type": mime.lookup(filePath) || "application/octet-stream",
      },
      data: data,
    };

    await axios(config);
    console.log("File uploaded successfully:", s3Key);
    const file =File.create({fileName,s3Key})
    // await file.save()
  } catch (error) {
    console.error("Upload Error:", error);
  }
}

(async () => {
//   await uploadFileToS3("./dummy-image.jpg", "image/new/dummy-image.jpg"); 
})();

async function deleteFile(S3Key) {

    try {
       const deleteParams={
        Bucket:process.env.AWS_BUCKET,
        Key:S3Key
       }
       await s3Client.send(new DeleteObjectCommand(deleteParams))
        
    } catch (error) {
        console.error("Upload Error:", error);
    }

   
}
(async () => {
    await deleteFile("image/new/dummy-image.jpg"); 
  })();

  app.listen(PORT,"0.0.0.0", () => {
    console.log(`App is listening on port ${PORT}`);
  });