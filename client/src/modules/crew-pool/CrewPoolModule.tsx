import React, { useState } from 'react';
import CrewPoolSideBar from './CrewPoolSideBar';
import MainLayout from '../../components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';

export const CrewPoolModule = (): JSX.Element => {
    const [selectedCrewPoolPage, setSelectedCrewPoolPage] = useState("crew-database");
    
    // Define allowed pages for the crew pool module
    const allowedPages = ["crew-database"];

    const getTitle = () => {
        switch (selectedCrewPoolPage) {
            case "crew-database":
                return "Crew Database";
            default:
                return "Crew Database";
        }
    };

    const renderContent = () => {
        if (selectedCrewPoolPage === "crew-database") {
            return (
                <div className="p-6 text-center text-gray-600" data-testid="crew-database-content">
                    <div className="mt-20">
                        <h2 className="text-2xl mb-4">Crew Database</h2>
                        <p>Crew database functionality will be implemented here.</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="p-6 text-center text-gray-600" data-testid="default-content">
                <div className="mt-20">
                    <p>Select a page from the sidebar</p>
                </div>
            </div>
        );
    };

    return (
        <>
            <CrewPoolSideBar 
                selectedCrewPoolPage={selectedCrewPoolPage}
                setSelectedCrewPoolPage={setSelectedCrewPoolPage}
                allowedPages={allowedPages}
            />
            <MainLayout>
                <SectionTitleComponents title={getTitle()}>
                    <div className="flex gap-2">
                        {/* Action buttons will be added in future iterations */}
                    </div>
                </SectionTitleComponents>
                <div className="ml-[67px] flex-1" data-testid="crew-pool-main">
                    {renderContent()}
                </div>
            </MainLayout>
        </>
    );
};