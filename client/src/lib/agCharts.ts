import { LicenseManager } from 'ag-charts-enterprise';
import { AgCharts } from 'ag-charts-react';

const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
if (licenseKey) {
  LicenseManager.setLicenseKey(licenseKey);
} else {
  console.warn('AG Charts Enterprise license key not found. Using same key as AG Grid (VITE_AG_GRID_LICENSE_KEY).');
}

export { AgCharts };
export type { AgChartOptions, AgChartInstance } from 'ag-charts-enterprise';
