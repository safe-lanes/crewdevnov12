import React, { useState } from 'react';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBar from './RecruitmentSideBar';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';

export const RecruitmentModule = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");

  // Define allowed pages for the recruitment module
  const allowedPages = ["in-progress", "recruited", "waitlist", "rejected"];

  const getTitle = () => {
    switch (selectedRecruitmentPage) {
      case "in-progress":
        return "In Progress";
      case "recruited":
        return "Recruited";
      case "waitlist":
        return "Waitlist";
      case "rejected":
        return "Rejected";
      default:
        return "In Progress";
    }
  };

  const renderContent = () => {
    return (
      <div>
        {/* Content for current page will be added later */}
      </div>
    );
  };

  return (
    <>
      <RecruitmentSideBar 
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      <MainLayout>
        <SectionTitleComponents title={getTitle()}>
          <div className="flex gap-2">
            {/* Action buttons can be added here later */}
          </div>
        </SectionTitleComponents>
        {renderContent()}
      </MainLayout>
    </>
  );
};