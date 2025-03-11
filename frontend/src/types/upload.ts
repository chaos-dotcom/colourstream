export interface Client {
  id: string;
  name: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string;
  client?: Client;
  uploadLinks?: UploadLink[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadLink {
  id: string;
  token: string;
  projectId: string;
  project?: Project;
  expiresAt: string;
  maxUses?: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  hash: string;
  projectId: string;
  project?: Project;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  name: string;
  code?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  clientId: string;
}

export interface CreateUploadLinkRequest {
  projectId: string;
  expiresAt: string;
  usageLimit?: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  lastUpload: string | null;
} 