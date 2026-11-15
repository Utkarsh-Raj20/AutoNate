import Cryptr from "cryptr";

if (!process.env.ENCRYPTION_KEY) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is required but not set. " +
    "Please add it to your environment variables."
  );
}

if (process.env.ENCRYPTION_KEY.length < 32) {
  throw new Error(
    "ENCRYPTION_KEY must be at least 32 characters long. " +
    `Current length: ${process.env.ENCRYPTION_KEY.length}`
  );
}

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY);

export const encrypt = (text: string): string => {
  if (!text || text.trim() === "") {
    throw new Error("Cannot encrypt empty text");
  }
  return cryptr.encrypt(text);
};

export const decrypt = (text: string): string => {
  if (!text || text.trim() === "") {
    throw new Error("Cannot decrypt empty text");
  }
  try {
    return cryptr.decrypt(text);
  } catch (error) {
    throw new Error(
      `Failed to decrypt value. This usually means the ENCRYPTION_KEY used to encrypt ` +
      `the data is different from the current ENCRYPTION_KEY. ` +
      `Original error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
