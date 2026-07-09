import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#3D4AEB' },
    error:      { main: '#B15653' },
    warning:    { main: '#e6a817' },
    success:    { main: '#2e7d32' },
    background: { default: '#0C0B13', paper: '#1E1D2E' },
    text:       { primary: '#FFFFFF', secondary: '#8B8CA7' },
    divider:    '#373855',
  },
  typography: {
    fontFamily: '"DM Sans", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 500 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1D2E',
          backgroundImage: 'none',
          border: '1px solid #373855',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1E1D2E',
          borderRight: '1px solid #373855',
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1D2E',
          backgroundImage: 'none',
          borderBottom: '1px solid #373855',
          boxShadow: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#373855' },
        head: { color: '#8B8CA7', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontFamily: '"DM Sans", sans-serif' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 2,
          '&.Mui-selected': {
            backgroundColor: 'rgba(61,74,235,0.15)',
            '&:hover': { backgroundColor: 'rgba(61,74,235,0.20)' },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: '#1E1D2E', border: '1px solid #373855' },
      },
    },
  },
})
