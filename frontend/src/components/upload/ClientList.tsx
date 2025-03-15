import React, { useState, useEffect } from 'react';
import { Client } from '../../types/upload';
import { getClients } from '../../services/uploadService';
import { Box, TextField, Typography, Card, CardContent, Grid, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';

interface ClientListProps {
  refreshTrigger?: number;
}

const ClientList: React.FC<ClientListProps> = ({ refreshTrigger = 0 }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const response = await getClients();
        if (response.status === 'success') {
          setClients(response.data);
          setFilteredClients(response.data);
        } else {
          setError(response.message || 'Failed to fetch clients');
        }
      } catch (err) {
        setError('Failed to fetch clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [refreshTrigger]);

  useEffect(() => {
    const filtered = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Clients
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search clients by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />
      </Box>

      <Grid container spacing={2}>
        {filteredClients.map((client) => (
          <Grid item xs={12} sm={6} md={4} key={client.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {client.name}
                </Typography>
                <Typography color="textSecondary" gutterBottom>
                  Code: {client.code || 'Auto-generated'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Created: {new Date(client.createdAt).toLocaleDateString()}
                </Typography>
                <Box mt={2}>
                  <Link
                    to={`/upload/clients/${client.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography color="primary">View Details →</Typography>
                  </Link>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredClients.length === 0 && (
        <Box mt={3} textAlign="center">
          <Typography color="textSecondary">No clients found</Typography>
        </Box>
      )}
    </Box>
  );
};

export default ClientList; 