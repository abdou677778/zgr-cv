declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    DB: D1Database;
    ADMIN_API_TOKEN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REFRESH_TOKEN?: string;
    GOOGLE_DRIVE_ROOT_FOLDER_ID?: string;
  }
}

declare module '*.txt?raw' {
  const content: string;
  export default content;
}
