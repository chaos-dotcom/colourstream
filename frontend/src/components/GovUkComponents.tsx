import React, { ReactNode } from 'react';
import { Typography, Box, Button as MuiButton, TextField as MuiTextField, Paper, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

// Page heading with optional caption
interface PageHeadingProps {
  children: ReactNode;
  caption?: string;
}

export const PageHeading: React.FC<PageHeadingProps> = ({ children, caption }) => {
  return (
    <Box sx={{ mb: 4 }}>
      {caption && (
        <Typography 
          variant="body1" 
          component="span" 
          sx={{ 
            display: 'block', 
            color: '#505a5f', 
            fontWeight: 400,
            fontSize: '1.125rem',
            mb: 1
          }}
        >
          {caption}
        </Typography>
      )}
      <Typography 
        variant="h1" 
        component="h1" 
        sx={{ 
          fontSize: '2.25rem', 
          fontWeight: 700, 
          lineHeight: 1.25,
          color: '#0b0c0c'
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};

// Section heading
interface SectionHeadingProps {
  children: ReactNode;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ children }) => {
  return (
    <Typography 
      variant="h2" 
      component="h2" 
      sx={{ 
        fontSize: '1.5rem', 
        fontWeight: 700, 
        lineHeight: 1.25,
        color: '#0b0c0c',
        mb: 3
      }}
    >
      {children}
    </Typography>
  );
};

// GOV.UK styled button
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'grey' | 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'teal';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  type = 'button',
  fullWidth = false
}) => {
  const getButtonColor = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: '#00703c',
          hoverBg: '#005a30',
          color: '#ffffff'
        };
      case 'secondary':
        return {
          bg: '#ffffff',
          hoverBg: '#f3f2f1',
          color: '#0b0c0c'
        };
      case 'warning':
        return {
          bg: '#d4351c',
          hoverBg: '#aa2a16',
          color: '#ffffff'
        };
      case 'grey':
        return {
          bg: '#505a5f',
          hoverBg: '#383f43',
          color: '#ffffff'
        };
      case 'purple':
        return {
          bg: '#4c2c92',
          hoverBg: '#3e2376',
          color: '#ffffff'
        };
      case 'blue':
        return {
          bg: '#1d70b8',
          hoverBg: '#003078',
          color: '#ffffff'
        };
      case 'green':
        return {
          bg: '#00823b',
          hoverBg: '#00692f',
          color: '#ffffff'
        };
      case 'red':
        return {
          bg: '#d4351c',
          hoverBg: '#aa2a16',
          color: '#ffffff'
        };
      case 'orange':
        return {
          bg: '#f47738',
          hoverBg: '#c25e30',
          color: '#ffffff'
        };
      case 'teal':
        return {
          bg: '#28a197',
          hoverBg: '#208b83',
          color: '#ffffff'
        };
      default:
        return {
          bg: '#00703c',
          hoverBg: '#005a30',
          color: '#ffffff'
        };
    }
  };

  const buttonColors = getButtonColor();

  return (
    <MuiButton
      onClick={onClick}
      disabled={disabled}
      type={type}
      fullWidth={fullWidth}
      sx={{
        backgroundColor: buttonColors.bg,
        color: buttonColors.color,
        fontWeight: 700,
        fontSize: '1.125rem',
        padding: '0.5625rem 1.25rem',
        borderRadius: 0,
        border: 'none',
        boxShadow: '0 2px 0 rgba(0,0,0,0.15)',
        textTransform: 'none',
        '&:hover': {
          backgroundColor: buttonColors.hoverBg,
        },
        '&:focus': {
          outline: '3px solid #ffdd00',
          backgroundColor: buttonColors.bg,
        },
      }}
    >
      {children}
    </MuiButton>
  );
};

// GOV.UK styled text field
interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  fullWidth?: boolean;
  required?: boolean;
  hint?: string;
}

const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  fullWidth = true,
  required = false,
  hint,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <MuiTextField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        error={!!error}
        helperText={error || hint}
        type={type}
        fullWidth={fullWidth}
        required={required}
        FormHelperTextProps={{
          sx: {
            color: error ? '#d4351c' : '#505a5f',
            fontWeight: error ? 700 : 400,
            marginLeft: 0,
            marginTop: 0.5,
          },
        }}
        InputLabelProps={{
          shrink: true,
          sx: {
            fontWeight: 700,
            color: '#0b0c0c',
            fontSize: '1.125rem',
            transform: 'none',
            position: 'relative',
            marginBottom: 0.5,
          },
        }}
        sx={{
          '& .MuiInputBase-root': {
            borderRadius: 0,
            backgroundColor: '#ffffff',
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: error ? '#d4351c' : '#0b0c0c',
              borderWidth: 2,
            },
            '&:hover fieldset': {
              borderColor: error ? '#d4351c' : '#0b0c0c',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0b0c0c',
              borderWidth: 3,
              boxShadow: '0 0 0 3px #ffdd00',
            },
          },
        }}
      />
    </Box>
  );
};

// GOV.UK styled panel
interface PanelProps {
  title: string;
  children: ReactNode;
}

const Panel: React.FC<PanelProps> = ({ title, children }) => {
  return (
    <Paper
      sx={{
        backgroundColor: '#1d70b8',
        color: '#ffffff',
        padding: 4,
        textAlign: 'center',
        borderRadius: 0,
        mb: 4,
      }}
    >
      <Typography
        variant="h2"
        component="h2"
        sx={{
          fontSize: '1.5rem',
          fontWeight: 700,
          mb: 2,
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          fontSize: '1.25rem',
        }}
      >
        {children}
      </Typography>
    </Paper>
  );
};

