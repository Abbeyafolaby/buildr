var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// index.ts
import cors from "cors";
import "dotenv/config";
import express2 from "express";

// src/controllers/sandbox.controller.ts
import {
  CodeInterpreter,
  Sandbox
} from "@e2b/code-interpreter";

// src/controllers/llamaindex/documents/helper.ts
import crypto2 from "crypto";
import fs from "fs";
import path from "path";

// src/controllers/engine/loader.ts
import { LlamaParseReader } from "llamaindex";
import {
  FILE_EXT_TO_READER,
  SimpleDirectoryReader
} from "llamaindex/readers/SimpleDirectoryReader";
var DATA_DIR = "./data";
function getExtractors() {
  const llamaParseParser = new LlamaParseReader({ resultType: "markdown" });
  const extractors = FILE_EXT_TO_READER;
  for (const key in extractors) {
    if (key === "txt") {
      continue;
    }
    extractors[key] = llamaParseParser;
  }
  return extractors;
}

// src/controllers/llamaindex/documents/helper.ts
var MIME_TYPE_TO_EXT = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};
var UPLOADED_FOLDER = "output/uploaded";
function storeFile(name, fileBuffer, mimeType) {
  return __async(this, null, function* () {
    const fileExt = MIME_TYPE_TO_EXT[mimeType];
    if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);
    const fileId = crypto2.randomUUID();
    const newFilename = `${sanitizeFileName(name)}_${fileId}.${fileExt}`;
    const filepath = path.join(UPLOADED_FOLDER, newFilename);
    const fileUrl = yield saveDocument(filepath, fileBuffer);
    return {
      id: fileId,
      name: newFilename,
      size: fileBuffer.length,
      type: fileExt,
      url: fileUrl,
      refs: []
    };
  });
}
function parseFile(fileBuffer, filename, mimeType) {
  return __async(this, null, function* () {
    const documents = yield loadDocuments(fileBuffer, mimeType);
    for (const document of documents) {
      document.metadata = __spreadProps(__spreadValues({}, document.metadata), {
        file_name: filename,
        private: "true"
        // to separate private uploads from public documents
      });
    }
    return documents;
  });
}
function loadDocuments(fileBuffer, mimeType) {
  return __async(this, null, function* () {
    const extractors = getExtractors();
    const reader = extractors[MIME_TYPE_TO_EXT[mimeType]];
    if (!reader) {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }
    console.log(`Processing uploaded document of type: ${mimeType}`);
    return yield reader.loadDataAsContent(fileBuffer);
  });
}
function saveDocument(filepath, content) {
  return __async(this, null, function* () {
    if (path.isAbsolute(filepath)) {
      throw new Error("Absolute file paths are not allowed.");
    }
    if (!process.env.FILESERVER_URL_PREFIX) {
      throw new Error("FILESERVER_URL_PREFIX environment variable is not set.");
    }
    const dirPath = path.dirname(filepath);
    yield fs.promises.mkdir(dirPath, { recursive: true });
    if (typeof content === "string") {
      yield fs.promises.writeFile(filepath, content, "utf-8");
    } else {
      yield fs.promises.writeFile(filepath, content);
    }
    const fileurl = `${process.env.FILESERVER_URL_PREFIX}/${filepath}`;
    console.log(`Saved document to ${filepath}. Reachable at URL: ${fileurl}`);
    return fileurl;
  });
}
function sanitizeFileName(fileName) {
  return fileName.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "_");
}

