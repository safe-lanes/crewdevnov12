import React, { useState } from 'react';
import RotationSideBar from './RotationSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';

export function RotationModule() {
    const [selectedRotationPage, setSelectedRotationPage] = useState<string>("due");
    const allowedPages = ["due", "plan", "approval"];

    const renderContent = () => {
        switch (selectedRotationPage) {
            case "due":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold text-[#16569e] mb-4">Due / Overdue Crew Members</h2>
                        <p className="text-gray-600">Content for due crew members will be displayed here.</p>
                    </div>
                );
            case "plan":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold text-[#16569e] mb-4">Rotation Planning</h2>
                        <p className="text-gray-600">Rotation planning functionality will be displayed here.</p>
                    </div>
                );
            case "approval":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold text-[#16569e] mb-4">Rotation Approval</h2>
                        <p className="text-gray-600">Rotation approval workflow will be displayed here.</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <RotationSideBar 
                selectedRotationPage={selectedRotationPage}
                setSelectedRotationPage={setSelectedRotationPage}
                allowedPages={allowedPages}
            />
            <MainLayout>
                <SectionTitleComponents title="Rotation">
                    <div></div>
                </SectionTitleComponents>
                {renderContent()}
            </MainLayout>
        </>
    );
}