// GOV.UK styled inset text
interface InsetTextProps {
  children: ReactNode;
}

export const InsetText: React.FC<InsetTextProps> = ({ children }) => {
  return (
    <Box
      sx={{
        borderLeft: '10px solid #b1b4b6',
        padding: '15px',
        marginBottom: 3,
        backgroundColor: '#ffffff',
      }}
    >
      <Typography variant="body1">{children}</Typography>
    </Box>
  );
};

// GOV.UK styled warning text
interface WarningTextProps {
  children: ReactNode;
}

export const WarningText: React.FC<WarningTextProps> = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: 3,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 700,
          fontSize: '1.25rem',
          marginRight: 1,
          color: '#d4351c',
        }}
      >
        !
      </Typography>
      <Typography
        variant="body1"
        sx={{
          fontWeight: 700,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};

// GOV.UK styled breadcrumbs
interface BreadcrumbsProps {
  items: {
    label: string;
    href?: string;
  }[];
}

const GovUkBreadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <Breadcrumbs
      separator="›"
      aria-label="breadcrumb"
      sx={{
        mb: 4,
        '& .MuiBreadcrumbs-separator': {
          mx: 1,
        },
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        if (isLast || !item.href) {
          return (
            <Typography
              key={index}
              color="text.primary"
              sx={{
                fontSize: '1rem',
                fontWeight: isLast ? 700 : 400,
              }}
            >
              {item.label}
            </Typography>
          );
        }
        
        return (
          <MuiLink
            key={index}
            component={RouterLink}
            to={item.href}
            color="primary"
            sx={{
              fontSize: '1rem',
              textDecoration: 'underline',
              '&:hover': {
                textDecoration: 'underline',
                textDecorationThickness: '3px',
              },
            }}
          >
            {item.label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
};

// GOV.UK styled summary list
interface SummaryListItemProps {
  key: string;
  value: ReactNode;
  action?: {
    href: string;
    text: string;
  };
}

interface SummaryListProps {
  items: SummaryListItemProps[];
}

const SummaryList: React.FC<SummaryListProps> = ({ items }) => {
  return (
    <Box
      sx={{
        mb: 4,
        '& dt': {
          fontWeight: 700,
          color: '#0b0c0c',
          fontSize: '1.125rem',
          mb: 1,
        },
        '& dd': {
          margin: 0,
          mb: 3,
        },
      }}
    >
      {items.map((item, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            borderBottom: index < items.length - 1 ? '1px solid #b1b4b6' : 'none',
            pb: 2,
            mb: 2,
          }}
        >
          <Box
            component="dt"
            sx={{
              width: { md: '30%' },
              pr: { md: 2 },
            }}
          >
            {item.key}
          </Box>
          <Box
            component="dd"
            sx={{
              width: { md: '50%' },
              pr: { md: 2 },
            }}
          >
            {item.value}
          </Box>
          {item.action && (
            <Box
              component="dd"
              sx={{
                width: { md: '20%' },
                textAlign: { md: 'right' },
              }}
            >
              <MuiLink
                component={RouterLink}
                to={item.action.href}
                sx={{
                  color: '#1d70b8',
                  textDecoration: 'underline',
                  '&:hover': {
                    textDecoration: 'underline',
                    textDecorationThickness: '3px',
                  },
                }}
              >
                {item.action.text}
              </MuiLink>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

// GOV.UK styled table
interface TableProps {
  children: ReactNode;
  caption?: string;
  sx?: object;
}

export const Table: React.FC<TableProps> = ({ children, caption, sx = {} }) => {
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: 4,
        fontFamily: '"GDS Transport", Arial, sans-serif',
        ...sx
      }}
    >
      {caption && (
        <Box
          component="caption"
          sx={{
            fontSize: '1.125rem',
            fontWeight: 700,
            textAlign: 'left',
            marginBottom: 2,
            color: '#0b0c0c',
          }}
        >
          {caption}
        </Box>
      )}
      {children}
    </Box>
  );
};

interface TableHeadProps {
  children: ReactNode;
}

export const TableHead: React.FC<TableHeadProps> = ({ children }) => {
  return (
    <Box
      component="thead"
      sx={{
        backgroundColor: '#f3f2f1',
      }}
    >
      {children}
    </Box>
  );
};

interface TableBodyProps {
  children: ReactNode;
}

export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return <Box component="tbody">{children}</Box>;
};

interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({ children, onClick, selected }) => {
  return (
    <Box
      component="tr"
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: selected ? '#e6f3ff' : 'inherit',
        '&:hover': onClick ? { backgroundColor: '#f8f8f8' } : {},
        borderBottom: '1px solid #b1b4b6',
      }}
    >
      {children}
    </Box>
  );
};

interface TableCellProps {
  children: ReactNode;
  header?: boolean;
  colSpan?: number;
  align?: 'left' | 'center' | 'right';
  sx?: object;
}

export const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  header = false, 
  colSpan,
  align = 'left',
  sx = {}
}) => {
  return (
    <Box
      component={header ? 'th' : 'td'}
      colSpan={colSpan}
      sx={{
        padding: '0.75rem 1rem',
        textAlign: align,
        borderBottom: header ? '1px solid #b1b4b6' : 'none',
        fontWeight: header ? 700 : 400,
        color: '#0b0c0c',
        ...(header && {
          fontSize: '1rem',
        }),
        ...sx
      }}
    >
      {children}
    </Box>
  );
}; 
