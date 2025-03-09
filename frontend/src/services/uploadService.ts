import { ApiResponse } from '../types';
import {
  Client,
  Project,
  UploadLink,
  UploadedFile,
  CreateClientRequest,
  CreateProjectRequest,
  CreateUploadLinkRequest,
} from '../types/upload';

const API_BASE = process.env.REACT_APP_API_URL || '';

// Client Management
export const getClients = async (): Promise<ApiResponse<Client[]>> => {
  const response = await fetch(`${API_BASE}/api/clients`, {
    credentials: 'include',
  });
  return response.json();
};

export const createClient = async (data: CreateClientRequest): Promise<ApiResponse<Client>> => {
  const response = await fetch(`${API_BASE}/api/clients`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

// Project Management
export const getClientProjects = async (clientId: string): Promise<ApiResponse<Project[]>> => {
  const response = await fetch(`${API_BASE}/api/clients/${clientId}/projects`, {
    credentials: 'include',
  });
  return response.json();
};

export const createProject = async (
  clientId: string,
  data: CreateProjectRequest
): Promise<ApiResponse<Project>> => {
  const response = await fetch(`${API_BASE}/api/clients/${clientId}/projects`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

// Upload Link Management
export const createUploadLink = async (
  projectId: string,
  data: CreateUploadLinkRequest
): Promise<ApiResponse<UploadLink>> => {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/upload-links`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const getUploadLink = async (token: string): Promise<ApiResponse<UploadLink>> => {
  const response = await fetch(`${API_BASE}/api/upload-links/${token}`, {
    credentials: 'include',
  });
  return response.json();
};

// File Management
export const getProjectFiles = async (projectId: string): Promise<ApiResponse<UploadedFile[]>> => {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
    credentials: 'include',
  });
  return response.json();
};

export const downloadFile = async (fileId: string): Promise<Blob> => {
  const response = await fetch(`${API_BASE}/api/files/${fileId}/download`, {
    credentials: 'include',
  });
  return response.blob();
}; 