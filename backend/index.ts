/* eslint-disable turbo/no-undeclared-env-vars */
import cors from "cors";
import "dotenv/config";
import express, { Express, Request, Response } from "express";
import { sandbox } from "./src/controllers/sandbox.controller";
import { initObservability } from "./src/observability";
import chatRouter from "./src/routes/chat.route";
const csvFilePath ='./data/dummy.csv';
import csv from "csvtojson";
import fs from "fs";
const data = fs.readFileSync("./data/dummy.json", "utf8");
const jsonFile = JSON.parse(data)

const app: Express = express();
const port = parseInt(process.env.PORT || "8000");

const env = process.env["NODE_ENV"];
const isDevelopment = !env || env === "development";
const prodCorsOrigin = process.env["PROD_CORS_ORIGIN"];

initObservability();

csv().fromFile(csvFilePath).then((json) => {
  console.log(json);
  fs.writeFile("./data/dummy.json", JSON.stringify(json, null, 2), (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Error writing file:', err);
    }
  });
});

app.get("/json", (req, res) => {
  res.send(jsonFile);
})


app.use(express.json({ limit: "50mb" }));

if (isDevelopment) {
  console.warn("Running in development mode - allowing CORS for all origins");
  app.use(cors());
} else if (prodCorsOrigin) {
  console.log(
    `Running in production mode - allowing CORS for domain: ${prodCorsOrigin}`,
  );
  const corsOptions = {
    origin: prodCorsOrigin, // Restrict to production domain
  };
  app.use(cors(corsOptions));
} else {
  console.warn("Production CORS origin not set, defaulting to no CORS.");
}

app.use("/api/files/data", express.static("data"));
app.use("/api/files/output", express.static("output"));
app.use(express.text());

app.get("/", (req: Request, res: Response) => {
  res.send("LlamaIndex Express Server");
});

app.use("/api/chat", chatRouter);
app.use("/api/sandbox", sandbox);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
