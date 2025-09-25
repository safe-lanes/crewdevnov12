import React, { useState } from 'react';
import RefCrewPoolSideBar from './RefCrewPoolSideBar';
import MainLayout from '@/components/main/MainLayout';

export function RefCrewPoolModule() {
    const [selectedCrewPoolPage, setSelectedCrewPoolPage] = useState<string>("crew-database");
    const allowedPages = ["crew-database"]; // Will be expanded as more pages are added

    const renderPageContent = () => {
        switch (selectedCrewPoolPage) {
            case "crew-database":
                return (
                    <div className="flex-1 p-6" data-testid="crew-database-content">
                        <div className="text-center text-gray-500 mt-20">
                            <h2 className="text-2xl mb-4">Crew Database</h2>
                            <p>Crew database functionality will be implemented here.</p>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="flex-1 p-6" data-testid="default-content">
                        <div className="text-center text-gray-500 mt-20">
                            <p>Select a page from the sidebar</p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <MainLayout>
            <RefCrewPoolSideBar 
                selectedCrewPoolPage={selectedCrewPoolPage}
                setSelectedCrewPoolPage={setSelectedCrewPoolPage}
                allowedPages={allowedPages}
            />
            <div className="ml-[67px] flex-1 bg-white" data-testid="ref-crew-pool-main">
                {renderPageContent()}
            </div>
        </MainLayout>
    );
}