// src/controllers/sandbox.controller.ts
var sandboxTimeout = 10 * 60 * 1e3;
var sandbox = (req, res) => __async(void 0, null, function* () {
  const { artifact } = req.body;
  let sbx = void 0;
  if (artifact.template === "code-interpreter-multilang") {
    sbx = yield CodeInterpreter.create({
      metadata: { template: artifact.template },
      timeoutMs: sandboxTimeout
    });
    console.log("Created code interpreter", sbx.sandboxID);
  } else {
    sbx = yield Sandbox.create(artifact.template, {
      metadata: { template: artifact.template, userID: "default" },
      timeoutMs: sandboxTimeout
    });
    console.log("Created sandbox", sbx.sandboxID);
  }
  if (artifact.has_additional_dependencies) {
    if (sbx instanceof CodeInterpreter) {
      yield sbx.notebook.execCell(artifact.install_dependencies_command);
      console.log(
        `Installed dependencies: ${artifact.additional_dependencies.join(", ")} in code interpreter ${sbx.sandboxID}`
      );
    } else if (sbx instanceof Sandbox) {
      yield sbx.commands.run(artifact.install_dependencies_command);
      console.log(
        `Installed dependencies: ${artifact.additional_dependencies.join(", ")} in sandbox ${sbx.sandboxID}`
      );
    }
  }
  if (artifact.code && Array.isArray(artifact.code)) {
    artifact.code.forEach((file) => __async(void 0, null, function* () {
      yield sbx.files.write(file.file_path, file.file_content);
      console.log(`Copied file to ${file.file_path} in ${sbx.sandboxID}`);
    }));
  } else {
    yield sbx.files.write(artifact.file_path, artifact.code);
    console.log(`Copied file to ${artifact.file_path} in ${sbx.sandboxID}`);
  }
  if (artifact.template === "code-interpreter-multilang") {
    const result = yield sbx.notebook.execCell(
      artifact.code || ""
    );
    yield sbx.close();
    const outputUrls = yield downloadCellResults(result.results);
    return res.status(200).json({
      template: artifact.template,
      stdout: result.logs.stdout,
      stderr: result.logs.stderr,
      runtimeError: result.error,
      outputUrls
    });
  } else {
    return res.status(200).json({
      template: artifact.template,
      url: `https://${sbx == null ? void 0 : sbx.getHost(artifact.port || 80)}`
    });
  }
});
function downloadCellResults(cellResults) {
  return __async(this, null, function* () {
    if (!cellResults) return [];
    const results = yield Promise.all(
      cellResults.map((res) => __async(this, null, function* () {
        const formats = res.formats();
        const formatResults = yield Promise.all(
          formats.map((ext) => __async(this, null, function* () {
            const filename = `${crypto.randomUUID()}.${ext}`;
            const base64 = res[ext];
            const buffer = Buffer.from(base64, "base64");
            const fileurl = yield saveDocument(filename, buffer);
            return { url: fileurl, filename };
          }))
        );
        return formatResults;
      }))
    );
    return results.flat();
  });
}

// src/observability/index.ts
var initObservability = () => {
};

// src/routes/chat.route.ts
import express from "express";

// src/controllers/chat-config.controller.ts
import { LLamaCloudFileService } from "llamaindex";
var chatConfig = (_req, res) => __async(void 0, null, function* () {
  let starterQuestions = void 0;
  if (process.env.CONVERSATION_STARTERS && process.env.CONVERSATION_STARTERS.trim()) {
    starterQuestions = process.env.CONVERSATION_STARTERS.trim().split("\n");
  }
  return res.status(200).json({
    starterQuestions
  });
});
var chatLlamaCloudConfig = (_req, res) => __async(void 0, null, function* () {
  if (!process.env.LLAMA_CLOUD_API_KEY) {
    return res.status(500).json({
      error: "env variable LLAMA_CLOUD_API_KEY is required to use LlamaCloud"
    });
  }
  const config = {
    projects: yield LLamaCloudFileService.getAllProjectsWithPipelines(),
    pipeline: {
      pipeline: process.env.LLAMA_CLOUD_INDEX_NAME,
      project: process.env.LLAMA_CLOUD_PROJECT_NAME
    }
  };
  return res.status(200).json(config);
});

// src/controllers/engine/chat.ts
import { ContextChatEngine, Settings } from "llamaindex";

// src/controllers/engine/index.ts
import { VectorStoreIndex } from "llamaindex";
import { PineconeVectorStore } from "llamaindex/vector-store/PineconeVectorStore";

// src/controllers/engine/shared.ts
var REQUIRED_ENV_VARS = ["PINECONE_ENVIRONMENT", "PINECONE_API_KEY"];
function checkRequiredEnvVars() {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((envVar) => {
    return !process.env[envVar];
  });
  if (missingEnvVars.length > 0) {
    console.log(
      `The following environment variables are required but missing: ${missingEnvVars.join(
        ", "
      )}`
    );
    throw new Error(
      `Missing environment variables: ${missingEnvVars.join(", ")}`
    );
  }
}

// src/controllers/engine/index.ts
function getDataSource(params) {
  return __async(this, null, function* () {
    checkRequiredEnvVars();
    const store = new PineconeVectorStore();
    return yield VectorStoreIndex.fromVectorStore(store);
  });
}

