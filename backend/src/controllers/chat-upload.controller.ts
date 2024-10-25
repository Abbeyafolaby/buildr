import { Request, Response } from "express";
import { getDataSource } from "./engine";
import { uploadDocument } from "./llamaindex/documents/upload";

export const chatUpload = async (req: Request, res: Response) => {
  const {
    name,
    base64,
    params,
  }: { name: string; base64: string; params?: any } = req.body;
  if (!base64 || !name) {
    return res.status(400).json({
      error: "base64 and filename is required in the request body",
    });
  }
  const index = await getDataSource(params);
  if (!index) {
    return res.status(500).json({
      error:
        "StorageContext is empty - call 'npm run generate' to generate the storage first",
    });
  }
  return res.status(200).json(await uploadDocument(index, name, base64));
};
