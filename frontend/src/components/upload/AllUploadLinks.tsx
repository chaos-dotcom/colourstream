import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Stack,
  InputAdornment,
  InputBase
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { format, parseISO, isAfter } from 'date-fns';

import { UploadLink } from '../../types/upload';
import { getAllUploadLinks, deleteUploadLink, updateUploadLink } from '../../services/uploadService';
import { useSnackbar } from 'notistack';
import { API_URL } from '../../config';

// Define component styles based on GDS styling
const gdsStyles = {
  heading: {
    fontWeight: 700,
    mb: 3
  },
  card: {
    p: 0,
    mb: 4,
    border: '1px solid #E4E4E7',
    boxShadow: 'none',
    borderRadius: '4px'
  },
  primaryButton: {
    bgcolor: '#00703c',
    color: 'white',
    '&:hover': {
      bgcolor: '#00562e'
    }
  },
  secondaryButton: {
    color: '#00703c',
    borderColor: '#00703c',
    '&:hover': {
      borderColor: '#00562e',
      bgcolor: 'rgba(0, 112, 60, 0.04)'
    }
  },
  dangerButton: {
    bgcolor: '#d4351c',
    color: 'white',
    '&:hover': {
      bgcolor: '#b13118'
    }
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '4px',
    marginBottom: 3,
    width: '100%',
    border: '1px solid #E4E4E7',
  }
};

