
import React from 'react';
import { FormEditor } from '@/components/FormEditor';
import { PromotionFormEditor } from '@/components/PromotionFormEditor';
import { Form } from '@shared/schema';

// Dynamic form editor mapping
const formEditors: Record<string, React.ComponentType<any>> = {
  'Crew Appraisal Form': FormEditor,
  'Promotion Review Form': PromotionFormEditor,
};

interface FormEditorFactoryProps {
  formName: string;
  form: Form;
  rankGroupName?: string;
  rankGroupConfig?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const FormEditorFactory: React.FC<FormEditorFactoryProps> = ({
  formName,
  form,
  rankGroupName,
  rankGroupConfig,
  onClose,
  onSave
}) => {
  // Get the appropriate editor component
  const EditorComponent = formEditors[formName];
  
  if (!EditorComponent) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">Form Editor Not Found</h3>
          <p className="text-gray-600 mb-4">
            No form editor is available for "{formName}". Please create one using the Form Editor Generator.
          </p>
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <EditorComponent
      form={form}
      rankGroupName={rankGroupName}
      rankGroupConfig={rankGroupConfig}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

// Function to register a new form editor
export const registerFormEditor = (formName: string, component: React.ComponentType<any>) => {
  formEditors[formName] = component;
};

// Function to check if form editor exists
export const hasFormEditor = (formName: string): boolean => {
  return formName in formEditors;
};