// src/controllers/engine/nodePostprocessors.ts
var NodeCitationProcessor = class {
  /**
   * Append node_id into metadata for citation purpose.
   * Config SYSTEM_CITATION_PROMPT in your runtime environment variable to enable this feature.
   */
  postprocessNodes(nodes, query) {
    return __async(this, null, function* () {
      for (const nodeScore of nodes) {
        if (!nodeScore.node || !nodeScore.node.metadata) {
          continue;
        }
        nodeScore.node.metadata["node_id"] = nodeScore.node.id_;
      }
      return nodes;
    });
  }
};
var nodeCitationProcessor = new NodeCitationProcessor();

// src/controllers/engine/queryFilter.ts
function generateFilters(documentIds) {
  const publicDocumentsFilter = {
    key: "private",
    value: "true",
    operator: "!="
  };
  if (!documentIds.length) return { filters: [publicDocumentsFilter] };
  const privateDocumentsFilter = {
    key: "doc_id",
    value: documentIds,
    operator: "in"
  };
  return {
    filters: [publicDocumentsFilter, privateDocumentsFilter],
    condition: "or"
  };
}

// src/controllers/engine/chat.ts
function createChatEngine(documentIds, params) {
  return __async(this, null, function* () {
    const index = yield getDataSource(params);
    if (!index) {
      throw new Error(
        `StorageContext is empty - call 'npm run generate' to generate the storage first`
      );
    }
    const retriever = index.asRetriever({
      similarityTopK: process.env.TOP_K ? parseInt(process.env.TOP_K) : void 0,
      filters: generateFilters(documentIds || [])
    });
    const systemPrompt = process.env.SYSTEM_PROMPT;
    const citationPrompt = process.env.SYSTEM_CITATION_PROMPT;
    const prompt = [systemPrompt, citationPrompt].filter((p) => p).join("\n") || void 0;
    const nodePostprocessors = citationPrompt ? [nodeCitationProcessor] : void 0;
    return new ContextChatEngine({
      chatModel: Settings.llm,
      retriever,
      systemPrompt: prompt,
      nodePostprocessors
    });
  });
}

// src/controllers/chat-request.controller.ts
var convertMessageContent = (textMessage, imageUrl) => {
  if (!imageUrl) return textMessage;
  return [
    {
      type: "text",
      text: textMessage
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    }
  ];
};
var chatRequest = (req, res) => __async(void 0, null, function* () {
  try {
    const { messages, data: data2 } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error: "messages are required in the request body and the last message must be from the user"
      });
    }
    const userMessageContent = convertMessageContent(
      userMessage.content,
      data2 == null ? void 0 : data2.imageUrl
    );
    const chatEngine = yield createChatEngine();
    const response = yield chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages
    });
    const result = {
      role: "assistant",
      content: response.response
    };
    return res.status(200).json({
      result
    });
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: error.message
    });
  }
});

// src/controllers/llamaindex/documents/upload.ts
import { LLamaCloudFileService as LLamaCloudFileService2 } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import fs2 from "fs/promises";
import path2 from "path";

// src/controllers/llamaindex/documents/pipeline.ts
import {
  IngestionPipeline,
  Settings as Settings2,
  SimpleNodeParser,
  VectorStoreIndex as VectorStoreIndex2
} from "llamaindex";
function runPipeline(currentIndex, documents) {
  return __async(this, null, function* () {
    const pipeline = new IngestionPipeline({
      transformations: [
        new SimpleNodeParser({
          chunkSize: Settings2.chunkSize,
          chunkOverlap: Settings2.chunkOverlap
        }),
        Settings2.embedModel
      ]
    });
    const nodes = yield pipeline.run({ documents });
    if (currentIndex) {
      yield currentIndex.insertNodes(nodes);
      currentIndex.storageContext.docStore.persist();
      console.log("Added nodes to the vector store.");
      return documents.map((document) => document.id_);
    } else {
      const newIndex = yield VectorStoreIndex2.fromDocuments(documents);
      newIndex.storageContext.docStore.persist();
      console.log(
        "Got empty index, created new index with the uploaded documents"
      );
      return documents.map((document) => document.id_);
    }
  });
}

