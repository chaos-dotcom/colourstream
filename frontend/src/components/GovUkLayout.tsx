import React, { ReactNode, useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Link } from '@mui/material';
import { styled } from '@mui/material/styles';

// Rainbow flag component
const RainbowFlag = () => (
  <span role="img" aria-label="Rainbow flag" style={{ fontSize: '32px', marginRight: '8px' }}>
    🏳️‍🌈
  </span>
);

// Array of accent colors
const accentColors = [
  '#1d70b8', // Blue
  '#4c2c92', // Purple
  '#d53880', // Pink
  '#f47738', // Orange
  '#00703c', // Green
  '#5694ca', // Light blue
  '#912b88', // Magenta
  '#85994b', // Olive
  '#28a197', // Turquoise
];

const StyledAppBar = styled(AppBar)(() => ({
  backgroundColor: '#0b0c0c',
  color: '#ffffff',
}));

const StyledFooter = styled(Box)(() => ({
  backgroundColor: '#f3f2f1',
  padding: '32px 0',
  marginTop: 'auto',
}));

interface GovUkLayoutProps {
  children: ReactNode;
  serviceName?: string;
  isAdminPage?: boolean;
}

const GovUkLayout: React.FC<GovUkLayoutProps> = ({ children, serviceName = 'ColourStream', isAdminPage = false }) => {
  const [accentColor, setAccentColor] = useState('#1d70b8');
  const [gitTag, setGitTag] = useState<string>('');

  useEffect(() => {
    // Select a random accent color on component mount
    const randomColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    setAccentColor(randomColor);

    // Fetch git tag from environment variable
    const tag = process.env.REACT_APP_GIT_TAG || 'dev';
    setGitTag(tag);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <StyledAppBar position="static">
        <Box sx={{ height: '6px', width: '100%', bgcolor: '#ff00ff', display: 'flex' }}>
          {/* Rainbow stripe colors */}
          <Box sx={{ flex: 1, bgcolor: '#E40303' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#FF8C00' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#FFED00' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#008026' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#004DFF' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#750787' }}></Box>
          {/* Transgender flag colors */}
          <Box sx={{ flex: 1, bgcolor: '#5BCEFA' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#FFFFFF' }}></Box>
          <Box sx={{ flex: 1, bgcolor: '#F5A9B8' }}></Box>
        </Box>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Link 
              href={isAdminPage ? "/admin/dashboard" : "/"} 
              color="inherit" 
              underline="none" 
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <RainbowFlag />
              <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
                {serviceName}
              </Typography>
            </Link>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {isAdminPage && (
            <Link 
              href="/admin/dashboard" 
              color="inherit" 
              underline="none" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: '1rem',
                fontWeight: 400,
                padding: '8px 16px',
                '&:hover': {
                  textDecoration: 'underline',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Back to Admin Dashboard
            </Link>
          )}
          <Box sx={{ height: '8px', width: '100%', position: 'absolute', bottom: 0, left: 0, backgroundColor: accentColor }} />
        </Toolbar>
      </StyledAppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        {children}
      </Container>

      <StyledFooter component="footer">
        <Container>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between' }}>
            <Box sx={{ mb: { xs: 2, md: 0 } }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                © ColourStream copyright
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Version: {gitTag}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                All content is licensed under the{' '}
                <Link href="https://www.gnu.org/licenses/agpl-3.0.en.html" color="inherit" target="_blank" rel="noopener">
                  GNU Affero General Public License v3.0 (AGPL-3.0)
                </Link>
                , unless otherwise stated.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                UI design based on the{' '}
                <Link href="https://design-system.service.gov.uk/" color="inherit" target="_blank" rel="noopener">
                  GOV.UK Design System
                </Link>
                {' '}which is licensed under the{' '}
                <Link href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" color="inherit" target="_blank" rel="noopener">
                  Open Government Licence v3.0
                </Link>
                .
              </Typography>
            </Box>
            <Box>
              <Link href="/" color="inherit" sx={{ display: 'block', mb: 1 }}>
                ColourStream
              </Link>
              <Link href="/license" color="inherit" sx={{ display: 'block', mb: 1 }}>
                License
              </Link>
              <Link href="/privacy" color="inherit" sx={{ display: 'block', mb: 1 }}>
                Privacy Policy
              </Link>
              <Link href="/terms" color="inherit" sx={{ display: 'block', mb: 1 }}>
                Terms of Service
              </Link>
            </Box>
          </Box>
        </Container>
      </StyledFooter>
    </Box>
  );
};

export default GovUkLayout; 