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
}

const GovUkLayout: React.FC<GovUkLayoutProps> = ({ children, serviceName = 'ColourStream' }) => {
  const [accentColor, setAccentColor] = useState('#1d70b8');

  useEffect(() => {
    // Select a random accent color on component mount
    const randomColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    setAccentColor(randomColor);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <StyledAppBar position="static">
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Link href="/" color="inherit" underline="none" sx={{ display: 'flex', alignItems: 'center' }}>
              <RainbowFlag />
              <Typography variant="h6" component="span" sx={{ ml: 1, fontWeight: 700, fontSize: '1.125rem' }}>
                SHED.GAY
              </Typography>
            </Link>
          </Box>
          <Box sx={{ borderLeft: '1px solid #ffffff', pl: 2, ml: 2 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
              {serviceName}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
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
                © Pride copyright
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
                SHED.GAY
              </Link>
            </Box>
          </Box>
        </Container>
      </StyledFooter>
    </Box>
  );
};

export default GovUkLayout; 