import { createTheme } from '@mui/material/styles';

// GOV.UK colors from the design system
const govukColors = {
  blue: '#1d70b8',
  darkBlue: '#003078',
  lightBlue: '#5694ca',
  red: '#d4351c',
  darkRed: '#942514',
  lightRed: '#f6d7d2',
  green: '#00703c',
  darkGreen: '#005a30',
  lightGreen: '#cce2d8',
  yellow: '#ffdd00',
  darkYellow: '#594d00',
  lightYellow: '#fff7bf',
  black: '#0b0c0c',
  darkGrey: '#505a5f',
  midGrey: '#b1b4b6',
  lightGrey: '#f3f2f1',
  white: '#ffffff',
  purple: '#4c2c92',
  lightPurple: '#e9d2f4',
};

// Create a theme instance with GOV.UK styling
const govukTheme = createTheme({
  palette: {
    primary: {
      main: govukColors.blue,
      dark: govukColors.darkBlue,
      light: govukColors.lightBlue,
      contrastText: govukColors.white,
    },
    secondary: {
      main: govukColors.darkGrey,
      dark: govukColors.black,
      light: govukColors.midGrey,
      contrastText: govukColors.white,
    },
    error: {
      main: govukColors.red,
      dark: govukColors.darkRed,
      light: govukColors.lightRed,
      contrastText: govukColors.white,
    },
    success: {
      main: govukColors.green,
      dark: govukColors.darkGreen,
      light: govukColors.lightGreen,
      contrastText: govukColors.white,
    },
    warning: {
      main: govukColors.yellow,
      dark: govukColors.darkYellow,
      light: govukColors.lightYellow,
      contrastText: govukColors.black,
    },
    background: {
      default: govukColors.white,
      paper: govukColors.white,
    },
    text: {
      primary: govukColors.black,
      secondary: govukColors.darkGrey,
    },
  },
  typography: {
    fontFamily: '"GDS Transport", Arial, sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.25,
      marginBottom: '1.25rem',
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.25,
      marginBottom: '1rem',
    },
    h3: {
      fontSize: '1.125rem',
      fontWeight: 700,
      lineHeight: 1.25,
      marginBottom: '0.75rem',
    },
    h4: {
      fontSize: '1rem',
      fontWeight: 700,
      lineHeight: 1.25,
      marginBottom: '0.5rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '0.5rem 1.25rem',
          fontWeight: 700,
          fontSize: '1rem',
          lineHeight: 1.5,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            backgroundColor: govukColors.darkBlue,
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            '& fieldset': {
              borderWidth: '2px',
              borderColor: govukColors.black,
            },
            '&:hover fieldset': {
              borderColor: govukColors.black,
            },
            '&.Mui-focused fieldset': {
              borderWidth: '3px',
              borderColor: govukColors.black,
            },
          },
          '& .MuiInputLabel-root': {
            fontWeight: 700,
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: govukColors.black,
          '&.Mui-checked': {
            color: govukColors.black,
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: govukColors.black,
          '&.Mui-checked': {
            color: govukColors.black,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          border: `1px solid ${govukColors.midGrey}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: govukColors.black,
          boxShadow: 'none',
        },
      },
    },
  },
});

export default govukTheme; 