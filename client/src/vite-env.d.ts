/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PORT: string
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 