// src/controllers/llamaindex/documents/upload.ts
function uploadDocument(index, name, raw) {
  return __async(this, null, function* () {
    const [header, content] = raw.split(",");
    const mimeType = header.replace("data:", "").replace(";base64", "");
    const fileBuffer = Buffer.from(content, "base64");
    const fileMetadata = yield storeFile(name, fileBuffer, mimeType);
    if (mimeType === "text/csv" && (yield hasCodeExecutorTool())) {
      return fileMetadata;
    }
    let documentIds = [];
    if (index instanceof LlamaCloudIndex) {
      const projectId = yield index.getProjectId();
      const pipelineId = yield index.getPipelineId();
      try {
        documentIds = [
          yield LLamaCloudFileService2.addFileToPipeline(
            projectId,
            pipelineId,
            new File([fileBuffer], name, { type: mimeType }),
            { private: "true" }
          )
        ];
      } catch (error) {
        if (error instanceof ReferenceError && error.message.includes("File is not defined")) {
          throw new Error(
            "File class is not supported in the current Node.js version. Please use Node.js 20 or higher."
          );
        }
        throw error;
      }
    } else {
      const documents = yield parseFile(fileBuffer, name, mimeType);
      documentIds = yield runPipeline(index, documents);
    }
    fileMetadata.refs = documentIds;
    return fileMetadata;
  });
}
var hasCodeExecutorTool = () => __async(void 0, null, function* () {
  const codeExecutorTools = ["interpreter", "artifact"];
  const configFile = path2.join("config", "tools.json");
  const toolConfig = JSON.parse(yield fs2.readFile(configFile, "utf8"));
  const localTools = toolConfig.local || {};
  return codeExecutorTools.some((tool) => localTools[tool] !== void 0);
});

// src/controllers/chat-upload.controller.ts
var chatUpload = (req, res) => __async(void 0, null, function* () {
  const {
    name,
    base64,
    params
  } = req.body;
  if (!base64 || !name) {
    return res.status(400).json({
      error: "base64 and filename is required in the request body"
    });
  }
  const index = yield getDataSource(params);
  if (!index) {
    return res.status(500).json({
      error: "StorageContext is empty - call 'npm run generate' to generate the storage first"
    });
  }
  return res.status(200).json(yield uploadDocument(index, name, base64));
});

// src/controllers/chat.controller.ts
import { LlamaIndexAdapter, StreamData, streamToResponse } from "ai";
import { Settings as Settings4 } from "llamaindex";

// src/controllers/llamaindex/streaming/annotations.ts
function isValidMessages(messages) {
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  return lastMessage !== null && lastMessage.role === "user";
}
function retrieveDocumentIds(messages) {
  const documentFiles = retrieveDocumentFiles(messages);
  return documentFiles.map((file) => file.refs || []).flat();
}
function retrieveDocumentFiles(messages) {
  const annotations = getAllAnnotations(messages);
  if (annotations.length === 0) return [];
  const files = [];
  for (const { type, data: data2 } of annotations) {
    if (type === "document_file" && "files" in data2 && Array.isArray(data2.files)) {
      files.push(...data2.files);
    }
  }
  return files;
}
function retrieveMessageContent(messages) {
  const userMessage = messages[messages.length - 1];
  return [
    {
      type: "text",
      text: userMessage.content
    },
    ...retrieveLatestArtifact(messages),
    ...convertAnnotations(messages)
  ];
}
function getFileContent(file) {
  let defaultContent = `=====File: ${file.name}=====
`;
  const urlPrefix = process.env.FILESERVER_URL_PREFIX;
  let urlContent = "";
  if (urlPrefix) {
    if (file.url) {
      urlContent = `File URL: ${file.url}
`;
    } else {
      urlContent = `File URL (instruction: do not update this file URL yourself): ${urlPrefix}/output/uploaded/${file.name}
`;
    }
  } else {
    console.warn(
      "Warning: FILESERVER_URL_PREFIX not set in environment variables. Can't use file server"
    );
  }
  defaultContent += urlContent;
  if (file.refs) {
    defaultContent += `Document IDs: ${file.refs}
`;
  }
  const sandboxFilePath = `/tmp/${file.name}`;
  defaultContent += `Sandbox file path (instruction: only use sandbox path for artifact or code interpreter tool): ${sandboxFilePath}
`;
  return defaultContent;
}
function getAllAnnotations(messages) {
  return messages.flatMap(
    (message) => {
      var _a;
      return ((_a = message.annotations) != null ? _a : []).map(
        (annotation) => getValidAnnotation(annotation)
      );
    }
  );
}
function retrieveLatestArtifact(messages) {
  var _a;
  const annotations = getAllAnnotations(messages);
  if (annotations.length === 0) return [];
  for (const { type, data: data2 } of annotations.reverse()) {
    if (type === "tools" && "toolCall" in data2 && "toolOutput" in data2 && typeof data2.toolCall === "object" && typeof data2.toolOutput === "object" && data2.toolCall !== null && data2.toolOutput !== null && "name" in data2.toolCall && data2.toolCall.name === "artifact") {
      const toolOutput = data2.toolOutput;
      if ((_a = toolOutput.output) == null ? void 0 : _a.code) {
        return [
          {
            type: "text",
            text: `The existing code is:
\`\`\`
${toolOutput.output.code}
\`\`\``
          }
        ];
      }
    }
  }
  return [];
}
function convertAnnotations(messages) {
  var _a, _b;
  const annotations = ((_b = (_a = messages.slice().reverse().find((message) => message.role === "user" && message.annotations)) == null ? void 0 : _a.annotations) == null ? void 0 : _b.map(getValidAnnotation)) || [];
  if (annotations.length === 0) return [];
  const content = [];
  annotations.forEach(({ type, data: data2 }) => {
    if (type === "image" && "url" in data2 && typeof data2.url === "string") {
      content.push({
        type: "image_url",
        image_url: {
          url: data2.url
        }
      });
    }
    if (type === "document_file" && "files" in data2 && Array.isArray(data2.files)) {
      const fileContent = data2.files.map(getFileContent).join("\n");
      content.push({
        type: "text",
        text: fileContent
      });
    }
  });
  return content;
}
function getValidAnnotation(annotation) {
  if (!(annotation && typeof annotation === "object" && "type" in annotation && typeof annotation.type === "string" && "data" in annotation && annotation.data && typeof annotation.data === "object")) {
    throw new Error("Client sent invalid annotation. Missing data and type");
  }
  return { type: annotation.type, data: annotation.data };
}

