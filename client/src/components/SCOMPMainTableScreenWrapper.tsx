import React, { useEffect, useState } from 'react';
import { SCOMPMainTableScreen } from 'scomp-ui';
import 'scomp-ui/dist/index.css';
import { ColDef } from 'ag-grid-community';

interface SCOMPMainTableScreenWrapperProps {
  currentModule?: string;
  screenTitle?: string;
  data?: any[];
  onNavigationChange?: (itemId: string) => void;
  onFilterChange?: (filters: any) => void;
  onPrimaryAction?: () => void;
}

export function SCOMPMainTableScreenWrapper({
  currentModule = "Crew Management",
  screenTitle = "Crew Appraisals Management",
  data = [],
  onNavigationChange,
  onFilterChange,
  onPrimaryAction
}: SCOMPMainTableScreenWrapperProps) {
  
  // Add state to ensure component stability
  const [isVisible, setIsVisible] = useState(true);
  
  // Handle window focus/blur events to maintain component visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Document is hidden, but keep component visible
        console.log('Document hidden, but maintaining component state');
      } else {
        // Document is visible, ensure component is visible
        setIsVisible(true);
        console.log('Document visible, component restored');
      }
    };

    const handleFocus = () => {
      setIsVisible(true);
      console.log('Window focused, ensuring component visibility');
    };

    const handleBlur = () => {
      console.log('Window blurred, but maintaining component state');
      // Don't hide the component on blur
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  // Sample data if none provided
  const sampleData = data.length > 0 ? data : [
    {
      id: 'CREW001',
      firstName: 'James',
      lastName: 'Wilson',
      rank: 'Captain',
      vessel: 'MV Ocean Star',
      vesselType: 'Container',
      nationality: 'Philippines',
      appraisalType: 'Mid-Contract',
      overallRating: 4.5
    },
    {
      id: 'CREW002',
      firstName: 'Maria',
      lastName: 'Rodriguez',
      rank: 'Chief Officer',
      vessel: 'MV Sea Explorer',
      vesselType: 'Bulk Carrier',
      nationality: 'Philippines',
      appraisalType: 'End-Contract',
      overallRating: 4.2
    },
    {
      id: 'CREW003',
      firstName: 'John',
      lastName: 'Smith',
      rank: 'Chief Engineer',
      vessel: 'MV Atlantic Queen',
      vesselType: 'Tanker',
      nationality: 'India',
      appraisalType: 'Annual',
      overallRating: 3.8
    }
  ];
  
  // Top Menu Navigation Bar - Module Switcher and Sub Module icons & titles
  const navigationItems = [
    { 
      id: 'crew-appraisals', 
      label: 'Crew Appraisals', 
      icon: '📋', 
      isActive: true 
    },
    { 
      id: 'crew-management', 
      label: 'Crew Management', 
      icon: '👥', 
      isActive: false 
    },
    { 
      id: 'training-records', 
      label: 'Training Records', 
      icon: '🎓', 
      isActive: false 
    },
    { 
      id: 'certifications', 
      label: 'Certifications', 
      icon: '📜', 
      isActive: false 
    },
    { 
      id: 'reports', 
      label: 'Reports', 
      icon: '📊', 
      isActive: false 
    }
  ];

  // Filters Row configuration
  const filters = [
    { 
      id: 'search', 
      type: 'search' as const, 
      placeholder: 'Search crew members by name, ID, or rank...' 
    },
    { 
      id: 'rank', 
      type: 'select' as const, 
      placeholder: 'Filter by Rank', 
      options: [
        { value: 'Captain', label: 'Captain' },
        { value: 'Chief Officer', label: 'Chief Officer' },
        { value: 'Second Officer', label: 'Second Officer' },
        { value: 'Chief Engineer', label: 'Chief Engineer' },
        { value: 'Second Engineer', label: 'Second Engineer' },
        { value: 'Third Engineer', label: 'Third Engineer' },
        { value: 'Bosun', label: 'Bosun' },
        { value: 'AB', label: 'Able Seaman' },
        { value: 'OS', label: 'Ordinary Seaman' },
        { value: 'Cook', label: 'Cook' }
      ]
    },
    { 
      id: 'vessel', 
      type: 'select' as const, 
      placeholder: 'Filter by Vessel', 
      options: [
        { value: 'MV Ocean Star', label: 'MV Ocean Star' },
        { value: 'MV Sea Explorer', label: 'MV Sea Explorer' },
        { value: 'MV Atlantic Queen', label: 'MV Atlantic Queen' }
      ]
    },
    { 
      id: 'appraisal-type', 
      type: 'select' as const, 
      placeholder: 'Appraisal Type', 
      options: [
        { value: 'Mid-Contract', label: 'Mid-Contract' },
        { value: 'End-Contract', label: 'End-Contract' },
        { value: 'Annual', label: 'Annual' },
        { value: 'Promotion', label: 'Promotion' }
      ]
    },
    { 
      id: 'date-from', 
      type: 'date' as const, 
      label: 'From Date' 
    },
    { 
      id: 'date-to', 
      type: 'date' as const, 
      label: 'To Date' 
    }
  ];

  // AG Grid Table configuration (as per AG_Grid_Component_Guide)
  const columnDefs = [
    { 
      field: 'id', 
      headerName: 'Crew ID', 
      flex: 1, 
      minWidth: 120,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'firstName', 
      headerName: 'First Name', 
      flex: 1.5, 
      minWidth: 140,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'lastName', 
      headerName: 'Last Name', 
      flex: 1.5, 
      minWidth: 140,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'rank', 
      headerName: 'Rank', 
      flex: 1.2, 
      minWidth: 130,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'vessel', 
      headerName: 'Vessel', 
      flex: 1.5, 
      minWidth: 150,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'vesselType', 
      headerName: 'Vessel Type', 
      flex: 1.2, 
      minWidth: 130,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'nationality', 
      headerName: 'Nationality', 
      flex: 1, 
      minWidth: 120,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'appraisalType', 
      headerName: 'Appraisal Type', 
      flex: 1.3, 
      minWidth: 140,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    { 
      field: 'overallRating', 
      headerName: 'Overall Rating', 
      flex: 1.2, 
      minWidth: 130,
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      cellRenderer: (params: any) => {
        const rating = params.value;
        if (!rating) return '-';
        
        let badgeClass = 'px-2 py-1 rounded text-xs font-medium';
        let ratingText = '';
        
        if (rating >= 4.5) {
          badgeClass += ' bg-green-100 text-green-800';
          ratingText = 'Excellent';
        } else if (rating >= 4.0) {
          badgeClass += ' bg-blue-100 text-blue-800';
          ratingText = 'Very Good';
        } else if (rating >= 3.5) {
          badgeClass += ' bg-yellow-100 text-yellow-800';
          ratingText = 'Good';
        } else if (rating >= 3.0) {
          badgeClass += ' bg-orange-100 text-orange-800';
          ratingText = 'Fair';
        } else {
          badgeClass += ' bg-red-100 text-red-800';
          ratingText = 'Poor';
        }
        
        return `<span class="${badgeClass}">${rating} - ${ratingText}</span>`;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (params: any) => {
        return `
          <div class="flex gap-2 h-full items-center">
            <button class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" 
                    onclick="window.viewAppraisal('${params.data.id}')">
              View
            </button>
            <button class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" 
                    onclick="window.editAppraisal('${params.data.id}')">
              Edit
            </button>
          </div>
        `;
      }
    }
  ];

  // Handle navigation item clicks
  const handleNavigationChange = (itemId: string) => {
    console.log(`Navigation changed to: ${itemId}`);
    if (onNavigationChange) {
      onNavigationChange(itemId);
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterValues: any) => {
    console.log('Filter values changed:', filterValues);
    if (onFilterChange) {
      onFilterChange(filterValues);
    }
  };

  // Handle primary action (Add New button)
  const handlePrimaryAction = () => {
    console.log('Primary action triggered');
    if (onPrimaryAction) {
      onPrimaryAction();
    }
  };

  // Don't render if not visible (though this shouldn't happen now)
  if (!isVisible) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading SCOMP Main Table Screen...</div>
      </div>
    );
  }

  return (
    <div className="scomp-wrapper" style={{ minHeight: '100vh', position: 'relative' }}>
      <SCOMPMainTableScreen
      currentModule={currentModule}
      navigationItems={navigationItems}
      screenTitle={screenTitle}
      showFilters={true}
      filters={filters}
      columnDefs={columnDefs as any}
      sampleData={sampleData}
      primaryAction={{
        label: 'Add New Appraisal',
        icon: '➕',
        onClick: handlePrimaryAction
      }}
      />
    </div>
  );
}

// Global functions for action buttons (temporary implementation)
if (typeof window !== 'undefined') {
  (window as any).viewAppraisal = (crewId: string) => {
    console.log(`Viewing appraisal for crew member: ${crewId}`);
    // You can replace this with actual navigation logic
  };

  (window as any).editAppraisal = (crewId: string) => {
    console.log(`Editing appraisal for crew member: ${crewId}`);
    // You can replace this with actual navigation logic
  };
}

export default SCOMPMainTableScreenWrapper;