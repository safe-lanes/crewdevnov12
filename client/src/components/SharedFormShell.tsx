import React, { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sailDesignSystem } from "@/config/sailDesignSystem";

export interface SharedFormShellSection {
  id: string;
  title: string;
  letter?: string;
  disabled?: boolean;
}

export interface SharedFormShellProps {
  title: string;
  sections: SharedFormShellSection[];
  children: React.ReactNode;
  onClose: () => void;
  header: React.ReactNode;
  footer?: React.ReactNode;
  activeSection?: string;
  onActiveSectionChange?: (sectionId: string) => void;
  dialogRef?: React.Ref<HTMLDivElement>;
  contentRef?: React.Ref<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  confirmDialog?: React.ReactNode;
  testId?: string;
}

export function SharedFormShell({
  title,
  sections,
  children,
  onClose,
  header,
  footer,
  activeSection,
  onActiveSectionChange,
  dialogRef,
  contentRef,
  onKeyDown,
  confirmDialog,
  testId,
}: SharedFormShellProps) {
  const [internalActiveSection, setInternalActiveSection] = useState(sections[0]?.id || "");
  const selectedSection = activeSection ?? internalActiveSection;
  const selectSection = (sectionId: string) => {
    if (onActiveSectionChange) onActiveSectionChange(sectionId);
    else setInternalActiveSection(sectionId);
  };

  const defaultFooter = (
    <div className="border-t bg-[#f8fafc] px-6 py-3 flex items-center justify-between">
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      <div className="text-xs text-gray-500">All changes saved</div>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 bg-opacity-50 flex items-center justify-center z-[200] p-4"
        data-testid={testId === "generic-form-editor" ? "generic-form-editor-overlay" : testId ? `${testId}-backdrop` : undefined}
      >
        <div
          ref={dialogRef}
          className="bg-white rounded-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          data-testid={testId}
        >
          {header}

          <div className="flex flex-1 overflow-hidden">
            <div className="block sm:hidden bg-white border-b px-4 py-3 absolute left-4 right-4 top-[4.75rem] z-10">
              <nav className="flex justify-center space-x-4">
                {sections.map((section, index) => {
                  const isActive = selectedSection === section.id;
                  const sectionLetter = section.letter || (section.id.length <= 2 ? section.id.toUpperCase() : section.id.charAt(0).toUpperCase());
                  return (
                    <div key={section.id} className="flex items-center">
                      <button
                        type="button"
                        disabled={section.disabled}
                        onClick={() => selectSection(section.id)}
                        className="flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid={`button-step-mobile-${section.id}`}
                      >
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${isActive ? "bg-blue-600 text-white" : "bg-gray-600 text-white"}`}>
                          {sectionLetter}
                        </span>
                      </button>
                      {index < sections.length - 1 && <div className="w-8 h-0.5 bg-gray-300 mx-2" />}
                    </div>
                  );
                })}
              </nav>
            </div>

            <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-gray-50 border-r overflow-y-auto">
              <div className="p-3">
                <nav className="space-y-1">
                  {sections.map((section, index) => {
                    const isActive = selectedSection === section.id;
                    const sectionLetter = section.letter || (section.id.length <= 2 ? section.id.toUpperCase() : section.id.charAt(0).toUpperCase());
                    return (
                      <div key={section.id} className="relative">
                        <button
                          type="button"
                          disabled={section.disabled}
                          onClick={() => selectSection(section.id)}
                          className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 min-h-[3rem] disabled:cursor-not-allowed disabled:opacity-50 ${
                            isActive ? "bg-blue-50 border-blue-600 text-blue-700" : "border-transparent hover:bg-gray-100 text-gray-700"
                          }`}
                          aria-current={isActive ? "step" : undefined}
                          data-testid={`button-step-${section.id}`}
                        >
                          <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${isActive ? "bg-blue-600 text-white" : "bg-gray-600 text-white"}`}>
                            {sectionLetter}
                          </span>
                          <span className="hidden xl:block ml-3 text-left text-sm leading-tight flex-1" data-testid={`text-step-title-${section.id}`} title={section.title} style={{ wordBreak: "break-word", lineHeight: "1.2", maxWidth: "8rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {section.title.replace(/^Part [A-Z]: /, "")}
                          </span>
                        </button>
                        {index < sections.length - 1 && <div className="absolute left-7 top-12 w-0.5 h-3 bg-gray-300" />}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <main ref={contentRef} className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6" style={{ backgroundColor: sailDesignSystem.colors.background }}>
              {children}
            </main>
          </div>

          {footer ?? defaultFooter}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}