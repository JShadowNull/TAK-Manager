/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PORT: string
  readonly VITE_PORT: string
  readonly VITE_CORS_ALLOW_CREDENTIALS: string
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 