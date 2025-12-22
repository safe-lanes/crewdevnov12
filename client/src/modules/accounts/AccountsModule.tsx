/**
 * Accounts module for managing user accounts, permissions, and access controls
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  Users, 
  UserPlus, 
  Shield, 
  Settings, 
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Key,
  DollarSign
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WageAccountsModule } from "./wage-accounts";
import { PayrunDetailWorkspace } from "./wage-accounts/PayrunDetailWorkspace";


import { PortageBillWorkspace } from "./wage-accounts/PortageBillWorkspace";
import { AllotmentsManagerWorkspace } from "./wage-accounts/AllotmentsManagerWorkspace";
import { AdvancesBondWorkspace } from "./wage-accounts/AdvancesBondWorkspace";
import { BankFilesReturnsWorkspace } from "./wage-accounts/BankFilesReturnsWorkspace";
import { RateTablesRulesWorkspace } from "./wage-accounts/RateTablesRulesWorkspace";
import { ReportsWorkspace } from "./wage-accounts/ReportsWorkspace";
import { PayrunBoardWorkspace } from "./wage-accounts/PayrunBoardWorkspace";
import { ContractDataWorkspace } from "./contract-data";
import { CBATablesWorkspace } from "./cba-tables/CBATablesWorkspace";

// Mock data for demonstration
const mockUsers = [
  {
    id: "1",
    name: "James Wilson",
    email: "james.wilson@seafarer.com",
    role: "Captain",
    status: "Active",
    lastLogin: "2025-01-12",
    department: "Deck"
  },
  {
    id: "2", 
    name: "Sarah Chen",
    email: "sarah.chen@seafarer.com",
    role: "Chief Engineer",
    status: "Active",
    lastLogin: "2025-01-11",
    department: "Engine"
  },
  {
    id: "3",
    name: "Mike Rodriguez",
    email: "mike.rodriguez@seafarer.com", 
    role: "Second Officer",
    status: "Inactive",
    lastLogin: "2025-01-05",
    department: "Deck"
  }
];

const mockRoles = [
  {
    id: "1",
    name: "Captain",
    permissions: ["manage_crew", "view_reports", "edit_appraisals", "admin_access"],
    userCount: 5
  },
  {
    id: "2", 
    name: "Chief Engineer",
    permissions: ["manage_crew", "view_reports", "edit_appraisals"],
    userCount: 8
  },
  {
    id: "3",
    name: "Officer",
    permissions: ["view_reports", "edit_own_profile"],
    userCount: 25
  }
];

export function AccountsModule() {
  // Check URL path for section navigation
  const getInitialSection = () => {
    const path = window.location.pathname;
    if (path.includes('/accounts/contract-data')) {
      return 'contract-data';
    } else if (path.includes('/accounts/cba-tables')) {
      return 'cba-tables';
    } else if (path.includes('/accounts/rate-tables')) {
      return 'rate-tables';
    } else if (path.includes('/accounts/reports')) {
      return 'reports';
    } else if (path.includes('/accounts/portage-bill')) {
      return 'portage-bill';
    } else if (path.includes('/accounts/allotments-manager')) {
      return 'allotments-manager';
    } else if (path.includes('/accounts/advances-bond')) {
      return 'advances-bond';
    } else if (path.includes('/accounts/bank-files-returns')) {
      return 'bank-files-returns';
    }
    
    // Fallback to query parameter for backward compatibility
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    return urlParams.get('section') || 'payrun-board';
  };
  
  const initialSection = getInitialSection();
  
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");

  // Effect to handle URL changes and auto-navigate to crew payroll card
  React.useEffect(() => {
    const storedCrewData = sessionStorage.getItem('selectedCrewForPayroll');
    if (storedCrewData && initialSection === 'crew-payroll-card') {
      const crewData = JSON.parse(storedCrewData);
      console.log('Navigating to crew payroll card for:', crewData);
      // Clear the stored data after use
      sessionStorage.removeItem('selectedCrewForPayroll');
    }
  }, [initialSection]);

  const filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string) => {
    return status === "Active" ? "default" : "secondary";
  };

  return (
    <div className="bg-transparent flex flex-row justify-center w-full">
      <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] h-[900px] w-full">
        

        {/* Left Sidebar */}
        <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
          {/* Payrun Board Section - Active */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "payrun-board" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("payrun-board")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1.81.35 1.61 1.99 1.61 1.11 0 1.85-.39 1.85-1.3 0-.69-.42-1.19-1.68-1.46l-1.79-.4c-1.69-.38-2.56-1.37-2.56-2.62 0-1.6 1.18-2.76 2.8-3.12V6h2.67v1.38c1.32.3 2.36 1.15 2.47 2.56h-1.96c-.08-.53-.37-1.18-1.52-1.18-1.03 0-1.63.43-1.63 1.12 0 .66.45 1.01 1.47 1.25l1.5.34c1.94.44 2.83 1.38 2.83 2.79 0 1.76-1.35 2.92-3.16 3.33z" fill="white"/>
              </svg>
            </div>
            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica] text-center">
              Payrun board
            </div>
          </div>







          {/* Portage Bill Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "portage-bill" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("portage-bill")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 13H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 9H9H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Portage<br/>Bill
            </div>
          </div>

          {/* Allotments Manager Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "allotments-manager" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("allotments-manager")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V18C20 18.5304 19.7893 19.0391 19.4142 19.4142C19.0391 19.7893 18.5304 20 18 20H6C5.46957 20 4.96086 19.7893 4.58579 19.4142C4.21071 19.0391 4 18.5304 4 18V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 2H9C8.44772 2 8 2.44772 8 3V5C8 5.55228 8.44772 6 9 6H15C15.5523 6 16 5.55228 16 5V3C16 2.44772 15.5523 2 15 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 11H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 11H8.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 16H8.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Allotments<br/>Manager
            </div>
          </div>

          {/* Advances & Bond Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "advances-bond" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("advances-bond")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C13.1046 2 14 2.89543 14 4C14 5.10457 13.1046 6 12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2Z" stroke="white" strokeWidth="2"/>
                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 8L18 10L22 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12L10 14L14 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Advances &<br/>Bond
            </div>
          </div>

          {/* Bank Files & Returns Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "bank-files-returns" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("bank-files-returns")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13C13.1046 13 14 12.1046 14 11Z" stroke="white" strokeWidth="2"/>
                <path d="M2 3L22 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M2 7L22 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M2 21L22 21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 7V21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 7V21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 7V21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M20 7V21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Bank Files &<br/>Returns
            </div>
          </div>

          {/* Rate Tables & Rules Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "rate-tables" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("rate-tables")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3Z" stroke="white" strokeWidth="2"/>
                <path d="M9 9L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 9L9 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 7H7.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 7H17.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 17H7.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 17H17.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Rate Tables &<br/>Rules
            </div>
          </div>

          {/* Contract Data Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "contract-data" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("contract-data")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 11H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 11L10 12L12 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 15L10 16L12 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Contract<br/>Data
            </div>
          </div>

          {/* CBA Tables Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "cba-tables" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("cba-tables")}
          >
            <div className="w-6 h-6 mb-1">
              <DollarSign size={24} color="white" />
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              CBA<br/>Tables
            </div>
          </div>

          {/* Reports Section */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedSection === "reports" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedSection("reports")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 17H15M9 13H15M9 9H15M4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-white text-[8px] font-normal font-['Roboto',Helvetica] text-center leading-tight">
              Reports
            </div>
          </div>
          
          {/* Dark blue section for rest of sidebar */}
          <div className="w-full h-[calc(100%-711px)] bg-[#16569e]">
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-[67px] h-[833px] px-6 py-2 bg-[#f8fafc]">
          <div className="h-full">
            {selectedSection === "payrun-board" ? (
              <PayrunBoardWorkspace />
            ) : selectedSection === "portage-bill" ? (
              <PortageBillWorkspace />
            ) : selectedSection === "allotments-manager" ? (
              <AllotmentsManagerWorkspace />
            ) : selectedSection === "advances-bond" ? (
              <AdvancesBondWorkspace />
            ) : selectedSection === "bank-files-returns" ? (
              <BankFilesReturnsWorkspace />
            ) : selectedSection === "rate-tables" ? (
              <RateTablesRulesWorkspace />
            ) : selectedSection === "contract-data" ? (
              <ContractDataWorkspace />
            ) : selectedSection === "cba-tables" ? (
              <CBATablesWorkspace />
            ) : selectedSection === "reports" ? (
              <ReportsWorkspace />
            ) : (
              <PayrunBoardWorkspace />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}