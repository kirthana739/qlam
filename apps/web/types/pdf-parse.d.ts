declare module "pdf-parse" {
  export interface PDFParseOptions {
    data: Buffer | Uint8Array;
    verbosity?: number;
  }

  export interface PDFTextResult {
    text: string;
    pages: Array<{ text: string; num: number }>;
    total: number;
  }

  export class PDFParse {
    constructor(options: PDFParseOptions);
    load(): Promise<unknown>;
    getText(options?: { pageJoiner?: string }): Promise<PDFTextResult>;
    destroy(): Promise<void>;
  }

  export default PDFParse;
}
