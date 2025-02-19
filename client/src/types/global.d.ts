interface Window {
  pywebview?: {
    api: {
      save_file_dialog: (
        title: string, 
        filename: string, 
        fileTypes: Array<[string, string | string[]]>
      ) => Promise<string>;
      write_binary_file: (path: string, data: Uint8Array) => Promise<void>;
    }
  }
} 