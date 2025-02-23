import React, { useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { GeneralSettings } from './GeneralSettings';
import { OBSSettings } from './OBSSettings';
import { SecuritySettings } from './SecuritySettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="settings tabs"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="GENERAL" />
          <Tab label="OBS" />
          <Tab label="SECURITY" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <GeneralSettings />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <OBSSettings />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <SecuritySettings />
      </TabPanel>
    </Paper>
  );
}; 