
import React from 'react';
import { MicroFrontendWrapper } from './MicroFrontendWrapper';
import App from '../App';
import './micro-frontend.css';
import { AdminModule } from '@/modules/admin/AdminModule';
import { FormEditor } from '@/components/FormEditor';
import { ElementCrewAppraisals } from '@/modules/crewing/ElementCrewAppraisals';
import { AppraisalForm } from '@/modules/crewing/AppraisalForm';
// Main app export for standalone mode
export { default as App } from '../App';

// Wrapper export
export { MicroFrontendWrapper, useMicroFrontendConfig } from './MicroFrontendWrapper';

// Micro frontend bootstrap function
export const bootstrap = (config?: any) => {
  return {
    mount: (element: HTMLElement, mountConfig?: any) => {
      const React = require('react');
      const ReactDOM = require('react-dom/client');
      
      const root = ReactDOM.createRoot(element);
      const finalConfig = { ...config, ...mountConfig, standalone: false };
      
      root.render(
        React.createElement(MicroFrontendWrapper, { config: finalConfig },
          React.createElement(App)
        )
      );
      
      return () => root.unmount();
    },
    
    // Individual component mounting
    mountComponent: (component: string, element: HTMLElement, componentConfig?: any) => {
      const React = require('react');
      const ReactDOM = require('react-dom/client');
      
      const components = {
        ElementCrewAppraisals,
        AppraisalForm,
        AdminModule,
        FormEditor
      };
      
      const Component = components[component as keyof typeof components];
      if (!Component) {
        throw new Error(`Component ${component} not found`);
      }
      
      const root = ReactDOM.createRoot(element);
      const finalConfig = { ...config, ...componentConfig, standalone: false };
      
      root.render(
        React.createElement(MicroFrontendWrapper, { config: finalConfig },
          React.createElement(Component)
        )
      );
      
      return () => root.unmount();
    }
  };
};

// Global registration for micro frontend
if (typeof window !== 'undefined') {
  (window as any).ElementCrewAppraisals = {
    bootstrap,
    MicroFrontendWrapper,
    components: {
      ElementCrewAppraisals,
      AppraisalForm,
      AdminModule,
      FormEditor,
      App
    }
  };
}
