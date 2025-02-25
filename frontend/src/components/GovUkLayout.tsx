import React, { ReactNode } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Link } from '@mui/material';
import { styled } from '@mui/material/styles';

// Rainbow flag component
const RainbowFlag = () => (
  <span role="img" aria-label="Rainbow flag" style={{ fontSize: '32px', marginRight: '8px' }}>
    🏳️‍🌈
  </span>
);

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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <StyledAppBar position="static">
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Link href="/" color="inherit" underline="none" sx={{ display: 'flex', alignItems: 'center' }}>
              <RainbowFlag />
              <Typography variant="h6" component="span" sx={{ ml: 1, fontWeight: 700, fontSize: '1.125rem' }}>
                GAY.UK
              </Typography>
            </Link>
          </Box>
          <Box sx={{ borderLeft: '1px solid #ffffff', pl: 2, ml: 2 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
              {serviceName}
            </Typography>
          </Box>
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
              <Typography variant="body2" color="text.secondary">
                All content is available under the{' '}
                <Link href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" color="inherit">
                  Open Government Licence v3.0
                </Link>
                , except where otherwise stated
              </Typography>
            </Box>
            <Box>
              <Link href="https://www.gov.uk/" color="inherit" sx={{ display: 'block', mb: 1 }}>
                GAY.UK
              </Link>
            </Box>
          </Box>
        </Container>
      </StyledFooter>
    </Box>
  );
};

export default GovUkLayout; 