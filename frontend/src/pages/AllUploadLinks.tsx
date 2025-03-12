import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { UPLOAD_ENDPOINT_URL } from '../config';

interface Client {
  id: string;
  name: string;
  code?: string;
}

interface Project {
  id: string;
  name: string;
  client: Client;
}

interface UploadLink {
  id: string;
  token: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  project: Project;
}

const AllUploadLinks: React.FC = () => {
  const [uploadLinks, setUploadLinks] = useState<UploadLink[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<UploadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<UploadLink | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const fetchUploadLinks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/upload/upload-links/all');
      const data = response.data;
      
      if (data.status === 'success') {
        setUploadLinks(data.data);
        setFilteredLinks(data.data);
      } else {
        setError(data.message || 'Failed to fetch upload links');
      }
    } catch (err) {
      setError('Failed to fetch upload links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploadLinks();
  }, []);

  useEffect(() => {
    const filtered = uploadLinks.filter(
      (link) =>
        link.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.project.client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredLinks(filtered);
  }, [searchTerm, uploadLinks]);

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;
    
    try {
      const response = await api.delete(`/upload/upload-links/${linkToDelete.id}`);
      const data = response.data;
      
      if (data.status === 'success') {
        // Remove the deleted link from state
        setUploadLinks(uploadLinks.filter(link => link.id !== linkToDelete.id));
        setDeleteDialogOpen(false);
        setLinkToDelete(null);
      } else {
        setError(data.message || 'Failed to delete upload link');
      }
    } catch (err) {
      setError('Failed to delete upload link');
    }
  };

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${UPLOAD_ENDPOINT_URL}${token}`);
      setCopySuccess(token);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setError('Failed to copy link to clipboard');
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        All Upload Links
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box mb={3} display="flex" alignItems="center">
        <TextField
          label="Search by token, project or client"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mr: 2 }}
        />
        <Tooltip title="Refresh links">
          <Button
            variant="contained"
            color="primary"
            onClick={fetchUploadLinks}
          >
            Refresh
          </Button>
        </Tooltip>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Upload Token</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLinks.length > 0 ? (
              filteredLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {link.token}
                      <Tooltip title={copySuccess === link.token ? "Copied!" : "Copy link"}>
                        <IconButton size="small" onClick={() => handleCopyLink(link.token)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>{link.project.client.name}</TableCell>
                  <TableCell>
                    <Link to={`/upload/projects/${link.project.id}`}>
                      {link.project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {!link.isActive ? (
                      <Chip label="Inactive" color="error" size="small" />
                    ) : isExpired(link.expiresAt) ? (
                      <Chip label="Expired" color="warning" size="small" />
                    ) : (
                      <Chip label="Active" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    {link.usedCount} / {link.maxUses === 0 ? '∞' : link.maxUses}
                  </TableCell>
                  <TableCell>
                    {new Date(link.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(link.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete link">
                      <IconButton
                        color="error"
                        onClick={() => {
                          setLinkToDelete(link);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No upload links found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Upload Link</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this upload link?
            {linkToDelete && (
              <>
                <br /><br />
                <strong>Token:</strong> {linkToDelete.token}<br />
                <strong>Project:</strong> {linkToDelete.project.name}<br />
                <strong>Client:</strong> {linkToDelete.project.client.name}
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteLink} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllUploadLinks; 