// src/controllers/llamaindex/streaming/events.ts
import {
  CallbackManager,
  LLamaCloudFileService as LLamaCloudFileService3,
  MetadataMode
} from "llamaindex";
import path4 from "path";

// src/controllers/llamaindex/streaming/file.ts
import fs3 from "fs";
import https from "https";
import path3 from "path";
function downloadFile(urlToDownload, filename, folder = "output/uploaded") {
  return __async(this, null, function* () {
    try {
      const downloadedPath = path3.join(folder, filename);
      if (fs3.existsSync(downloadedPath)) return;
      const file = fs3.createWriteStream(downloadedPath);
      https.get(urlToDownload, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            console.log("File downloaded successfully");
          });
        });
      }).on("error", (err) => {
        fs3.unlink(downloadedPath, () => {
          console.error("Error downloading file:", err);
          throw err;
        });
      });
    } catch (error) {
      throw new Error(`Error downloading file: ${error}`);
    }
  });
}

// src/controllers/llamaindex/streaming/events.ts
var LLAMA_CLOUD_DOWNLOAD_FOLDER = "output/llamacloud";
function appendSourceData(data2, sourceNodes) {
  if (!(sourceNodes == null ? void 0 : sourceNodes.length)) return;
  try {
    const nodes = sourceNodes.map((node) => {
      var _a;
      return {
        metadata: node.node.metadata,
        id: node.node.id_,
        score: (_a = node.score) != null ? _a : null,
        url: getNodeUrl(node.node.metadata),
        text: node.node.getContent(MetadataMode.NONE)
      };
    });
    data2.appendMessageAnnotation({
      type: "sources",
      data: {
        nodes
      }
    });
  } catch (error) {
    console.error("Error appending source data:", error);
  }
}
function appendEventData(data2, title) {
  if (!title) return;
  data2.appendMessageAnnotation({
    type: "events",
    data: {
      title
    }
  });
}
function appendToolData(data2, toolCall, toolOutput) {
  data2.appendMessageAnnotation({
    type: "tools",
    data: {
      toolCall: {
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input
      },
      toolOutput: {
        output: toolOutput.output,
        isError: toolOutput.isError
      }
    }
  });
}
function createCallbackManager(stream) {
  const callbackManager = new CallbackManager();
  callbackManager.on("retrieve-end", (data2) => {
    const { nodes, query } = data2.detail;
    appendSourceData(stream, nodes);
    appendEventData(stream, `Retrieving context for query: '${query.query}'`);
    appendEventData(
      stream,
      `Retrieved ${nodes.length} sources to use as context for the query`
    );
    downloadFilesFromNodes(nodes);
  });
  callbackManager.on("llm-tool-call", (event) => {
    const { name, input } = event.detail.toolCall;
    const inputString = Object.entries(input).map(([key, value]) => `${key}: ${value}`).join(", ");
    appendEventData(
      stream,
      `Using tool: '${name}' with inputs: '${inputString}'`
    );
  });
  callbackManager.on("llm-tool-result", (event) => {
    const { toolCall, toolResult } = event.detail;
    appendToolData(stream, toolCall, toolResult);
  });
  return callbackManager;
}
function getNodeUrl(metadata) {
  if (!process.env.FILESERVER_URL_PREFIX) {
    console.warn(
      "FILESERVER_URL_PREFIX is not set. File URLs will not be generated."
    );
  }
  const fileName = metadata["file_name"];
  if (fileName && process.env.FILESERVER_URL_PREFIX) {
    const pipelineId = metadata["pipeline_id"];
    if (pipelineId) {
      const name = toDownloadedName(pipelineId, fileName);
      return `${process.env.FILESERVER_URL_PREFIX}/${LLAMA_CLOUD_DOWNLOAD_FOLDER}/${name}`;
    }
    const isPrivate = metadata["private"] === "true";
    if (isPrivate) {
      return `${process.env.FILESERVER_URL_PREFIX}/output/uploaded/${fileName}`;
    }
    const filePath = metadata["file_path"];
    const dataDir = path4.resolve(DATA_DIR);
    if (filePath && dataDir) {
      const relativePath = path4.relative(dataDir, filePath);
      return `${process.env.FILESERVER_URL_PREFIX}/data/${relativePath}`;
    }
  }
  return metadata["URL"];
}
function downloadFilesFromNodes(nodes) {
  return __async(this, null, function* () {
    try {
      const files = nodesToLlamaCloudFiles(nodes);
      for (const { pipelineId, fileName, downloadedName } of files) {
        const downloadUrl = yield LLamaCloudFileService3.getFileUrl(
          pipelineId,
          fileName
        );
        if (downloadUrl) {
          yield downloadFile(
            downloadUrl,
            downloadedName,
            LLAMA_CLOUD_DOWNLOAD_FOLDER
          );
        }
      }
    } catch (error) {
      console.error("Error downloading files from nodes:", error);
    }
  });
}
function nodesToLlamaCloudFiles(nodes) {
  const files = [];
  for (const node of nodes) {
    const pipelineId = node.node.metadata["pipeline_id"];
    const fileName = node.node.metadata["file_name"];
    if (!pipelineId || !fileName) continue;
    const isDuplicate = files.some(
      (f) => f.pipelineId === pipelineId && f.fileName === fileName
    );
    if (!isDuplicate) {
      files.push({
        pipelineId,
        fileName,
        downloadedName: toDownloadedName(pipelineId, fileName)
      });
    }
  }
  return files;
}
function toDownloadedName(pipelineId, fileName) {
  return `${pipelineId}$${fileName}`;
}

