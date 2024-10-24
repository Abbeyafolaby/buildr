/* eslint-disable no-undef */
import express from "express";
import csv from "csvtojson";
import fs from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
import { GeminiEmbedding } from 'llamaindex/embeddings/GeminiEmbedding';


process.env.GOOGLE_API_KEY = 'AIzaSyDh2ZmlD8ilDKOXBg8oAamWnF_UyA2PhWk';

const csvFilePath = './data/dummy.csv';
const data = fs.readFileSync("./data/dummy.json", "utf8");
const jsonData = JSON.parse(data);

const app = express();
const port = 5125;

// Initialize Pinecone client
const pc = new Pinecone({ apiKey: "pcsk_4L121_64RrQjV8XRNsVcfvCQEpv1ZP1BeuP3THGRboo4FmWXcF4KEk2WUvxXLpwUEauzr" });

// Initialize GeminiEmbedding
const geminiEmbedding = new GeminiEmbedding({
    apiKey: process.env.GOOGLE_API_KEY, 
});

// Convert CSV to JSON and write to file
csv().fromFile(csvFilePath).then((json) => {
    console.log(json);
    fs.writeFile("./data/dummy.json", JSON.stringify(json, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
        }
    });
});

app.get("/json", (req, res) => {
    res.send(jsonData);
});

// Function to generate vectors using Gemini embeddings
const generateVectors = async () => {
    const vectors = await Promise.all(
        jsonData.map(async (item) => {
            const text = `${item.name} ${item.email}`;
            const embedding = await geminiEmbedding.getTextEmbedding(text);

            // Checking if the embedding has 768 dimensions
            if (embedding.length !== 768) {
                throw new Error(`Embedding for item ${item.id} has incorrect dimensions: ${embedding.length}`);
            }

            return {
                id: item.id,
                values: embedding,
                metadata: {
                    name: item.name,
                    email: item.email,
                    age: Number(item.age)
                },
            };
        })
    );
    return vectors;
};

// Upload data to Pinecone
const uploadData = async () => {
    const index = pc.index("csvtojson");
    const vectors = await generateVectors();
    try {
        await index.upsert(vectors);
        console.log("Data uploaded successfully");
    } catch (error) {
        console.error("Error uploading data:", error);
    }
};

uploadData();

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
