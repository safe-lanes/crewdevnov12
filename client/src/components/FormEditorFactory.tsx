
import React from 'react';
import { FormEditor } from '@/components/FormEditor';
import { PromotionFormEditor } from '@/components/PromotionFormEditor';
import { GenericFormEditor, type ConfigurableFormPart } from '@/components/GenericFormEditor';
import { Form } from '@shared/schema';
import { supportsInitialStandardDraft } from '@shared/v2/forms-engine/initialStandardDraft';
import { isStandardVersionCategory, type StandardVersionOpening } from "@/lib/standardVersionOpening";
import { StandardVersionOpeningGate } from "./StandardVersionOpening";

// Dynamic form editor mapping
const formEditors: Record<string, React.ComponentType<any>> = {
  'Crew Appraisal Form': FormEditor,
  'Promotion Review Form': PromotionFormEditor,
};

interface FormEditorFactoryProps {
  formName: string;
  form: Form;
  rankGroupName?: string;
  rankGroupId?: number;
  rankGroupConfig?: any;
  configurableParts?: ConfigurableFormPart[];
  useV2?: boolean;
  readOnly?: boolean;
  initialPreview?: boolean;
  standardOpening?: StandardVersionOpening;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const FormEditorFactory: React.FC<FormEditorFactoryProps> = ({
  formName,
  form,
  rankGroupName,
  rankGroupId,
  rankGroupConfig,
  configurableParts = [],
  useV2,
  readOnly,
  initialPreview,
  standardOpening,
  onClose,
  onSave
}) => {
  // Get the appropriate editor component
  // Keep the two legacy name mappings authoritative. All other forms opt into
  // the generic tree editor only when the server reports a configurable part.
  const EditorComponent = (form.category === 'dynamic' ? GenericFormEditor : formEditors[formName])
    ?? (supportsInitialStandardDraft(form.category) || configurableParts.some((part) => part.partType === 'configurable') ? GenericFormEditor : undefined);
  
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

  const explicitOpening = isStandardVersionCategory(form.category) ? standardOpening : undefined;
  const editor = (
    <EditorComponent
      key={explicitOpening || supportsInitialStandardDraft(form.category) ? `${(form as Form & { originalFormId?: number }).originalFormId ?? form.id}:${rankGroupId ?? rankGroupName ?? ""}:${explicitOpening?.versionId ?? ""}` : undefined}
      form={form}
      formName={formName}
      rankGroupName={rankGroupName}
      rankGroupId={rankGroupId}
      rankGroupConfig={rankGroupConfig}
      configurableParts={configurableParts}
      useV2={useV2}
      readOnly={readOnly || (supportsInitialStandardDraft(form.category) && Boolean((form as Form & { archivedAt?: unknown }).archivedAt))}
      initialPreview={initialPreview}
      initialVersionId={explicitOpening?.versionId}
      onClose={onClose}
      onSave={onSave}
    />
  );
  return explicitOpening ? <StandardVersionOpeningGate
    key={`${(form as any).originalFormId ?? form.id}:${explicitOpening.rankGroupId}:${explicitOpening.versionId}`}
    formId={(form as any).originalFormId ?? form.id} opening={explicitOpening} onClose={onClose}
  >{editor}</StandardVersionOpeningGate> : editor;
};

// Function to register a new form editor
export const registerFormEditor = (formName: string, component: React.ComponentType<any>) => {
  formEditors[formName] = component;
};

// Function to check if form editor exists
export const hasFormEditor = (formName: string): boolean => {
  return formName in formEditors;
};