// src/controllers/llamaindex/streaming/suggestion.ts
import { Settings as Settings3 } from "llamaindex";
function generateNextQuestions(conversation) {
  return __async(this, null, function* () {
    const llm = Settings3.llm;
    const NEXT_QUESTION_PROMPT = process.env.NEXT_QUESTION_PROMPT;
    if (!NEXT_QUESTION_PROMPT) {
      return [];
    }
    const conversationText = conversation.map((message2) => `${message2.role}: ${message2.content}`).join("\n");
    const message = NEXT_QUESTION_PROMPT.replace(
      "{conversation}",
      conversationText
    );
    try {
      const response = yield llm.complete({ prompt: message });
      const questions = extractQuestions(response.text);
      return questions;
    } catch (error) {
      console.error("Error when generating the next questions: ", error);
      return [];
    }
  });
}
function extractQuestions(text) {
  const contentMatch = text.match(new RegExp("```(.*?)```", "s"));
  const content = contentMatch ? contentMatch[1] : "";
  const questions = content.split("\n").map((question) => question.trim()).filter((question) => question !== "");
  return questions;
}

// src/controllers/chat.controller.ts
var chat = (req, res) => __async(void 0, null, function* () {
  const vercelStreamData = new StreamData();
  try {
    const { messages, data: data2 } = req.body;
    if (!isValidMessages(messages)) {
      return res.status(400).json({
        error: "messages are required in the request body and the last message must be from the user"
      });
    }
    const ids = retrieveDocumentIds(messages);
    const chatEngine = yield createChatEngine(ids, data2);
    const userMessageContent = retrieveMessageContent(messages);
    const callbackManager = createCallbackManager(vercelStreamData);
    const chatHistory = messages;
    const response = yield Settings4.withCallbackManager(callbackManager, () => {
      return chatEngine.chat({
        message: userMessageContent,
        chatHistory,
        stream: true
      });
    });
    const onFinal = (content) => {
      chatHistory.push({ role: "assistant", content });
      generateNextQuestions(chatHistory).then((questions) => {
        if (questions.length > 0) {
          vercelStreamData.appendMessageAnnotation({
            type: "suggested_questions",
            data: questions
          });
        }
      }).finally(() => {
        vercelStreamData.close();
      });
    };
    const stream = LlamaIndexAdapter.toDataStream(response, { onFinal });
    return streamToResponse(stream, res, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: error.message
    });
  }
});

