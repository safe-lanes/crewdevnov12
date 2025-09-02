import React, { useState } from 'react';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBar from './RecruitmentSideBar';

export const RecruitmentModule = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");

  // Define allowed pages for the recruitment module
  const allowedPages = ["in-progress", "recruited", "waitlist", "rejected"];

  const renderContent = () => {
    switch (selectedRecruitmentPage) {
      case "in-progress":
        return (
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">In Progress</h2>
            <p className="text-gray-600">Candidates whose recruitment is currently in progress.</p>
            {/* Content for In Progress page will be added later */}
          </div>
        );
      case "recruited":
        return (
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Recruited</h2>
            <p className="text-gray-600">Record of candidates whose recruitment has been completed.</p>
            {/* Content for Recruited page will be added later */}
          </div>
        );
      case "waitlist":
        return (
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Waitlist</h2>
            <p className="text-gray-600">Candidates who have been processed but employment not confirmed. They are in waiting list and can later be considered for employment.</p>
            {/* Content for Waitlist page will be added later */}
          </div>
        );
      case "rejected":
        return (
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Rejected</h2>
            <p className="text-gray-600">Candidates who have been processed but rejected. Their application may be re-opened at a later stage to be considered for employment.</p>
            {/* Content for Rejected page will be added later */}
          </div>
        );
      default:
        return (
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">In Progress</h2>
            <p className="text-gray-600">Candidates whose recruitment is currently in progress.</p>
          </div>
        );
    }
  };

  return (
    <>
      <RecruitmentSideBar 
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      <MainLayout>
        {renderContent()}
      </MainLayout>
    </>
  );
};