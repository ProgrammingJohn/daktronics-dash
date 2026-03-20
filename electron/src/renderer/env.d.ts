import type { BridgeResult, RequestJsonArgs, UploadTemplateArgs } from "./api/types";

declare global {
  interface Window {
    dakdashApi: {
      requestJson: <T = unknown>(payload: RequestJsonArgs) => Promise<BridgeResult<T>>;
      uploadTemplate: <T = unknown>(payload: UploadTemplateArgs) => Promise<BridgeResult<T>>;
    };
  }
}

export {};