const AllUploadLinks: React.FC = () => {
  const [uploadLinks, setUploadLinks] = useState<UploadLink[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<UploadLink[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const { enqueueSnackbar } = useSnackbar();
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [currentLink, setCurrentLink] = useState<UploadLink | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState<Date | null>(null);
  const [newMaxUses, setNewMaxUses] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  
  // Log authentication status when component mounts
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    const isAuthenticated = localStorage.getItem('isAdminAuthenticated');
    console.log('Authentication status in AllUploadLinks:', { 
      isAuthenticated: Boolean(isAuthenticated), 
      hasToken: Boolean(adminToken),
      tokenLength: adminToken ? adminToken.length : 0,
      tokenPrefix: adminToken ? adminToken.substring(0, 10) + '...' : null,
      apiUrl: API_URL
    });
  }, []);
  
  // Fetch all upload links
  useEffect(() => {
    const fetchUploadLinks = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching upload links...');
        // Fetch directly with fetch API for debugging
        const adminToken = localStorage.getItem('adminToken');
        
        console.log('Making direct fetch request to:', `${API_URL}/upload/upload-links-all`);
        const directResponse = await fetch(`${API_URL}/upload/upload-links-all`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log('Direct fetch response status:', directResponse.status);
        const directData = await directResponse.json();
        console.log('Direct fetch response data:', directData);
        
        // Also try the regular API call
        const response = await getAllUploadLinks();
        console.log('API response:', response);
        
        if (response.status === 'success') {
          setUploadLinks(response.data || []);
          setFilteredLinks(response.data || []);
          console.log('Links loaded:', response.data?.length || 0);
        } else {
          console.error('API returned error status:', response.status, response.message);
          setError(response.message || 'Failed to fetch upload links');
        }
      } catch (err) {
        console.error('Error fetching upload links:', err);
        setError('An unexpected error occurred while fetching upload links');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUploadLinks();
  }, [refreshTrigger]);
  
  // Filter upload links when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLinks(uploadLinks);
      return;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = uploadLinks.filter(link => {
      return (
        // Search in client name
        (link.project?.client?.name?.toLowerCase().includes(lowerSearchTerm) || false) ||
        // Search in project name
        (link.project?.name?.toLowerCase().includes(lowerSearchTerm) || false) ||
        // Search in token
        link.token.toLowerCase().includes(lowerSearchTerm)
      );
    });
    
    setFilteredLinks(filtered);
  }, [searchTerm, uploadLinks]);
  
  // Copy upload link to clipboard
  const handleCopyLink = (token: string) => {
    const url = `https://upload.colourstream.johnrogerscolour.co.uk/portal/${token}`;
    navigator.clipboard.writeText(url);
    enqueueSnackbar('Upload link copied to clipboard', { variant: 'success' });
  };
  
  // Open the edit dialog
  const handleOpenEditDialog = (link: UploadLink) => {
    setCurrentLink(link);
    setNewExpiryDate(parseISO(link.expiresAt));
    setNewMaxUses(link.maxUses !== undefined && link.maxUses !== null ? link.maxUses.toString() : '');
    setEditError(null);
    setEditDialogOpen(true);
  };
  
  // Close the edit dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setCurrentLink(null);
    setNewExpiryDate(null);
    setNewMaxUses('');
    setEditError(null);
  };
  
  // Save edited link
  const handleSaveLink = async () => {
    if (!currentLink) return;
    
    setEditLoading(true);
    setEditError(null);
    
    try {
      // Validate expiry date
      if (!newExpiryDate) {
        setEditError('Expiry date is required');
        setEditLoading(false);
        return;
      }
      
      // Parse max uses
      const maxUses = newMaxUses.trim() === '' ? null : parseInt(newMaxUses, 10);
      if (newMaxUses.trim() !== '' && (isNaN(maxUses as number) || maxUses as number < 0)) {
        setEditError('Max uses must be a positive number or empty for unlimited');
        setEditLoading(false);
        return;
      }
      
      const response = await updateUploadLink(currentLink.id, {
        expiresAt: newExpiryDate.toISOString(),
        maxUses: maxUses
      });
      
      if (response.status === 'success') {
        handleCloseEditDialog();
        setRefreshTrigger(prev => prev + 1);
        enqueueSnackbar('Upload link updated successfully', { variant: 'success' });
      } else {
        setEditError(response.message || 'Failed to update upload link');
      }
    } catch (err) {
      console.error('Error updating upload link:', err);
      setEditError('An unexpected error occurred while updating the upload link');
    } finally {
      setEditLoading(false);
    }
  };
  
  // Open delete confirmation dialog
  const handleOpenDeleteDialog = (link: UploadLink) => {
    setCurrentLink(link);
    setDeleteDialogOpen(true);
  };
  
  // Close delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCurrentLink(null);
  };
  
  // Delete upload link
  const handleDeleteLink = async () => {
    if (!currentLink) return;
    
    setDeleteLoading(true);
    
    try {
      const response = await deleteUploadLink(currentLink.id);
      if (response.status === 'success') {
        handleCloseDeleteDialog();
        setRefreshTrigger(prev => prev + 1);
        enqueueSnackbar('Upload link deleted successfully', { variant: 'success' });
      } else {
        setError(response.message || 'Failed to delete upload link');
        handleCloseDeleteDialog();
      }
    } catch (err) {
      console.error('Error deleting upload link:', err);
      setError('An unexpected error occurred while deleting the upload link');
      handleCloseDeleteDialog();
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const formatDate = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'PPp');
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Invalid date';
    }
  };
  
  const isExpired = (dateString: string): boolean => {
    try {
      return !isAfter(parseISO(dateString), new Date());
    } catch (error) {
      console.error('Error checking if date is expired:', error, dateString);
      return false;
    }
  };
  
  // Visit upload link
  const handleVisitLink = (token: string) => {
    window.open(`https://upload.colourstream.johnrogerscolour.co.uk/portal/${token}`, '_blank');
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={gdsStyles.heading}>
        All Upload Links
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Search box */}
      <Box sx={gdsStyles.searchBox}>
        <SearchIcon sx={{ color: 'action.active', mr: 1 }} />
        <InputBase
          placeholder="Search by client, project, or token..."
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>
      
      <Paper sx={gdsStyles.card}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredLinks.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Typography>
              {searchTerm ? "No upload links match your search." : "No upload links found."}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Token</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      {link.project?.client?.name || 'Unknown Client'}
                    </TableCell>
                    <TableCell>
                      <RouterLink to={`/upload/projects/${link.projectId}`} style={{ textDecoration: 'none', color: '#1d70b8' }}>
                        {link.project?.name || 'Unknown Project'}
                      </RouterLink>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography 
                          variant="body2" 
                          sx={{ fontFamily: 'monospace', mr: 1, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {link.token}
                        </Typography>
                        <Tooltip title="Copy upload link">
                          <IconButton size="small" onClick={() => handleCopyLink(link.token)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2">
                          {formatDate(link.expiresAt)}
                        </Typography>
                        {isExpired(link.expiresAt) && (
                          <Chip 
                            label="Expired" 
                            size="small" 
                            color="error" 
                            sx={{ ml: 1 }} 
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {link.usedCount} / {link.maxUses === null ? '∞' : link.maxUses}
                    </TableCell>
                    <TableCell>
                      {formatDate(link.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex' }}>
                        <Tooltip title="Visit upload link">
                          <IconButton size="small" onClick={() => handleVisitLink(link.token)}>
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit link">
                          <IconButton size="small" onClick={() => handleOpenEditDialog(link)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete link">
                          <IconButton size="small" onClick={() => handleOpenDeleteDialog(link)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Upload Link</DialogTitle>
        <DialogContent>
          {editError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {editError}
            </Alert>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Link Details</Typography>
            
            <Stack spacing={2}>
              {currentLink && (
                <>
                  <Box>
                    <Typography variant="caption">Client</Typography>
                    <Typography variant="body1">{currentLink.project?.client?.name || 'Unknown Client'}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption">Project</Typography>
                    <Typography variant="body1">{currentLink.project?.name || 'Unknown Project'}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption">Token</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography 
                        variant="body2" 
                        sx={{ fontFamily: 'monospace', mr: 1 }}
                      >
                        {currentLink.token}
                      </Typography>
                      <Tooltip title="Copy upload link">
                        <IconButton size="small" onClick={() => handleCopyLink(currentLink.token)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </>
              )}
              
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker 
                  label="Expiry Date" 
                  value={newExpiryDate}
                  onChange={(newValue) => setNewExpiryDate(newValue)}
                />
              </LocalizationProvider>
              
              <TextField
                label="Max Uses (leave empty for unlimited)"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                type="number"
                InputProps={{
                  inputProps: { min: 0 },
                  endAdornment: newMaxUses === '' && (
                    <InputAdornment position="end">
                      <Typography variant="body2">Unlimited</Typography>
                    </InputAdornment>
                  )
                }}
                fullWidth
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={editLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveLink} 
            variant="contained" 
            color="primary" 
            disabled={editLoading}
          >
            {editLoading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Upload Link</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this upload link?
            {currentLink?.project && (
              <>
                <br />
                <br />
                <strong>Client:</strong> {currentLink.project.client?.name}<br />
                <strong>Project:</strong> {currentLink.project.name}<br />
                <strong>Token:</strong> {currentLink.token}
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteLink} 
            sx={gdsStyles.dangerButton}
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllUploadLinks; 