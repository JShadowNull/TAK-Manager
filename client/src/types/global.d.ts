interface Window {
  pywebview?: {
    api: {
      save_file_dialog: (
        filename: string, 
        fileTypes: Array<[string, string | string[]]>
      ) => Promise<string>;
      write_binary_file: (path: string, data: Uint8Array) => Promise<void>;
    }
  };
  handleNativeFileDrop: (path: string) => void; // Added from file_context_0
} 