// src/controllers/engine/settings.ts
import {
  Anthropic,
  Gemini,
  GeminiEmbedding,
  Groq,
  MistralAI,
  MistralAIEmbedding,
  OpenAI,
  OpenAIEmbedding,
  Settings as Settings5
} from "llamaindex";
import { HuggingFaceEmbedding } from "llamaindex/embeddings/HuggingFaceEmbedding";
import { OllamaEmbedding } from "llamaindex/embeddings/OllamaEmbedding";
import { Ollama } from "llamaindex/llm/ollama";
var CHUNK_SIZE = 512;
var CHUNK_OVERLAP = 20;
var initSettings = () => __async(void 0, null, function* () {
  console.log(`Using '${process.env.MODEL_PROVIDER}' model provider`);
  if (!process.env.MODEL || !process.env.EMBEDDING_MODEL) {
    throw new Error("'MODEL' and 'EMBEDDING_MODEL' env variables must be set.");
  }
  switch (process.env.MODEL_PROVIDER) {
    case "ollama":
      initOllama();
      break;
    case "groq":
      initGroq();
      break;
    case "anthropic":
      initAnthropic();
      break;
    case "gemini":
      initGemini();
      break;
    case "mistral":
      initMistralAI();
      break;
    case "azure-openai":
      initAzureOpenAI();
      break;
    default:
      initOpenAI();
      break;
  }
  Settings5.chunkSize = CHUNK_SIZE;
  Settings5.chunkOverlap = CHUNK_OVERLAP;
});
function initOpenAI() {
  var _a;
  Settings5.llm = new OpenAI({
    model: (_a = process.env.MODEL) != null ? _a : "gpt-4o-mini",
    maxTokens: process.env.LLM_MAX_TOKENS ? Number(process.env.LLM_MAX_TOKENS) : void 0
  });
  Settings5.embedModel = new OpenAIEmbedding({
    model: process.env.EMBEDDING_MODEL,
    dimensions: process.env.EMBEDDING_DIM ? parseInt(process.env.EMBEDDING_DIM) : void 0
  });
}
function initAzureOpenAI() {
  var _a, _b;
  const AZURE_OPENAI_MODEL_MAP = {
    "gpt-35-turbo": "gpt-3.5-turbo",
    "gpt-35-turbo-16k": "gpt-3.5-turbo-16k",
    "gpt-4o": "gpt-4o",
    "gpt-4": "gpt-4",
    "gpt-4-32k": "gpt-4-32k",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
    "gpt-4-vision-preview": "gpt-4-vision-preview",
    "gpt-4-1106-preview": "gpt-4-1106-preview",
    "gpt-4o-2024-05-13": "gpt-4o-2024-05-13"
  };
  const azureConfig = {
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || process.env.OPENAI_API_VERSION
  };
  Settings5.llm = new OpenAI({
    model: (_b = AZURE_OPENAI_MODEL_MAP[(_a = process.env.MODEL) != null ? _a : "gpt-35-turbo"]) != null ? _b : "gpt-3.5-turbo",
    maxTokens: process.env.LLM_MAX_TOKENS ? Number(process.env.LLM_MAX_TOKENS) : void 0,
    azure: __spreadProps(__spreadValues({}, azureConfig), {
      deployment: process.env.AZURE_OPENAI_LLM_DEPLOYMENT
    })
  });
  Settings5.embedModel = new OpenAIEmbedding({
    model: process.env.EMBEDDING_MODEL,
    dimensions: process.env.EMBEDDING_DIM ? parseInt(process.env.EMBEDDING_DIM) : void 0,
    azure: __spreadProps(__spreadValues({}, azureConfig), {
      deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
    })
  });
}
function initOllama() {
  var _a, _b, _c;
  const config = {
    host: (_a = process.env.OLLAMA_BASE_URL) != null ? _a : "http://127.0.0.1:11434"
  };
  Settings5.llm = new Ollama({
    model: (_b = process.env.MODEL) != null ? _b : "",
    config
  });
  Settings5.embedModel = new OllamaEmbedding({
    model: (_c = process.env.EMBEDDING_MODEL) != null ? _c : "",
    config
  });
}
function initGroq() {
  const embedModelMap = {
    "all-MiniLM-L6-v2": "Xenova/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "Xenova/all-mpnet-base-v2"
  };
  Settings5.llm = new Groq({
    model: process.env.MODEL
  });
  Settings5.embedModel = new HuggingFaceEmbedding({
    modelType: embedModelMap[process.env.EMBEDDING_MODEL]
  });
}
function initAnthropic() {
  const embedModelMap = {
    "all-MiniLM-L6-v2": "Xenova/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "Xenova/all-mpnet-base-v2"
  };
  Settings5.llm = new Anthropic({
    model: process.env.MODEL
  });
  Settings5.embedModel = new HuggingFaceEmbedding({
    modelType: embedModelMap[process.env.EMBEDDING_MODEL]
  });
}
function initGemini() {
  Settings5.llm = new Gemini({
    model: process.env.MODEL
  });
  Settings5.embedModel = new GeminiEmbedding({
    model: process.env.EMBEDDING_MODEL
  });
}
function initMistralAI() {
  Settings5.llm = new MistralAI({
    model: process.env.MODEL
  });
  Settings5.embedModel = new MistralAIEmbedding({
    model: process.env.EMBEDDING_MODEL
  });
}

