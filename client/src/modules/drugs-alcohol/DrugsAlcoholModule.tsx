import { useState } from 'react';
import MainLayout from '@/components/main/MainLayout';
import DrugsAlcoholSideBar from './DrugsAlcoholSideBar';

export function DrugsAlcoholModule() {
    const [selectedDrugsAlcoholPage, setSelectedDrugsAlcoholPage] = useState<string>("annual");
    const allowedPages = ["annual", "periodic", "monthly", "post-incident", "others", "summary"];

    const renderContent = () => {
        switch (selectedDrugsAlcoholPage) {
            case "annual":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Annual Tests
                        </h2>
                        <p className="text-gray-600">
                            Annual drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "periodic":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Periodic Tests
                        </h2>
                        <p className="text-gray-600">
                            Periodic (e.g., Quarterly) drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "monthly":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Monthly Tests
                        </h2>
                        <p className="text-gray-600">
                            Monthly drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "post-incident":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Post Incident Tests
                        </h2>
                        <p className="text-gray-600">
                            Post incident drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "others":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Other Tests
                        </h2>
                        <p className="text-gray-600">
                            Other drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "summary":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Summary
                        </h2>
                        <p className="text-gray-600">
                            Summary of all drug and alcohol tests for a particular vessel will be displayed here.
                        </p>
                    </div>
                );
            default:
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Drugs & Alcohol Testing
                        </h2>
                        <p className="text-gray-600">
                            Select a test type from the left sidebar.
                        </p>
                    </div>
                );
        }
    };

    return (
        <>
            <DrugsAlcoholSideBar
                selectedDrugsAlcoholPage={selectedDrugsAlcoholPage}
                setSelectedDrugsAlcoholPage={setSelectedDrugsAlcoholPage}
                allowedPages={allowedPages}
            />
            <MainLayout>
                <div className="bg-white rounded-lg shadow">
                    {renderContent()}
                </div>
            </MainLayout>
        </>
    );
}
