import { schema } from "@uniswap/token-lists";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import fetch from "node-fetch";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createLogger, format, transports } from "winston";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: "token-list-validator" },
  transports: [
    new transports.Console({ level: "info", format: format.simple() }),
    new transports.File({ filename: "error.log", level: "error" }),
  ],
});

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);
const validator = ajv.compile(schema);

const isUrl = (source) =>
  source.startsWith("http://") || source.startsWith("https://");

const fetchData = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from ${url}. Status: ${response.status}`
      );
    }
    return response.json();
  } catch (error) {
    logger.error(`Failed to fetch data from ${url}. Error: ${error.message}`);
    throw error;
  }
};

const readData = async (filePath) => {
  try {
    const absolutePath = join(__dirname, filePath);
    const data = await fs.readFile(absolutePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(
      `Failed to read data from ${filePath}. Error: ${error.message}`
    );
    throw error;
  }
};

const getData = async (source) =>
  isUrl(source) ? fetchData(source) : readData(source);

const validate = async (data) => {
  const valid = validator(data);
  if (valid) return valid;
  if (validator.errors) {
    const errors = validator.errors.map(
      ({ dataPath, keyword, message, params, schemaPath }) => ({
        dataPath,
        keyword,
        message,
        params,
        schemaPath,
      })
    );
    const errorMessage = `Validation failed: ${JSON.stringify(
      errors,
      null,
      2
    )}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
};

const main = async () => {
  try {
    const source = process.argv[2];
    if (!source) {
      throw new Error("Usage: node validate.js <source>");
    }

    logger.info(`Validating token list from source: ${source}`);
    const data = await getData(source);
    await validate(data);
    logger.info("Token list is valid.");
  } catch (error) {
    logger.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getData, validate };
