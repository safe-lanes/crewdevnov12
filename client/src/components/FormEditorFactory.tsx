
import React from 'react';
import { FormEditor } from '@/components/FormEditor';
import { PromotionFormEditor } from '@/components/PromotionFormEditor';
import { GenericFormEditor, type ConfigurableFormPart } from '@/components/GenericFormEditor';
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
  configurableParts?: ConfigurableFormPart[];
  useV2?: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const FormEditorFactory: React.FC<FormEditorFactoryProps> = ({
  formName,
  form,
  rankGroupName,
  rankGroupConfig,
  configurableParts = [],
  useV2,
  onClose,
  onSave
}) => {
  // Get the appropriate editor component
  // Keep the two legacy name mappings authoritative. All other forms opt into
  // the generic tree editor only when the server reports a configurable part.
  const EditorComponent = formEditors[formName]
    ?? (configurableParts.some((part) => part.partType === 'configurable') ? GenericFormEditor : undefined);
  
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
      configurableParts={configurableParts}
      useV2={useV2}
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
