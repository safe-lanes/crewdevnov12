
export const sailDesignSystem = {
  colors: {
    primary: '#5fa5fa',
    secondary: '#3B82F6',
    success: '#20c43f',
    headerText: '#16569e',
    background: '#f8fafc',
    cardBackground: '#ffffff',
    tableHeader: '#f3f4f6',
    textPrimary: '#4f5863',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    accent: '#3164f4'
  },
  
  typography: {
    fontFamily: 'Mulish, Helvetica, sans-serif',
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px  
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem'   // 24px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  spacing: {
    formPadding: '1.5rem',      // p-6
    sectionSpacing: '2rem',     // space-y-8  
    fieldSpacing: '1rem',       // space-y-4
    buttonSpacing: '2rem'       // px-8
  },

  components: {
    card: {
      background: '#ffffff',
      borderRadius: '0.5rem',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      padding: '1.5rem'
    },
    
    table: {
      headerBackground: '#f3f4f6',
      borderColor: '#e5e7eb',
      cellPadding: '0.5rem 1rem',
      fontSize: '0.8125rem'
    },

    form: {
      fieldSpacing: '1rem',
      labelSize: '0.75rem',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db'
    },

    stepper: {
      activeColor: '#2563eb',
      inactiveColor: '#9ca3af',
      completedColor: '#10b981',
      sidebarWidth: '18rem'
    }
  },

  layout: {
    modalMaxHeight: 'calc(100vh - 2rem)',
    sidebarWidth: '18rem',
    contentPadding: '1rem',
    headerHeight: '4rem'
  }
};

// Helper functions for consistent styling
export const getFormSectionClasses = () => ({
  container: 'bg-white',
  content: 'p-6',
  header: 'pb-4 mb-6',
  title: 'text-xl font-semibold mb-2',
  description: 'text-sm',
  divider: 'w-full h-0.5 mt-2'
});

export const getTableClasses = () => ({
  container: 'bg-white rounded-lg shadow-md overflow-hidden',
  wrapper: 'overflow-x-auto',
  table: 'w-full min-w-[600px]',
  header: 'bg-gray-100',
  headerCell: 'text-gray-600 text-xs font-normal py-2 px-4 text-left',
  body: 'bg-white',
  row: 'border-b border-gray-200 bg-white hover:bg-gray-50',
  cell: 'text-[#4f5863] text-[13px] font-normal py-2 px-4'
});

export const getButtonClasses = () => ({
  primary: 'bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8',
  secondary: 'bg-blue-600 hover:bg-blue-700 text-white px-8',
  success: 'bg-[#20c43f] hover:bg-[#1ba838] text-white px-8',
  outline: 'text-gray-600 border-gray-300'
});

export const getStepperClasses = () => ({
  sidebar: 'hidden lg:block w-72 overflow-y-auto bg-[#f8fafc]',
  nav: 'p-6',
  item: 'relative',
  button: 'w-full flex items-center p-3 rounded-lg text-left transition-colors hover:bg-gray-50',
  activeButton: 'bg-blue-50',
  circle: 'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-4',
  activeCircle: 'bg-blue-600',
  inactiveCircle: 'bg-gray-400',
  completedCircle: 'bg-green-500',
  title: 'font-medium text-sm',
  activeTitle: 'text-blue-700',
  inactiveTitle: 'text-gray-700',
  connector: 'absolute left-[2rem] top-16 w-0.5 h-4 bg-gray-300'
});