// src/routes/chat.route.ts
var llmRouter = express.Router();
initSettings();
llmRouter.route("/").post(chat);
llmRouter.route("/request").post(chatRequest);
llmRouter.route("/config").get(chatConfig);
llmRouter.route("/config/llamacloud").get(chatLlamaCloudConfig);
llmRouter.route("/upload").post(chatUpload);
var chat_route_default = llmRouter;

// index.ts
import csv from "csvtojson";
import fs4 from "fs";
var csvFilePath = "./data/dummy.csv";
var data = fs4.readFileSync("./data/dummy.json", "utf8");
var jsonFile = JSON.parse(data);
var app = express2();
var port = parseInt(process.env.PORT || "8000");
var env = process.env["NODE_ENV"];
var isDevelopment = !env || env === "development";
var prodCorsOrigin = process.env["PROD_CORS_ORIGIN"];
initObservability();
csv().fromFile(csvFilePath).then((json) => {
  console.log(json);
  fs4.writeFile("./data/dummy.json", JSON.stringify(json, null, 2), (err) => {
    if (err) {
      console.error("Error writing file:", err);
    }
  });
});
app.get("/json", (req, res) => {
  res.send(jsonFile);
});
app.use(express2.json({ limit: "50mb" }));
if (isDevelopment) {
  console.warn("Running in development mode - allowing CORS for all origins");
  app.use(cors());
} else if (prodCorsOrigin) {
  console.log(
    `Running in production mode - allowing CORS for domain: ${prodCorsOrigin}`
  );
  const corsOptions = {
    origin: prodCorsOrigin
    // Restrict to production domain
  };
  app.use(cors(corsOptions));
} else {
  console.warn("Production CORS origin not set, defaulting to no CORS.");
}
app.use("/api/files/data", express2.static("data"));
app.use("/api/files/output", express2.static("output"));
app.use(express2.text());
app.get("/", (req, res) => {
  res.send("LlamaIndex Express Server");
});
app.use("/api/chat", chat_route_default);
app.use("/api/sandbox", sandbox);
app.listen(port, () => {
  console.log(`\u26A1\uFE0F[server]: Server is running at http://localhost:${port}`);
});
